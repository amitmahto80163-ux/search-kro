import {Injectable, signal} from '@angular/core';
import {PLATFORM_FEE_INR} from '../../shared/constants';
import {
  AiBranchResponse,
  AiChatResponse,
  AiClaimsResponse,
  AiFamilyResponse,
  AiFeesResponse,
  AiPitchResponse,
  AiPlanResponse,
  AiScholarshipExplainResponse,
  AiTranslateResponse,
  AiVerifyResponse,
  ApplicationRecord,
  ApplicationStage,
  College,
  CostCalculationRequest,
  CostCalculationResponse,
  CutoffRecord,
  EligibilityRequest,
  EligibilityResultItem,
  Exam,
  MetaInfo,
  ReminderSubscription,
  RoiCalculationRequest,
  RoiCalculationResponse,
  Scholarship,
  ScholarshipMatchRequest,
  SeatAlertSubscription,
} from '../../shared/schemas';
import {
  SEED_COLLEGES,
  SEED_CUTOFFS,
  SEED_EXAMS,
  SEED_META,
  SEED_ROOMMATES,
  SEED_SCHOLARSHIPS,
  SEED_SENIORS,
} from '../../shared/seed-data';
import {
  calculateRoiScore,
  calculateTrue4YearCost,
  classifyEligibility,
  matchScholarships,
} from '../../server-lib/analysis/calculators';
import {RANKING_FORMULAS_DOCUMENTATION} from '../../server-lib/analysis/ranking';
import {
  CategoryReviewSummary,
  summarizeAuthenticReviewsByCategory,
} from '../../server-lib/analysis/reviewAuthenticity';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

@Injectable({providedIn: 'root'})
export class ApiService {
  readonly isOfflineDemoMode = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly errorState = signal<string | null>(null);

  readonly colleges = signal<College[]>(SEED_COLLEGES);
  readonly exams = signal<Exam[]>(SEED_EXAMS);
  readonly scholarships = signal<Scholarship[]>(SEED_SCHOLARSHIPS);
  readonly cutoffs = signal<CutoffRecord[]>(SEED_CUTOFFS);
  readonly meta = signal<MetaInfo>(SEED_META);
  readonly seniors = signal(SEED_SENIORS);
  readonly roommates = signal(SEED_ROOMMATES);
  readonly rankingFormulas = signal(RANKING_FORMULAS_DOCUMENTATION);
  readonly fraudStats = signal<{
    totalReports: number;
    byType: Record<string, number>;
  }>({
    totalReports: 2,
    byType: {
      'Fake Agent / Guaranteed Seat Scam': 1,
      'Hidden Fee / Original Document Retention': 1,
    },
  });

  readonly toasts = signal<ToastMessage[]>([]);

