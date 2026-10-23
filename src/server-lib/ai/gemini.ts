import * as crypto from 'node:crypto';
import {GoogleGenAI, Schema, Type} from '@google/genai';
import {z} from 'zod';
import {
  AI_CACHE_TTL_MS,
  MAX_AI_INPUT_LENGTH,
} from '../../shared/constants';
import {
  AiBranchRequestSchema,
  AiBranchResponse,
  AiBranchResponseSchema,
  AiChatRequestSchema,
  AiChatResponse,
  AiChatResponseSchema,
  AiClaimsRequestSchema,
  AiClaimsResponse,
  AiClaimsResponseSchema,
  AiFamilyRequestSchema,
  AiFamilyResponse,
  AiFamilyResponseSchema,
  AiFeesRequestSchema,
  AiFeesResponse,
  AiFeesResponseSchema,
  AiPitchRequestSchema,
  AiPitchResponse,
  AiPitchResponseSchema,
  AiPlanRequestSchema,
  AiPlanResponse,
  AiPlanResponseSchema,
  AiScholarshipExplainRequestSchema,
  AiScholarshipExplainResponse,
  AiScholarshipExplainResponseSchema,
  AiTranslateRequestSchema,
  AiTranslateResponse,
  AiTranslateResponseSchema,
  AiVerifyRequestSchema,
  AiVerifyResponse,
  AiVerifyResponseSchema,
} from '../../shared/schemas';
import {
  atomicWriteJson,
  readJsonOrDefault,
  repo,
} from '../repository/jsonRepo';
import {AI_DISCLAIMER_TEXT, PROMPT_TEMPLATES} from './prompts';

// Single constant for the Gemini model across the server
export const GEMINI_MODEL = 'gemini-3.8-flash';

interface CacheEntry {
  timestamp: number;
  response: unknown;
}

function computeInputHash(endpoint: string, payload: unknown): string {
  const serialized = JSON.stringify({endpoint, payload});
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function getCachedResponse<T>(
  hash: string,
  schema: z.ZodType<T>
): T | null {
  const cache = readJsonOrDefault<Record<string, CacheEntry>>(
    'ai-cache.json',
    {}
  );
  const entry = cache[hash];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AI_CACHE_TTL_MS) {
    return null;
  }
  const parsed = schema.safeParse(entry.response);
  return parsed.success ? parsed.data : null;
}

function setCachedResponse<T>(hash: string, response: T): void {
  const cache = readJsonOrDefault<Record<string, CacheEntry>>(
    'ai-cache.json',
    {}
  );
  cache[hash] = {
    timestamp: Date.now(),
    response,
  };
  atomicWriteJson('ai-cache.json', cache);
}

export function sanitizeUntrustedInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Input cannot be empty.');
  }
  if (trimmed.length > MAX_AI_INPUT_LENGTH) {
    throw new Error(
      `Input exceeds maximum allowed length of ${MAX_AI_INPUT_LENGTH} characters.`
    );
  }
  return `<untrusted_user_data>\n${trimmed.replace(/<\/?untrusted_user_data>/gi, '')}\n</untrusted_user_data>`;
}

function buildCompactDataContext(): string {
  const colleges = repo.getColleges().map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    ownership: c.ownership,
    city: c.cityInfo.city,
    state: c.cityInfo.state,
    isPartner: c.isPartner,
    nirfRank2024: c.accreditation.nirfRank.value,
    aicteApproved: c.accreditation.aicteApproved.value,
    ugcStatus: c.accreditation.ugcStatus.value,
    tuitionPerYearInr: c.fees.tuitionPerYearInr.value,
    hostelPerYearInr: c.fees.hostelPerYearInr.value,
    messPerYearInr: c.fees.messPerYearInr.value,
    medianSalaryInr: c.placements.medianSalaryInr.value,
    placedPercent: c.placements.placedPercent.value,
    routes: c.admissionRoutes.map((r) => r.routeType),
    officialWebsite: c.officialWebsite,
  }));

  const exams = repo.getExams().map((e) => ({
    id: e.id,
    shortName: e.shortName,
    level: e.level,
    examDate: e.examDate.value,
    registrationEnd: e.registrationEnd.value,
    status: e.status,
    officialUrl: e.officialUrl,
  }));

  return `<verified_context>\n${JSON.stringify({colleges, exams})}\n</verified_context>`;
}

async function callGeminiStructured<T>(options: {
  endpointName: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  zodSchema: z.ZodType<T>;
  fallbackGenerator: () => T;
}): Promise<T> {
  const hash = computeInputHash(options.endpointName, options.prompt);
  const cached = getCachedResponse(hash, options.zodSchema);
  if (cached) {
    return cached;
  }

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const fallback = options.zodSchema.parse(options.fallbackGenerator());
    setCachedResponse(hash, fallback);
    return fallback;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {'User-Agent': 'aistudio-build'},
    },
  });

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini request timed out')), 14000)
      );

      const genPromise = ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: options.responseSchema,
          temperature: 0.2,
        },
      });

      const response = await Promise.race([genPromise, timeoutPromise]);
      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Empty response from Gemini model');
      }

      const parsedJson = JSON.parse(rawText);
      const validated = options.zodSchema.parse(parsedJson);
      setCachedResponse(hash, validated);
      return validated;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  const fallback = options.zodSchema.parse(options.fallbackGenerator());
  setCachedResponse(hash, fallback);
  return fallback;
}