  showToast(
    text: string,
    type: ToastMessage['type'] = 'info',
    durationMs = 4000
  ): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.toasts.update((list) => [...list, {id, type, text}]);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.dismissToast(id);
      }, durationMs);
    }
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private async requestJson<T>(
    url: string,
    options?: RequestInit,
    fallbackFn?: () => T
  ): Promise<T> {
    if (typeof window === 'undefined') {
      if (fallbackFn) return fallbackFn();
      throw new Error('SSR skip');
    }
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg =
          body?.error?.message || `Request failed with status ${response.status}`;
        throw new Error(msg);
      }
      this.isOfflineDemoMode.set(false);
      return (await response.json()) as T;
    } catch (err) {
      if (fallbackFn) {
        this.isOfflineDemoMode.set(true);
        return fallbackFn();
      }
      throw err;
    }
  }

  async initializeData(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.isLoading.set(true);
    this.errorState.set(null);
    try {
      const [metaRes, collegesRes, examsRes, schRes, cutoffsRes] =
        await Promise.all([
          this.requestJson('/api/meta', undefined, () => ({
            meta: SEED_META,
            rankingFormulas: RANKING_FORMULAS_DOCUMENTATION,
            fraudStats: this.fraudStats(),
          })),
          this.requestJson('/api/colleges', undefined, () => ({
            colleges: SEED_COLLEGES,
            lastRefreshed: SEED_META.lastRefreshed,
          })),
          this.requestJson('/api/exams', undefined, () => ({
            exams: SEED_EXAMS,
            lastRefreshed: SEED_META.lastRefreshed,
          })),
          this.requestJson('/api/scholarships', undefined, () => ({
            scholarships: SEED_SCHOLARSHIPS,
            lastRefreshed: SEED_META.lastRefreshed,
          })),
          this.requestJson('/api/cutoffs', undefined, () => ({
            cutoffs: SEED_CUTOFFS,
            lastRefreshed: SEED_META.lastRefreshed,
          })),
        ]);

      this.meta.set(metaRes.meta);
      this.rankingFormulas.set(metaRes.rankingFormulas);
      this.fraudStats.set(metaRes.fraudStats);
      this.colleges.set(collegesRes.colleges);
      this.exams.set(examsRes.exams);
      this.scholarships.set(schRes.scholarships);
      this.cutoffs.set(cutoffsRes.cutoffs);
    } catch (err) {
      this.errorState.set(
        err instanceof Error ? err.message : 'Unable to load initial data.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  getCollegeWithSummaries(id: string): {
    college: College | undefined;
    summaries: CategoryReviewSummary[];
  } {
    const college = this.colleges().find((c) => c.id === id);
    if (!college) {
      return {college: undefined, summaries: []};
    }
    return {
      college,
      summaries: summarizeAuthenticReviewsByCategory(college.reviews),
    };
  }

  async checkEligibility(
    payload: EligibilityRequest
  ): Promise<{results: EligibilityResultItem[]; disclaimer: string}> {
    return this.requestJson(
      '/api/eligibility',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        results: classifyEligibility(payload, this.cutoffs()),
        disclaimer:
          'Guidance only based on previous-year closing ranks/percentiles. Never a guarantee of admission.',
      })
    );
  }

  async calculateCosts(
    payload: CostCalculationRequest
  ): Promise<CostCalculationResponse> {
    return this.requestJson(
      '/api/costs',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => calculateTrue4YearCost(payload)
    );
  }

  async calculateRoi(
    payload: RoiCalculationRequest
  ): Promise<RoiCalculationResponse> {
    return this.requestJson(
      '/api/roi',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => calculateRoiScore(payload)
    );
  }

  async findMatchingScholarships(
    payload: ScholarshipMatchRequest
  ): Promise<{matches: Scholarship[]; count: number}> {
    return this.requestJson(
      '/api/scholarships/match',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const matches = matchScholarships(payload, this.scholarships());
        return {matches, count: matches.length};
      }
    );
  }

  // AI Endpoints with Offline Demo Fallbacks
  async askCounsellor(
    message: string,
    language: 'en' | 'hi' | 'pa'
  ): Promise<AiChatResponse> {
    return this.requestJson(
      '/api/ai/chat',
      {
        method: 'POST',
        body: JSON.stringify({message, language}),
      },
      () => ({
        answer: `[Demo Offline Guidance] Based on our verified dataset of 15 engineering colleges and 15 entrance exams: public institutes like Jadavpur University (₹2,400/yr tuition), COEP Pune (₹68,000/yr), and NIT Trichy (₹1.25L/yr with MoE income remission) provide the strongest ROI payback. Verify all details on official portals.`,
        citedSources: [
          {
            name: 'NIRF 2024 Engineering Rankings',
            url: 'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
          },
          {name: 'JoSAA Official Portal', url: 'https://josaa.nic.in'},
        ],
        suggestedFollowUps: [
          'Compare NIT Trichy and VIT Vellore',
          'Which scholarships match my family income?',
          'How do I spot a fake admission agent?',
        ],
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async verifyCollegeOrAgent(queryText: string): Promise<AiVerifyResponse> {
    return this.requestJson(
      '/api/ai/verify',
      {
        method: 'POST',
        body: JSON.stringify({queryText}),
      },
      () => ({
        riskLevel: /100%|guaranteed|agent|personal|urgent/i.test(queryText)
          ? 'High'
          : 'Medium',
        matchedCollegeName: null,
        approvalStatusSummary:
          '[Demo Offline Check] Always verify AICTE approval and UGC university status on official portals before paying any fee.',
        redFlagsDetected: [
          'Never transfer admission fees to a personal bank account or UPI ID.',
        ],
        aiExplanation:
          'Legitimate Indian engineering colleges admit students strictly through transparent merit counselling on official portals.',
        nextSteps: [
          'Check AICTE approved list at https://www.aicte-india.org',
          'Check UGC fake universities notice at https://www.ugc.gov.in',
        ],
        officialPortalsToVerify: [
          {name: 'AICTE Portal', url: 'https://www.aicte-india.org'},
          {name: 'UGC Portal', url: 'https://www.ugc.gov.in'},
        ],
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async analyzePitch(pitchText: string): Promise<AiPitchResponse> {
    return this.requestJson(
      '/api/ai/pitch',
      {
        method: 'POST',
        body: JSON.stringify({pitchText}),
      },
      () => ({
        riskLevel: 'High',
        pressureTactics: ['Artificial urgency / seat blocking pressure'],
        claimsVsData: [
          {
            claim: 'Headline placement / management seat promise',
            factInDataset:
              'Official NIRF 2024 median salaries are typically 30%–70% lower than headline highest packages.',
          },
        ],
        redFlags: ['Demanding non-refundable token money before official merit lists'],
        questionsToAskBack: [
          'Can you share the official NIRF 2024 DCS PDF showing the 4-year UG median salary?',
          'Will the receipt be issued directly on the university’s official .ac.in / .edu.in ERP portal?',
        ],
        summary:
          '[Demo Offline Analysis] High-pressure agent pitch detected. Do not pay token money.',
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async detectHiddenFees(feeText: string): Promise<AiFeesResponse> {
    return this.requestJson(
      '/api/ai/fees',
      {
        method: 'POST',
        body: JSON.stringify({feeText}),
      },
      () => ({
        extractedCharges: [
          {
            item: 'Parsed Tuition / Academic Fee',
            amountInr: 185000,
            frequency: 'Yearly',
            refundable: 'Conditional',
            isVagueOrHiddenFlag: false,
            note: 'Demo offline extraction',
          },
        ],
        computedFirstYearTotalInr: 185000,
        computedFourYearEstimateInr: 740000,
        vagueItemsFlagged: ['Check if development/ancillary charges are non-refundable'],
        refundAndWithdrawalRulesSummary:
          'Refund rules: Not found in text. Verify UGC Fee Refund Policy before paying.',
        missingItemsNotice: ['Hostel & mess charges: Not found'],
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async verifyBrochureClaims(
    brochureText: string,
    collegeId?: string
  ): Promise<AiClaimsResponse> {
    return this.requestJson(
      '/api/ai/claims',
      {
        method: 'POST',
        body: JSON.stringify({brochureText, collegeId}),
      },
      () => ({
        claimsAnalysis: [
          {
            claim: brochureText.slice(0, 100),
            evidenceFromData:
              'Compare headline claims against NIRF 2024 median salary and placement rate.',
            sourceUrl:
              'https://www.nirfindia.org/Rankings/2024/EngineeringRanking.html',
            verdict: 'Partly supported',
          },
        ],
        overallAssessment:
          '[Demo Offline Verdict] Always check official NIRF DCS filings rather than marketing brochures.',
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async getBranchGuidance(
    answers: {questionId: string; question: string; selectedOption: string}[]
  ): Promise<AiBranchResponse> {
    return this.requestJson(
      '/api/ai/branch',
      {
        method: 'POST',
        body: JSON.stringify({answers}),
      },
      () => ({
        recommendedBranches: [
          {
            branchName: 'Computer Science and Engineering (CSE)',
            branchCode: 'CSE',
            fitReason: 'Matches analytical, coding, and software systems interests.',
            coreSkillsToBuild: ['Algorithms', 'Systems', 'Databases'],
            typicalCareers: ['Software Engineer', 'Data Engineer'],
          },
          {
            branchName: 'Electronics and Communication Engineering (ECE)',
            branchCode: 'ECE',
            fitReason: 'Blends semiconductor hardware, embedded systems, and software.',
            coreSkillsToBuild: ['Digital Logic & VLSI', 'Embedded C', 'Signal Processing'],
            typicalCareers: ['VLSI Design Engineer', 'Embedded Developer'],
          },
        ],
        summaryAdvice:
          'Compare curriculum and NBA accreditation status on each college page.',
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async generateBackupPlan(payload: {
    budgetPerYearInr: number;
    preferredBranches: string[];
    preferredStates: string[];
    jeePercentileOrRank?: string;
    class12Percent?: number;
  }): Promise<AiPlanResponse> {
    return this.requestJson(
      '/api/ai/plan',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        dreamColleges: [
          {
            collegeId: 'nit-trichy',
            collegeName: 'NIT Trichy',
            route: 'All-India Exam (JEE Main + JoSAA)',
            deadlineNote: 'JoSAA June Counselling',
            reason: 'NIRF #9 public institute with strong ROI.',
          },
        ],
        targetColleges: [
          {
            collegeId: 'coep-pune',
            collegeName: 'COEP Tech Pune',
            route: 'MHT CET / JEE Main',
            deadlineNote: 'Maha CET CAP Rounds',
            reason: 'Government university with ₹68,000/yr tuition.',
          },
        ],
        safeColleges: [
          {
            collegeId: 'vit-vellore',
            collegeName: 'VIT Vellore',
            route: 'VITEEE Counselling',
            deadlineNote: 'VITEEE closes March 31',
            reason: 'Early merit exam backup before JoSAA starts.',
          },
        ],
        ifThisFailsThenThatSteps: [
          {
            scenario: 'If JEE Main rank is outside NIT CSE cutoff',
            fallbackAction:
              'Apply to State CET (COEP/Jadavpur) and VITEEE/MET before March 31.',
            timeline: 'March – April',
          },
        ],
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async evaluateFamilyDecision(payload: {
    studentWeights: {
      budget: number;
      location: number;
      safety: number;
      branch: number;
      placements: number;
    };
    parentWeights: {
      budget: number;
      location: number;
      safety: number;
      branch: number;
      placements: number;
    };
    maxAnnualBudgetInr: number;
  }): Promise<AiFamilyResponse> {
    return this.requestJson(
      '/api/ai/family',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        alignmentScorePercent: 80,
        sharedPriorities: ['Verified placements', 'Campus safety'],
        keyTradeOffs: [
          {
            dimension: 'Budget vs Private Tuition',
            studentScore: payload.studentWeights.budget,
            parentScore: payload.parentWeights.budget,
            compromiseSuggestion:
              'Prioritize public institutes or merit scholarships to keep 4-year cost comfortable.',
          },
        ],
        topBalancedColleges: [
          {
            collegeId: 'nit-trichy',
            collegeName: 'NIT Trichy',
            fitExplanation: 'Government fee structure with ₹15.76 LPA median salary.',
          },
        ],
        shareableSummaryText: 'Family Alignment Score: 80%.',
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async translateText(
    text: string,
    targetLanguage: 'en' | 'hi' | 'pa'
  ): Promise<AiTranslateResponse> {
    return this.requestJson(
      '/api/ai/translate',
      {
        method: 'POST',
        body: JSON.stringify({text, targetLanguage}),
      },
      () => ({
        translatedText: text,
        targetLanguage,
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  async explainScholarship(payload: {
    scholarshipId: string;
    studentCategory: string;
    familyIncomeLakhs: number;
    marksPercent: number;
  }): Promise<AiScholarshipExplainResponse> {
    return this.requestJson(
      '/api/ai/scholarship-explain',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        plainLanguageExplanation:
          'You meet the core family income and marks threshold for this verified scholarship.',
        eligibilityChecklist: [
          'Valid Revenue Officer (Tehsildar) Income Certificate',
          'Aadhaar-seeded Bank Account in student name',
        ],
        stepByStepApplication: ['Register on https://scholarships.gov.in'],
        commonRejectionReasons: ['Expired or notary-signed income certificate'],
        disclaimer:
          'AI-generated guidance. Verify with the official college or portal.',
      })
    );
  }

  // Persistence & Adapter Endpoints
  async submitCommonApplication(payload: {
    deviceId: string;
    studentName: string;
    studentCategory: string;
    homeState: string;
    preferredBranch: string;
    partnerCollegeIds: string[];
    consentConfirmed: true;
  }): Promise<{application: ApplicationRecord}> {
    return this.requestJson(
      '/api/applications',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const now = new Date().toISOString();
        const partnerNames = this.colleges()
          .filter((c) => payload.partnerCollegeIds.includes(c.id))
          .map((c) => c.shortName);
        return {
          application: {
            id: `APP-DEMO-${Date.now().toString(36).toUpperCase()}`,
            deviceId: payload.deviceId,
            studentName: payload.studentName,
            studentCategory: payload.studentCategory,
            homeState: payload.homeState,
            preferredBranch: payload.preferredBranch,
            partnerCollegeIds: payload.partnerCollegeIds,
            partnerCollegeNames: partnerNames,
            collegeFeesTotalInr: partnerNames.length * 1400,
            platformFeePostAdmissionInr: PLATFORM_FEE_INR,
            status: 'Submitted',
            submittedAt: now,
            updatedAt: now,
            timeline: [
              {
                stage: 'Submitted',
                date: now.slice(0, 10),
                note: 'Offline demo application recorded locally.',
              },
            ],
          },
        };
      }
    );
  }

  async getApplications(
    deviceId: string
  ): Promise<{applications: ApplicationRecord[]}> {
    return this.requestJson(
      `/api/applications/${encodeURIComponent(deviceId)}`,
      undefined,
      () => ({applications: []})
    );
  }

  async updateApplicationStatus(
    appId: string,
    deviceId: string,
    status: ApplicationStage,
    note?: string
  ): Promise<{application: ApplicationRecord}> {
    return this.requestJson(
      `/api/applications/${encodeURIComponent(appId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({deviceId, status, note}),
      }
    );
  }

  async submitFraudReport(payload: {
    type:
      | 'Fake Agent / Guaranteed Seat Scam'
      | 'Unapproved Institute Claim'
      | 'Hidden Fee / Original Document Retention'
      | 'Misleading Placement Brochure';
    entityType: 'College' | 'Consultancy / Agent' | 'Website / Portal';
    stateOrCity: string;
    details: string;
    evidenceSnippet?: string;
  }): Promise<{
    message: string;
    stats: {totalReports: number; byType: Record<string, number>};
  }> {
    const res = await this.requestJson(
      '/api/reports',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => {
        const current = this.fraudStats();
        const nextByType = {
          ...current.byType,
          [payload.type]: (current.byType[payload.type] || 0) + 1,
        };
        return {
          message:
            'Stored in offline demo mode. Only anonymised aggregate counts are shown publicly.',
          stats: {
            totalReports: current.totalReports + 1,
            byType: nextByType,
          },
        };
      }
    );
    this.fraudStats.set(res.stats);
    return res;
  }

  async subscribeSeatAlert(payload: {
    deviceId: string;
    collegeId: string;
    branchCode: string;
    counsellingRound:
      | 'JoSAA / CSAB Special Round'
      | 'State CET Spot Round'
      | 'Institute Internal Sliding / Vacancy Round';
    channel: 'Browser Notification' | 'Simulated WhatsApp' | 'Simulated SMS';
  }): Promise<{subscriptions: SeatAlertSubscription[]}> {
    return this.requestJson(
      '/api/alerts/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        subscriptions: [
          {
            id: `ALT-${Date.now()}`,
            ...payload,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );
  }

  async getSeatAlerts(
    deviceId: string
  ): Promise<{subscriptions: SeatAlertSubscription[]}> {
    return this.requestJson(
      `/api/alerts/${encodeURIComponent(deviceId)}`,
      undefined,
      () => ({subscriptions: []})
    );
  }

  async subscribeReminder(payload: {
    deviceId: string;
    examOrEventId: string;
    title: string;
    date: string;
    channel: 'Browser Notification' | 'Simulated WhatsApp' | 'Simulated SMS';
    optInConfirmed: true;
  }): Promise<{reminders: ReminderSubscription[]}> {
    return this.requestJson(
      '/api/reminders/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        reminders: [
          {
            id: `REM-${Date.now()}`,
            ...payload,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );
  }

  async getReminders(
    deviceId: string
  ): Promise<{reminders: ReminderSubscription[]}> {
    return this.requestJson(
      `/api/reminders/${encodeURIComponent(deviceId)}`,
      undefined,
      () => ({reminders: []})
    );
  }

  async deleteServerData(
    deviceId: string
  ): Promise<{deleted: boolean; message: string}> {
    return this.requestJson(
      `/api/user-data/${encodeURIComponent(deviceId)}`,
      {method: 'DELETE'},
      () => ({
        deleted: true,
        message: 'Local and demo data cleared.',
      })
    );
  }
}