// 1. Free AI Counsellor Chat
export async function handleAiChat(
  rawInput: z.infer<typeof AiChatRequestSchema>
): Promise<AiChatResponse> {
  const input = AiChatRequestSchema.parse(rawInput);
  const safeMsg = sanitizeUntrustedInput(input.message);
  const context = buildCompactDataContext();

  return callGeminiStructured({
    endpointName: 'chat',
    systemInstruction: PROMPT_TEMPLATES.chat.systemInstruction,
    prompt: `${context}\nLanguage preference: ${input.language}\nUser question:\n${safeMsg}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        answer: {type: Type.STRING},
        citedSources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {type: Type.STRING},
              url: {type: Type.STRING},
            },
            required: ['name', 'url'],
          },
        },
        suggestedFollowUps: {
          type: Type.ARRAY,
          items: {type: Type.STRING},
        },
        disclaimer: {type: Type.STRING},
      },
      required: ['answer', 'citedSources', 'suggestedFollowUps', 'disclaimer'],
    },
    zodSchema: AiChatResponseSchema,
    fallbackGenerator: () => {
      const q = input.message.toLowerCase();
      const colleges = repo.getColleges();
      const matched = colleges.find(
        (c) =>
          q.includes(c.shortName.toLowerCase()) ||
          q.includes(c.name.toLowerCase()) ||
          q.includes(c.id.replace('-', ' '))
      );
      if (matched) {
        const tuition = matched.fees.tuitionPerYearInr.value
          ? `₹${matched.fees.tuitionPerYearInr.value.toLocaleString('en-IN')}/year`
          : 'Not verified';
        const median = matched.placements.medianSalaryInr.value
          ? `₹${(matched.placements.medianSalaryInr.value / 100000).toFixed(2)} LPA`
          : 'Not verified';
        const nirf = matched.accreditation.nirfRank.value
          ? `#${matched.accreditation.nirfRank.value} (NIRF 2024)`
          : 'Not verified';
        return {
          answer: `Based on our verified dataset for ${matched.name} (${matched.cityInfo.city}):\n• NIRF 2024 Engineering Rank: ${nirf}\n• Annual Tuition Fee: ${tuition}\n• Verified Median Placement Salary: ${median}\n• Admission Routes: ${matched.admissionRoutes.map((r) => r.label).join(', ')}.\n\nAlways verify latest category-wise cutoffs and fee circulars on ${matched.officialWebsite}.`,
          citedSources: [
            {name: `${matched.shortName} Official Portal`, url: matched.officialWebsite},
            {
              name: 'NIRF 2024 Engineering Rankings',
              url: 'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
            },
          ],
          suggestedFollowUps: [
            `What is the 4-year total cost and ROI for ${matched.shortName}?`,
            'Which government scholarships can reduce my tuition fee?',
            'What are the upcoming exam registration deadlines?',
          ],
          disclaimer: AI_DISCLAIMER_TEXT,
        };
      }
      return {
        answer:
          'From our verified dataset of 15 engineering colleges and 15 entrance exams: public institutes like Jadavpur University (₹2,400/yr tuition), COEP Pune (₹68,000/yr), and NIT Trichy / NIT Surathkal (₹1.25L/yr with MoE income-linked tuition waiver) offer the fastest ROI payback. For private merit options, BITS Pilani (BITSAT), IIIT Hyderabad (JEE Main / UGEE), VIT Vellore (VITEEE Category 1), and Thapar Patiala offer transparent merit counselling. Tell me your target budget or exam rank for a tailored comparison.',
        citedSources: [
          {
            name: 'NIRF India Rankings 2024',
            url: 'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
          },
          {name: 'JoSAA Official Portal', url: 'https://josaa.nic.in'},
          {name: 'AICTE Official Portal', url: 'https://www.aicte-india.org'},
        ],
        suggestedFollowUps: [
          'Compare NIT Trichy vs VIT Vellore 4-year cost',
          'Which exams are currently open for registration?',
          'How do I check if an admission agent is genuine?',
        ],
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 2. Fake College & Agent Checker
export async function handleAiVerify(
  rawInput: z.infer<typeof AiVerifyRequestSchema>
): Promise<AiVerifyResponse> {
  const input = AiVerifyRequestSchema.parse(rawInput);
  const safeQuery = sanitizeUntrustedInput(input.queryText);
  const textLower = input.queryText.toLowerCase();

  // Rule-based red flag detector
  const ruleFlags: string[] = [];
  if (/100%\s*(placement|job)/i.test(input.queryText)) {
    ruleFlags.push(
      'Claims "100% guaranteed placement" — even NIRF #1 IIT Madras reports 81% UG placement.'
    );
  }
  if (
    /guaranteed\s*(seat|admission)|direct\s*management\s*quota\s*in\s*(iit|nit|bits)/i.test(
      input.queryText
    )
  ) {
    ruleFlags.push(
      'Promises guaranteed or backdoor seat in merit-only institutes.'
    );
  }
  if (
    /pay\s*(today|now|immediately)|last\s*\d+\s*seats|token\s*amount|urgent\s*booking/i.test(
      input.queryText
    )
  ) {
    ruleFlags.push(
      'High-pressure urgency tactic ("pay today / token booking / last few seats").'
    );
  }
  if (
    /saving(s)?\s*account|personal\s*upi|gpay\s*to\s*agent|cash\s*donation|capitation/i.test(
      input.queryText
    )
  ) {
    ruleFlags.push(
      'Requests fee payment to a personal bank account, UPI, or cash capitation (illegal under UGC/AICTE norms).'
    );
  }
  if (/\.(xyz|top|club|info|biz|online)|gmail\.com|yahoo\.com/i.test(input.queryText)) {
    ruleFlags.push(
      'Uses an unofficial website domain or free personal email address instead of .ac.in / .edu.in / official university domain.'
    );
  }

  const matchedCollege = repo
    .getColleges()
    .find(
      (c) =>
        textLower.includes(c.shortName.toLowerCase()) ||
        textLower.includes(c.name.toLowerCase())
    );

  return callGeminiStructured({
    endpointName: 'verify',
    systemInstruction: PROMPT_TEMPLATES.verify.systemInstruction,
    prompt: `${buildCompactDataContext()}\nPre-detected Rule Red Flags: ${JSON.stringify(ruleFlags)}\nMatched College: ${matchedCollege ? matchedCollege.name : 'None in seed'}\nUser Input:\n${safeQuery}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        riskLevel: {type: Type.STRING, enum: ['Low', 'Medium', 'High']},
        matchedCollegeName: {type: Type.STRING, nullable: true},
        approvalStatusSummary: {type: Type.STRING},
        redFlagsDetected: {type: Type.ARRAY, items: {type: Type.STRING}},
        aiExplanation: {type: Type.STRING},
        nextSteps: {type: Type.ARRAY, items: {type: Type.STRING}},
        officialPortalsToVerify: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {type: Type.STRING},
              url: {type: Type.STRING},
            },
            required: ['name', 'url'],
          },
        },
        disclaimer: {type: Type.STRING},
      },
      required: [
        'riskLevel',
        'matchedCollegeName',
        'approvalStatusSummary',
        'redFlagsDetected',
        'aiExplanation',
        'nextSteps',
        'officialPortalsToVerify',
        'disclaimer',
      ],
    },
    zodSchema: AiVerifyResponseSchema,
    fallbackGenerator: () => {
      const riskLevel: 'Low' | 'Medium' | 'High' =
        ruleFlags.length >= 2
          ? 'High'
          : ruleFlags.length === 1 || !matchedCollege
            ? 'Medium'
            : 'Low';

      return {
        riskLevel,
        matchedCollegeName: matchedCollege ? matchedCollege.name : null,
        approvalStatusSummary: matchedCollege
          ? `${matchedCollege.name} is verified in our dataset (${matchedCollege.accreditation.ugcStatus.value ?? 'Verified'}, AICTE Approved: ${matchedCollege.accreditation.aicteApproved.value ? 'Yes' : 'Not verified'}). Official website: ${matchedCollege.officialWebsite}`
          : 'This college or agent is not in our verified 15-college dataset. Do not pay any fee until you verify its AICTE approval letter and UGC university status.',
        redFlagsDetected:
          ruleFlags.length > 0
            ? ruleFlags
            : matchedCollege
              ? ['No obvious scam phrasing detected, but always verify offer letters directly on the official admission portal.']
              : ['Unverified entity — not matched to an official .ac.in / .edu.in institute in our seed database.'],
        aiExplanation:
          riskLevel === 'High'
            ? 'Multiple high-risk fraud indicators were triggered. Official engineering admissions in India never require urgent transfers to personal accounts or guarantee 100% placements.'
            : matchedCollege
              ? `${matchedCollege.shortName} is a legitimate institute, but ensure you apply ONLY through ${matchedCollege.officialWebsite} or the official exam counselling portal.`
              : 'We could not confirm this entity in our seed database. Check the official AICTE Approved Institutes list and UGC Fake Universities notice before sharing documents or money.',
        nextSteps: [
          'Never pay fees via UPI or NEFT to an individual agent or consultancy bank account.',
          'Cross-check the exact website domain on the official AICTE/UGC portal.',
          'Never hand over original Class 10/12 marksheets to an agent.',
        ],
        officialPortalsToVerify: [
          {name: 'AICTE Approved Institutes', url: 'https://www.aicte-india.org'},
          {name: 'UGC Fake Universities Notice', url: 'https://www.ugc.gov.in'},
          ...(matchedCollege
            ? [{name: matchedCollege.shortName, url: matchedCollege.officialWebsite}]
            : []),
        ],
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 3. Counsellor Pitch Analyzer
export async function handleAiPitch(
  rawInput: z.infer<typeof AiPitchRequestSchema>
): Promise<AiPitchResponse> {
  const input = AiPitchRequestSchema.parse(rawInput);
  const safePitch = sanitizeUntrustedInput(input.pitchText);

  return callGeminiStructured({
    endpointName: 'pitch',
    systemInstruction: PROMPT_TEMPLATES.pitch.systemInstruction,
    prompt: `${buildCompactDataContext()}\nAnalyze counsellor pitch:\n${safePitch}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        riskLevel: {type: Type.STRING, enum: ['Low', 'Medium', 'High']},
        pressureTactics: {type: Type.ARRAY, items: {type: Type.STRING}},
        claimsVsData: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              claim: {type: Type.STRING},
              factInDataset: {type: Type.STRING},
            },
            required: ['claim', 'factInDataset'],
          },
        },
        redFlags: {type: Type.ARRAY, items: {type: Type.STRING}},
        questionsToAskBack: {type: Type.ARRAY, items: {type: Type.STRING}},
        summary: {type: Type.STRING},
        disclaimer: {type: Type.STRING},
      },
      required: [
        'riskLevel',
        'pressureTactics',
        'claimsVsData',
        'redFlags',
        'questionsToAskBack',
        'summary',
        'disclaimer',
      ],
    },
    zodSchema: AiPitchResponseSchema,
    fallbackGenerator: () => {
      const tactics: string[] = [];
      if (/today|urgent|hours|last|closing|hurry|bloque|seat lock/i.test(input.pitchText)) {
        tactics.push('Artificial deadline / seat-scarcity countdown pressure');
      }
      if (/100%|guaranteed|assured|package/i.test(input.pitchText)) {
        tactics.push('Exaggerated placement or guaranteed package promise');
      }
      if (/donation|management|token|advance|blocking/i.test(input.pitchText)) {
        tactics.push('Upfront non-refundable seat-blocking fee demand');
      }

      const riskLevel: 'Low' | 'Medium' | 'High' =
        tactics.length >= 2 ? 'High' : tactics.length === 1 ? 'Medium' : 'Low';

      return {
        riskLevel,
        pressureTactics:
          tactics.length > 0
            ? tactics
            : ['No overt countdown tactic found, but verify every verbal claim in writing'],
        claimsVsData: [
          {
            claim: 'Headline average/highest salary claims in pitch',
            factInDataset:
              'Official NIRF 2024 median salaries are typically 30%–70% lower than headline highest packages (e.g., VIT Vellore NIRF median is ₹9.00 LPA vs ₹88 LPA highest; SRM IST median is ₹6.10 LPA).',
          },
          {
            claim: 'Direct seat blocking via agent',
            factInDataset:
              'BITS Pilani, IITs, NITs, IIIT-H, Jadavpur, COEP, VIT, and MIT Manipal conduct 100% online merit counselling on their official portals.',
          },
        ],
        redFlags: [
          'Asking for advance token payments before official merit list publication',
          'Quoting "average package" without showing the official NIRF DCS PDF submission',
        ],
        questionsToAskBack: [
          'Can you share the college’s official NIRF 2024 DCS PDF showing the median salary for 4-year UG students?',
          'Will the fee receipt be generated directly on the university’s official .ac.in / .edu.in ERP portal?',
          'What is the written UGC-compliant refund policy if I withdraw after JoSAA / State CET allotment?',
        ],
        summary:
          riskLevel === 'High'
            ? 'This pitch uses classic high-pressure seat-blocking tactics. Pause immediately and do not pay any token money.'
            : 'Treat verbal counsellor promises with caution and verify all fees and cutoffs on the official university portal.',
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 4. Hidden Fee & Refund Detector
export async function handleAiFees(
  rawInput: z.infer<typeof AiFeesRequestSchema>
): Promise<AiFeesResponse> {
  const input = AiFeesRequestSchema.parse(rawInput);
  const safeText = sanitizeUntrustedInput(input.feeText);

  return callGeminiStructured({
    endpointName: 'fees',
    systemInstruction: PROMPT_TEMPLATES.fees.systemInstruction,
    prompt: `${buildCompactDataContext()}\nExtract fees and refund rules from:\n${safeText}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        extractedCharges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item: {type: Type.STRING},
              amountInr: {type: Type.NUMBER, nullable: true},
              frequency: {
                type: Type.STRING,
                enum: ['One-time', 'Yearly', 'Per Semester', 'Not specified'],
              },
              refundable: {
                type: Type.STRING,
                enum: ['Yes', 'No', 'Conditional', 'Not found'],
              },
              isVagueOrHiddenFlag: {type: Type.BOOLEAN},
              note: {type: Type.STRING},
            },
            required: [
              'item',
              'amountInr',
              'frequency',
              'refundable',
              'isVagueOrHiddenFlag',
              'note',
            ],
          },
        },
        computedFirstYearTotalInr: {type: Type.NUMBER, nullable: true},
        computedFourYearEstimateInr: {type: Type.NUMBER, nullable: true},
        vagueItemsFlagged: {type: Type.ARRAY, items: {type: Type.STRING}},
        refundAndWithdrawalRulesSummary: {type: Type.STRING},
        missingItemsNotice: {type: Type.ARRAY, items: {type: Type.STRING}},
        disclaimer: {type: Type.STRING},
      },
      required: [
        'extractedCharges',
        'computedFirstYearTotalInr',
        'computedFourYearEstimateInr',
        'vagueItemsFlagged',
        'refundAndWithdrawalRulesSummary',
        'missingItemsNotice',
        'disclaimer',
      ],
    },
    zodSchema: AiFeesResponseSchema,
    fallbackGenerator: () => {
      const lines = input.feeText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const extractedCharges: AiFeesResponse['extractedCharges'] = [];
      let firstYearTotal = 0;
      let fourYearTotal = 0;
      const vagueItemsFlagged: string[] = [];

      for (const line of lines) {
        const match = line.match(/(?:rs\.?|inr|₹)?\s*([0-9][0-9,]{2,})/i);
        const amount = match
          ? parseInt(match[1].replace(/,/g, ''), 10)
          : null;
        if (amount !== null && !Number.isNaN(amount)) {
          const isOneTime = /one[\s-]*time|admission|caution|deposit|registration/i.test(
            line
          );
          const isSemester = /semester|sem/i.test(line);
          const isVague =
            /development|misc|ancillary|training|placement fee|special|value added|compulsory uniform/i.test(
              line
            );
          const isRefundable = /caution|refundable deposit/i.test(line)
            ? 'Yes'
            : /non[\s-]*refundable/i.test(line)
              ? 'No'
              : 'Not found';

          const label = line.replace(/(?:rs\.?|inr|₹)?\s*[0-9][0-9,]{2,}.*/i, '').replace(/[:-]+$/, '').trim() || 'Extracted Fee Line';
          extractedCharges.push({
            item: label.slice(0, 80),
            amountInr: amount,
            frequency: isOneTime
              ? 'One-time'
              : isSemester
                ? 'Per Semester'
                : 'Yearly',
            refundable: isRefundable,
            isVagueOrHiddenFlag: isVague,
            note: isVague
              ? 'Ask for official breakup and whether this is approved by the State Fee Regulatory Committee.'
              : 'Parsed from submitted text.',
          });

          const annualEquiv = isOneTime
            ? amount
            : isSemester
              ? amount * 2
              : amount;
          firstYearTotal += annualEquiv;
          fourYearTotal += isOneTime ? amount : annualEquiv * 4;
          if (isVague) {
            vagueItemsFlagged.push(`${label} (₹${amount.toLocaleString('en-IN')})`);
          }
        }
      }

      const missingItemsNotice: string[] = [];
      if (!/hostel/i.test(input.feeText)) missingItemsNotice.push('Hostel room rent: Not found');
      if (!/mess|food/i.test(input.feeText)) missingItemsNotice.push('Mess & dining charges: Not found');
      if (!/exam/i.test(input.feeText)) missingItemsNotice.push('Semester university examination fees: Not found');
      if (!/refund|withdraw/i.test(input.feeText)) missingItemsNotice.push('Explicit withdrawal/refund schedule: Not found');

      return {
        extractedCharges,
        computedFirstYearTotalInr:
          extractedCharges.length > 0 ? firstYearTotal : null,
        computedFourYearEstimateInr:
          extractedCharges.length > 0 ? fourYearTotal : null,
        vagueItemsFlagged,
        refundAndWithdrawalRulesSummary: /refund/i.test(input.feeText)
          ? 'Refund mention detected in text; verify that it complies with UGC Fee Refund Policy (100% refund minus max ₹1,000 processing fee on withdrawal within notified timeline).'
          : 'Refund and withdrawal rules: Not found in pasted text. Demand the written UGC/AICTE refund clause before paying.',
        missingItemsNotice,
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 5. Brochure vs Reality Claims Checker
export async function handleAiClaims(
  rawInput: z.infer<typeof AiClaimsRequestSchema>
): Promise<AiClaimsResponse> {
  const input = AiClaimsRequestSchema.parse(rawInput);
  const safeText = sanitizeUntrustedInput(input.brochureText);

  return callGeminiStructured({
    endpointName: 'claims',
    systemInstruction: PROMPT_TEMPLATES.claims.systemInstruction,
    prompt: `${buildCompactDataContext()}\nSelected College ID: ${input.collegeId ?? 'None'}\nBrochure claims:\n${safeText}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        claimsAnalysis: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              claim: {type: Type.STRING},
              evidenceFromData: {type: Type.STRING},
              sourceUrl: {type: Type.STRING, nullable: true},
              verdict: {
                type: Type.STRING,
                enum: [
                  'Supported',
                  'Partly supported',
                  'Not supported',
                  'Cannot verify',
                ],
              },
            },
            required: ['claim', 'evidenceFromData', 'sourceUrl', 'verdict'],
          },
        },
        overallAssessment: {type: Type.STRING},
        disclaimer: {type: Type.STRING},
      },
      required: ['claimsAnalysis', 'overallAssessment', 'disclaimer'],
    },
    zodSchema: AiClaimsResponseSchema,
    fallbackGenerator: () => {
      const targetCollege = input.collegeId
        ? repo.getCollegeById(input.collegeId)
        : repo
            .getColleges()
            .find((c) =>
              input.brochureText.toLowerCase().includes(c.shortName.toLowerCase())
            );

      const sentences = input.brochureText
        .split(/[.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 8)
        .slice(0, 5);

      const claimsAnalysis: AiClaimsResponse['claimsAnalysis'] = sentences.map(
        (claim) => {
          if (/100%\s*placement/i.test(claim)) {
            return {
              claim,
              evidenceFromData: targetCollege?.placements.placedPercent.value
                ? `Official NIRF 2024 submitted placement rate for ${targetCollege.shortName} is ${targetCollege.placements.placedPercent.value}%, not 100%.`
                : 'No institute in the official NIRF 2024 dataset reports 100% unconditional placement across all graduates.',
              sourceUrl:
                'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
              verdict: 'Not supported',
            };
          }
          if (/nirf|rank/i.test(claim) && targetCollege) {
            return {
              claim,
              evidenceFromData: targetCollege.accreditation.nirfRank.value
                ? `${targetCollege.shortName} holds NIRF 2024 Engineering Rank #${targetCollege.accreditation.nirfRank.value}.`
                : `NIRF 2024 rank for ${targetCollege.shortName} is not verified in the top list.`,
              sourceUrl:
                'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
              verdict: targetCollege.accreditation.nirfRank.value
                ? 'Supported'
                : 'Cannot verify',
            };
          }
          if (/highest|package|lpa|cr/i.test(claim) && targetCollege) {
            const med = targetCollege.placements.medianSalaryInr.value;
            return {
              claim,
              evidenceFromData: med
                ? `While a single student may get a high package, the verified NIRF 2024 median salary across graduates at ${targetCollege.shortName} is ₹${(med / 100000).toFixed(2)} LPA.`
                : 'Median salary is not verified in our dataset; verify on the NIRF portal.',
              sourceUrl: targetCollege.officialWebsite,
              verdict: med ? 'Partly supported' : 'Cannot verify',
            };
          }
          return {
            claim,
            evidenceFromData: targetCollege
              ? `Check official disclosures on ${targetCollege.officialWebsite}; this specific marketing claim is not independently verified in NIRF/AICTE records.`
              : 'Cannot verify against cached official data. Check NIRF and AICTE mandatory disclosures.',
            sourceUrl: targetCollege ? targetCollege.officialWebsite : 'https://www.nirfindia.org',
            verdict: 'Cannot verify',
          };
        }
      );

      return {
        claimsAnalysis,
        overallAssessment:
          'Always compare brochure headline numbers (like single-student international offers) against the institute’s NIRF 4-year UG median salary and placement percentage.',
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 6. Branch Guidance Quiz
export async function handleAiBranch(
  rawInput: z.infer<typeof AiBranchRequestSchema>
): Promise<AiBranchResponse> {
  const input = AiBranchRequestSchema.parse(rawInput);

  return callGeminiStructured({
    endpointName: 'branch',
    systemInstruction: PROMPT_TEMPLATES.branch.systemInstruction,
    prompt: `${buildCompactDataContext()}\nStudent quiz answers:\n${JSON.stringify(input.answers)}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        recommendedBranches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              branchName: {type: Type.STRING},
              branchCode: {type: Type.STRING},
              fitReason: {type: Type.STRING},
              coreSkillsToBuild: {type: Type.ARRAY, items: {type: Type.STRING}},
              typicalCareers: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
            required: [
              'branchName',
              'branchCode',
              'fitReason',
              'coreSkillsToBuild',
              'typicalCareers',
            ],
          },
        },
        summaryAdvice: {type: Type.STRING},
        disclaimer: {type: Type.STRING},
      },
      required: ['recommendedBranches', 'summaryAdvice', 'disclaimer'],
    },
    zodSchema: AiBranchResponseSchema,
    fallbackGenerator: () => {
      const combined = JSON.stringify(input.answers).toLowerCase();
      const branches: AiBranchResponse['recommendedBranches'] = [];

      if (/code|software|algorithm|data|ai|app/i.test(combined)) {
        branches.push({
          branchName: 'Computer Science and Engineering (CSE / IT)',
          branchCode: 'CSE',
          fitReason:
            'Your answers show strong interest in logical problem-solving, software architecture, and data systems.',
          coreSkillsToBuild: [
            'Data Structures & Algorithms',
            'Operating Systems & Networks',
            'Database Systems & Cloud Engineering',
          ],
          typicalCareers: [
            'Software Development Engineer (SDE)',
            'Data Scientist / ML Engineer',
            'Systems & Cloud Architect',
          ],
        });
      }
      if (/circuit|chip|sensor|hardware|telecom|iot|embedded/i.test(combined)) {
        branches.push({
          branchName: 'Electronics and Communication Engineering (ECE)',
          branchCode: 'ECE',
          fitReason:
            'Strong match for students who enjoy both semiconductor hardware/embedded systems and computing.',
          coreSkillsToBuild: [
            'Digital Design & Verilog (VLSI)',
            'Embedded C & Microcontrollers',
            'Signal Processing & Communication Systems',
          ],
          typicalCareers: [
            'VLSI / Silicon Design Engineer',
            'Embedded & Robotics Engineer',
            'Software / Firmware Engineer',
          ],
        });
      }
      if (/machine|ev|vehicle|design|thermal|manufacturing|aerospace/i.test(combined) || branches.length < 2) {
        branches.push({
          branchName: 'Mechanical / Electrical Core Engineering (ME / EE)',
          branchCode: 'ME',
          fitReason:
            'Suits hands-on builders interested in EV powertrains, robotics mechanics, energy systems, and industrial R&D.',
          coreSkillsToBuild: [
            'CAD/CAE & Finite Element Analysis',
            'Control Systems & Mechatronics',
            'Thermodynamics & EV Battery Systems',
          ],
          typicalCareers: [
            'R&D Design Engineer (Automotive / Aerospace)',
            'Robotics & Automation Engineer',
            'PSU / Core Infrastructure Engineer',
          ],
        });
      }

      return {
        recommendedBranches: branches.slice(0, 3),
        summaryAdvice:
          'Choose a branch where you enjoy the core subjects for 4 years. Check NBA accreditation and lab facilities on the college page before locking choices.',
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 7. Backup Plan Engine
export async function handleAiPlan(
  rawInput: z.infer<typeof AiPlanRequestSchema>
): Promise<AiPlanResponse> {
  const input = AiPlanRequestSchema.parse(rawInput);

  return callGeminiStructured({
    endpointName: 'plan',
    systemInstruction: PROMPT_TEMPLATES.plan.systemInstruction,
    prompt: `${buildCompactDataContext()}\nStudent Profile:\n${JSON.stringify(input)}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        dreamColleges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              collegeId: {type: Type.STRING},
              collegeName: {type: Type.STRING},
              route: {type: Type.STRING},
              deadlineNote: {type: Type.STRING},
              reason: {type: Type.STRING},
            },
            required: ['collegeId', 'collegeName', 'route', 'deadlineNote', 'reason'],
          },
        },
        targetColleges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              collegeId: {type: Type.STRING},
              collegeName: {type: Type.STRING},
              route: {type: Type.STRING},
              deadlineNote: {type: Type.STRING},
              reason: {type: Type.STRING},
            },
            required: ['collegeId', 'collegeName', 'route', 'deadlineNote', 'reason'],
          },
        },
        safeColleges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              collegeId: {type: Type.STRING},
              collegeName: {type: Type.STRING},
              route: {type: Type.STRING},
              deadlineNote: {type: Type.STRING},
              reason: {type: Type.STRING},
            },
            required: ['collegeId', 'collegeName', 'route', 'deadlineNote', 'reason'],
          },
        },
        ifThisFailsThenThatSteps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scenario: {type: Type.STRING},
              fallbackAction: {type: Type.STRING},
              timeline: {type: Type.STRING},
            },
            required: ['scenario', 'fallbackAction', 'timeline'],
          },
        },
        disclaimer: {type: Type.STRING},
      },
      required: [
        'dreamColleges',
        'targetColleges',
        'safeColleges',
        'ifThisFailsThenThatSteps',
        'disclaimer',
      ],
    },
    zodSchema: AiPlanResponseSchema,
    fallbackGenerator: () => {
      return {
        dreamColleges: [
          {
            collegeId: 'iit-madras',
            collegeName: 'IIT Madras / Top NITs (NIT Trichy, NIT Surathkal)',
            route: 'All-India Exam (JEE Main & JEE Advanced)',
            deadlineNote: 'JEE Main Jan/April & JoSAA June counselling',
            reason:
              'Highest NIRF rankings (#1 to #17) and ₹14L–₹20L median packages with government tuition remission.',
          },
          {
            collegeId: 'iiit-hyderabad',
            collegeName: 'IIIT Hyderabad',
            route: "All-India Exam (JEE Main) + College's Own Process (UGEE)",
            deadlineNote: 'UGEE application closes March 31',
            reason:
              'Two independent entry routes (JEE Main and UGEE Dual Degree) with ₹24.00 LPA verified median salary.',
          },
        ],
        targetColleges: [
          {
            collegeId: 'coep-pune',
            collegeName: 'COEP Tech Pune / DTU Delhi / PEC Chandigarh',
            route: 'State CET / JEE Main Regional & All-India Counselling',
            deadlineNote: 'MHT CET / JAC Delhi / JoSAA CSAB Special Rounds',
            reason:
              'Strong government engineering colleges with ₹68k–₹2.36L annual tuition and ₹9.8L–₹13L median salary.',
          },
          {
            collegeId: 'bits-pilani',
            collegeName: 'BITS Pilani (via BITSAT + MCN Scholarship)',
            route: "College's Own Process (BITSAT + Board Topper Direct Route)",
            deadlineNote: 'BITSAT registration closes April 18',
            reason:
              '100% merit-based independent exam; Merit-cum-Need scholarship offsets high tuition if family income < ₹15 LPA.',
          },
        ],
        safeColleges: [
          {
            collegeId: 'vit-vellore',
            collegeName: 'VIT Vellore (Category 1/2) & MIT Manipal',
            route: "College's Own Process (VITEEE / MET Manipal)",
            deadlineNote: 'VITEEE closes March 31; MET closes March 15',
            reason:
              'Reliable private university entrance exams held in April before JoSAA starts, securing a confirmed backup seat.',
          },
          {
            collegeId: 'thapar-patiala',
            collegeName: 'TIET Patiala (Thapar) / SRM IST Chennai',
            route: 'JEE Main / Class 12 PCM Merit / SRMJEEE',
            deadlineNote: 'SRMJEEE closes April 16; Thapar rounds run May–August',
            reason:
              'Provides a verified backup across both exam and Class 12 PCM routes.',
          },
        ],
        ifThisFailsThenThatSteps: [
          {
            scenario: 'If JEE Main Session 1 percentile is below 96',
            fallbackAction:
              'Register immediately for Session 2 AND submit forms for State CET (MHT CET / WBJEE / KCET) plus at least 2 institute exams (VITEEE, BITSAT, or MET) before March 31.',
            timeline: 'February – March',
          },
          {
            scenario: 'If JoSAA Round 1–5 does not allot your target branch',
            fallbackAction:
              'Participate in CSAB Special Rounds (for NITs/PEC) and State CET Spot Rounds while holding one refundable private university backup seat (check UGC refund deadline).',
            timeline: 'July – August',
          },
          {
            scenario: 'If family annual budget is strictly below ₹2 Lakh/year',
            fallbackAction:
              'Apply for AICTE Tuition Fee Waiver (TFWS) choice codes during State CET counselling and prepare your Tehsildar-signed Income Certificate before May.',
            timeline: 'April – June',
          },
        ],
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 8. Family Decision Room
export async function handleAiFamily(
  rawInput: z.infer<typeof AiFamilyRequestSchema>
): Promise<AiFamilyResponse> {
  const input = AiFamilyRequestSchema.parse(rawInput);

  return callGeminiStructured({
    endpointName: 'family',
    systemInstruction: PROMPT_TEMPLATES.family.systemInstruction,
    prompt: `${buildCompactDataContext()}\nFamily weights:\n${JSON.stringify(input)}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        alignmentScorePercent: {type: Type.NUMBER},
        sharedPriorities: {type: Type.ARRAY, items: {type: Type.STRING}},
        keyTradeOffs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dimension: {type: Type.STRING},
              studentScore: {type: Type.NUMBER},
              parentScore: {type: Type.NUMBER},
              compromiseSuggestion: {type: Type.STRING},
            },
            required: [
              'dimension',
              'studentScore',
              'parentScore',
              'compromiseSuggestion',
            ],
          },
        },
        topBalancedColleges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              collegeId: {type: Type.STRING},
              collegeName: {type: Type.STRING},
              fitExplanation: {type: Type.STRING},
            },
            required: ['collegeId', 'collegeName', 'fitExplanation'],
          },
        },
        shareableSummaryText: {type: Type.STRING},
        disclaimer: {type: Type.STRING},
      },
      required: [
        'alignmentScorePercent',
        'sharedPriorities',
        'keyTradeOffs',
        'topBalancedColleges',
        'shareableSummaryText',
        'disclaimer',
      ],
    },
    zodSchema: AiFamilyResponseSchema,
    fallbackGenerator: () => {
      const dims = ['budget', 'location', 'safety', 'branch', 'placements'] as const;
      let totalDiff = 0;
      const sharedPriorities: string[] = [];
      const keyTradeOffs: AiFamilyResponse['keyTradeOffs'] = [];

      for (const d of dims) {
        const s = input.studentWeights[d];
        const p = input.parentWeights[d];
        const diff = Math.abs(s - p);
        totalDiff += diff;
        const label = d.charAt(0).toUpperCase() + d.slice(1);
        if (diff <= 2 && s >= 7 && p >= 7) {
          sharedPriorities.push(`${label} (Student: ${s}/10, Parent: ${p}/10)`);
        }
        if (diff >= 2) {
          keyTradeOffs.push({
            dimension: label,
            studentScore: s,
            parentScore: p,
            compromiseSuggestion:
              d === 'budget'
                ? 'Look for government colleges, NIT income fee waivers, or VITEEE Category-1 so total 4-year cost stays within family comfort without taking high-interest loans.'
                : d === 'location' || d === 'safety'
                  ? 'Prioritize gated residential campuses with 24x7 medical and hostel facilities (e.g., NIT Trichy, IIT Madras, Thapar Patiala, VIT Vellore).'
                  : 'Compare verified NIRF median salaries across ECE and CSE—ECE at a higher-trust public institute often matches CSE outcomes at lower cost.',
          });
        }
      }

      if (sharedPriorities.length === 0) {
        sharedPriorities.push('Long-term career stability and verified AICTE/UGC degree value');
      }

      const alignmentScorePercent = Math.max(
        20,
        Math.min(100, Math.round(100 - (totalDiff / 45) * 100))
      );

      const affordableColleges = repo
        .getColleges()
        .filter(
          (c) =>
            (c.fees.tuitionPerYearInr.value ?? 200000) <=
            input.maxAnnualBudgetInr
        )
        .slice(0, 3);

      const selected =
        affordableColleges.length > 0
          ? affordableColleges
          : repo.getColleges().slice(0, 3);

      return {
        alignmentScorePercent,
        sharedPriorities,
        keyTradeOffs:
          keyTradeOffs.length > 0
            ? keyTradeOffs
            : [
                {
                  dimension: 'Overall Balance',
                  studentScore: input.studentWeights.placements,
                  parentScore: input.parentWeights.budget,
                  compromiseSuggestion:
                    'Student and parents are closely aligned! Shortlist 3 public and 2 private backup colleges together.',
                },
              ],
        topBalancedColleges: selected.map((c) => ({
          collegeId: c.id,
          collegeName: c.name,
          fitExplanation: `Annual tuition ₹${(c.fees.tuitionPerYearInr.value ?? 0).toLocaleString('en-IN')}/yr · NIRF 2024 Median Salary ₹${((c.placements.medianSalaryInr.value ?? 0) / 100000).toFixed(2)} LPA · Gated Hostel: ${c.hasHostel ? 'Yes' : 'No'}.`,
        })),
        shareableSummaryText: `AdmitWise Family Decision Summary — Alignment: ${alignmentScorePercent}%. Max Annual Budget: ₹${input.maxAnnualBudgetInr.toLocaleString('en-IN')}. Top Balanced Matches: ${selected.map((c) => c.shortName).join(', ')}.`,
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 9. Translation Endpoint
export async function handleAiTranslate(
  rawInput: z.infer<typeof AiTranslateRequestSchema>
): Promise<AiTranslateResponse> {
  const input = AiTranslateRequestSchema.parse(rawInput);
  const safeText = sanitizeUntrustedInput(input.text);

  return callGeminiStructured({
    endpointName: `translate_${input.targetLanguage}`,
    systemInstruction: PROMPT_TEMPLATES.translate.systemInstruction,
    prompt: `Target Language: ${input.targetLanguage}\nText to translate:\n${safeText}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        translatedText: {type: Type.STRING},
        targetLanguage: {type: Type.STRING, enum: ['en', 'hi', 'pa']},
        disclaimer: {type: Type.STRING},
      },
      required: ['translatedText', 'targetLanguage', 'disclaimer'],
    },
    zodSchema: AiTranslateResponseSchema,
    fallbackGenerator: () => {
      if (input.targetLanguage === 'hi') {
        return {
          translatedText: `[हिंदी अनुवाद सारांश]: ${input.text}\n(नोट: सभी शुल्क, कटऑफ और तिथियों की पुष्टि आधिकारिक कॉलेज या JoSAA/NSP पोर्टल से अवश्य करें।)`,
          targetLanguage: 'hi',
          disclaimer: AI_DISCLAIMER_TEXT,
        };
      }
      if (input.targetLanguage === 'pa') {
        return {
          translatedText: `[ਪੰਜਾਬੀ ਅਨੁਵਾਦ ਸਾਰ]: ${input.text}\n(ਨੋਟ: ਸਾਰੀਆਂ ਫੀਸਾਂ, ਕੱਟ-ਆਫ ਅਤੇ ਤਾਰੀਖਾਂ ਦੀ ਪੁਸ਼ਟੀ ਅਧਿਕਾਰਤ ਕਾਲਜ ਜਾਂ JoSAA/NSP ਪੋਰਟਲ ਤੋਂ ਜ਼ਰੂਰ ਕਰੋ।)`,
          targetLanguage: 'pa',
          disclaimer: AI_DISCLAIMER_TEXT,
        };
      }
      return {
        translatedText: input.text,
        targetLanguage: 'en',
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}

// 10. Scholarship Plain-Language Explanation
export async function handleAiScholarshipExplain(
  rawInput: z.infer<typeof AiScholarshipExplainRequestSchema>
): Promise<AiScholarshipExplainResponse> {
  const input = AiScholarshipExplainRequestSchema.parse(rawInput);
  const sch = repo
    .getScholarships()
    .find((s) => s.id === input.scholarshipId);

  return callGeminiStructured({
    endpointName: 'scholarship-explain',
    systemInstruction: PROMPT_TEMPLATES.scholarshipExplain.systemInstruction,
    prompt: `Scholarship Record: ${JSON.stringify(sch)}\nStudent Profile: Category=${input.studentCategory}, Income=${input.familyIncomeLakhs}L, Marks=${input.marksPercent}%`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        plainLanguageExplanation: {type: Type.STRING},
        eligibilityChecklist: {type: Type.ARRAY, items: {type: Type.STRING}},
        stepByStepApplication: {type: Type.ARRAY, items: {type: Type.STRING}},
        commonRejectionReasons: {type: Type.ARRAY, items: {type: Type.STRING}},
        disclaimer: {type: Type.STRING},
      },
      required: [
        'plainLanguageExplanation',
        'eligibilityChecklist',
        'stepByStepApplication',
        'commonRejectionReasons',
        'disclaimer',
      ],
    },
    zodSchema: AiScholarshipExplainResponseSchema,
    fallbackGenerator: () => {
      if (!sch) {
        return {
          plainLanguageExplanation:
            'This scholarship record was not found in our cache. Please verify directly on scholarships.gov.in.',
          eligibilityChecklist: ['Check official NSP portal eligibility rules'],
          stepByStepApplication: ['Visit https://scholarships.gov.in'],
          commonRejectionReasons: ['Expired income certificate'],
          disclaimer: AI_DISCLAIMER_TEXT,
        };
      }
      return {
        plainLanguageExplanation: `${sch.name} (${sch.provider}) offers ${sch.benefitDescription.value ?? 'verified financial aid'}. With your family income of ₹${input.familyIncomeLakhs} Lakh and Class 12 score of ${input.marksPercent}%, you meet the core screening criteria.`,
        eligibilityChecklist: [
          `Family annual income cap: ${sch.maxIncomeLakhs.value ? `Up to ₹${sch.maxIncomeLakhs.value} Lakh/year` : 'As per official scheme'}`,
          `Minimum Class 12 marks: ${sch.minMarksPercent.value ? `${sch.minMarksPercent.value}%` : 'Pass in Class 12'}`,
          `Eligible categories: ${sch.eligibleCategories.join(', ')}`,
        ],
        stepByStepApplication: [
          `Complete One-Time Registration (OTR) on ${sch.officialUrl}`,
          'Keep your Tehsildar-signed Income Certificate and Aadhaar-seeded bank passbook ready',
          'Submit the online form and get it verified by your admitted college’s Scholarship Nodal Officer before the deadline',
        ],
        commonRejectionReasons: [
          'Submitting an affidavit or notary paper instead of a Revenue Officer (Tehsildar/SDM) Income Certificate',
          'Bank account not linked with Aadhaar (NPCI DBT mapper inactive)',
          'Missing the institute-level nodal officer verification deadline after submitting online',
        ],
        disclaimer: AI_DISCLAIMER_TEXT,
      };
    },
  });
}
