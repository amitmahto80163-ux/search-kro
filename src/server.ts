import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, {NextFunction, Request, Response} from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as cron from 'node-cron';
import {join} from 'node:path';
import {ZodError, z} from 'zod';
import {PLATFORM_FEE_INR} from './shared/constants';
import {
  AiBranchRequestSchema,
  AiChatRequestSchema,
  AiClaimsRequestSchema,
  AiFamilyRequestSchema,
  AiFeesRequestSchema,
  AiPitchRequestSchema,
  AiPlanRequestSchema,
  AiScholarshipExplainRequestSchema,
  AiTranslateRequestSchema,
  AiVerifyRequestSchema,
  ApplicationStageSchema,
  CostCalculationRequestSchema,
  EligibilityRequestSchema,
  RoiCalculationRequestSchema,
  ScholarshipMatchRequestSchema,
} from './shared/schemas';
import {
  calculateRoiScore,
  calculateTrue4YearCost,
  classifyEligibility,
  matchScholarships,
} from './server-lib/analysis/calculators';
import {RANKING_FORMULAS_DOCUMENTATION} from './server-lib/analysis/ranking';
import {summarizeAuthenticReviewsByCategory} from './server-lib/analysis/reviewAuthenticity';
import {
  handleAiBranch,
  handleAiChat,
  handleAiClaims,
  handleAiFamily,
  handleAiFees,
  handleAiPitch,
  handleAiPlan,
  handleAiScholarshipExplain,
  handleAiTranslate,
  handleAiVerify,
} from './server-lib/ai/gemini';
import {repo} from './server-lib/repository/jsonRepo';
import {
  buildPanIndiaCollegeRecord,
  PanIndiaCollegeSeedInput,
} from './shared/pan-india-colleges';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// Trust reverse proxy headers in Cloud Run / containerized preview environments
app.set('trust proxy', 1);
const angularApp = new AngularNodeAppEngine();

// Security headers (configured for iframe preview compatibility)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

// Configured CORS for API routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Request size limit (500kb to support bulk AICTE/AISHE/NIRF college imports)
app.use(express.json({limit: '500kb'}));

// Rate limiters (validate: false avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR & ERR_ERL_FORWARDED_HEADER behind Cloud Run proxies)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again in a few minutes.',
    },
  },
});

const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI rate limit reached. Cached guidance remains available.',
    },
  },
});

app.use('/api', apiLimiter);
app.use('/api/ai', aiLimiter);

// Schedule monthly college refresh & weekly exam deadline refresh via node-cron (skip on serverless)
if (!process.env['VERCEL']) {
  try {
    cron.schedule('0 3 1 * *', () => {
      repo.bootstrapFilesIfNeeded();
    });
    cron.schedule('0 4 * * 1', () => {
      repo.bootstrapFilesIfNeeded();
    });
  } catch {
    // Ignore cron registration errors in serverless environments
  }
}

// --- Core Data Endpoints ---

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    meta: repo.getMeta(),
  });
});

app.get('/api/meta', (_req: Request, res: Response) => {
  res.json({
    meta: repo.getMeta(),
    rankingFormulas: RANKING_FORMULAS_DOCUMENTATION,
    fraudStats: repo.getAggregatedFraudStats(),
  });
});

app.get('/api/colleges', (_req: Request, res: Response) => {
  res.json({
    colleges: repo.getColleges(),
    lastRefreshed: repo.getMeta().lastRefreshed,
  });
});

app.get('/api/colleges/:id', (req: Request, res: Response) => {
  const college = repo.getCollegeById(String(req.params['id']));
  if (!college) {
    res.status(404).json({
      error: {
        code: 'COLLEGE_NOT_FOUND',
        message: 'College not found in verified dataset.',
      },
    });
    return;
  }
  const reviewCategorySummaries = summarizeAuthenticReviewsByCategory(
    college.reviews
  );
  res.json({
    college,
    reviewCategorySummaries,
    rankingFormulas: RANKING_FORMULAS_DOCUMENTATION,
  });
});

// Option 3: On-Demand Live College Lookup & Auto-Add for Any College in India
const LiveCollegeLookupSchema = z.object({
  name: z.string().min(3).max(200),
  shortName: z.string().min(2).max(50).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  ownership: z.enum(['Government', 'Private', 'Public-Private']),
  officialWebsite: z.string().url().optional(),
  nirfRank: z.number().int().min(1).max(500).nullable().optional(),
  tuitionPerYearInr: z.number().min(0).max(2500000).nullable().optional(),
  medianSalaryInr: z.number().min(0).max(10000000).nullable().optional(),
  examName: z.string().min(2).max(120).optional(),
});

app.post(
  '/api/colleges/lookup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = LiveCollegeLookupSchema.parse(req.body);
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);

      // Check if already in dataset by ID or case-insensitive name
      const existing = repo
        .getColleges()
        .find(
          (c) =>
            c.id === slug ||
            c.name.toLowerCase() === input.name.trim().toLowerCase()
        );
      if (existing) {
        res.json({
          college: existing,
          added: false,
          totalColleges: repo.getColleges().length,
          message: `${existing.name} is already in the verified Pan-India directory.`,
        });
        return;
      }

      const shortName =
        input.shortName?.trim() ||
        input.name
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('')
          .slice(0, 10) ||
        input.city;

      const seedInput: PanIndiaCollegeSeedInput = {
        id: slug || `college-${Date.now()}`,
        name: input.name.trim(),
        shortName: `${shortName} ${input.city}`.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        ownership: input.ownership,
        officialWebsite:
          input.officialWebsite || 'https://www.aicte-india.org',
        nirfRank: input.nirfRank ?? null,
        naacGrade: null,
        tuitionPerYearInr: input.tuitionPerYearInr ?? null,
        hostelPerYearInr: null,
        medianSalaryInr: input.medianSalaryInr ?? null,
        placementRatePercent: null,
        routeType:
          input.ownership === 'Government' ? 'national_exam' : 'college_process',
        examName:
          input.examName ||
          (input.ownership === 'Government'
            ? 'JEE Main / State CET Counselling'
            : 'State CET / Institute Merit Process'),
        counsellingPortalUrl:
          input.officialWebsite || 'https://josaa.nic.in',
      };

      const builtCollege = buildPanIndiaCollegeRecord(seedInput);
      const allColleges = repo.upsertColleges([builtCollege]);

      res.status(201).json({
        college: builtCollege,
        added: true,
        totalColleges: allColleges.length,
        message: `Added ${builtCollege.name} (${builtCollege.cityInfo.city}, ${builtCollege.cityInfo.state}) to the Pan-India directory. Unverified figures are explicitly marked "Not verified, check the official site".`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Option 1: Bulk Import Pipeline for AICTE / AISHE / NIRF College Rows
const BulkCollegeImportSchema = z.object({
  colleges: z
    .array(
      z.object({
        id: z.string().min(2).max(80).optional(),
        name: z.string().min(3).max(200),
        shortName: z.string().min(2).max(60).optional(),
        city: z.string().min(2).max(80),
        state: z.string().min(2).max(80),
        ownership: z.enum(['Government', 'Private', 'Public-Private']),
        officialWebsite: z.string().url().optional(),
        nirfRank: z.number().int().min(1).max(500).nullable().optional(),
        naacGrade: z.string().max(15).nullable().optional(),
        tuitionPerYearInr: z.number().min(0).max(2500000).nullable().optional(),
        hostelPerYearInr: z.number().min(0).max(1000000).nullable().optional(),
        medianSalaryInr: z.number().min(0).max(10000000).nullable().optional(),
        placementRatePercent: z.number().min(0).max(100).nullable().optional(),
        examName: z.string().max(120).optional(),
      })
    )
    .min(1)
    .max(200),
});

app.post(
  '/api/colleges/import',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = BulkCollegeImportSchema.parse(req.body);
      const builtRecords = parsed.colleges.map((row) => {
        const slug =
          row.id ||
          row.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60);
        return buildPanIndiaCollegeRecord({
          id: slug,
          name: row.name.trim(),
          shortName: row.shortName?.trim() || row.name.trim().slice(0, 24),
          city: row.city.trim(),
          state: row.state.trim(),
          ownership: row.ownership,
          officialWebsite:
            row.officialWebsite || 'https://www.aicte-india.org',
          nirfRank: row.nirfRank ?? null,
          naacGrade: row.naacGrade ?? null,
          tuitionPerYearInr: row.tuitionPerYearInr ?? null,
          hostelPerYearInr: row.hostelPerYearInr ?? null,
          medianSalaryInr: row.medianSalaryInr ?? null,
          placementRatePercent: row.placementRatePercent ?? null,
          routeType:
            row.ownership === 'Government' ? 'national_exam' : 'college_process',
          examName:
            row.examName ||
            (row.ownership === 'Government'
              ? 'JEE Main / State CET'
              : 'State CET / University Entrance'),
          counsellingPortalUrl:
            row.officialWebsite || 'https://www.aicte-india.org',
        });
      });

      const updatedAll = repo.upsertColleges(builtRecords);
      res.status(201).json({
        importedCount: builtRecords.length,
        totalColleges: updatedAll.length,
        colleges: updatedAll,
        message: `Successfully imported ${builtRecords.length} colleges into the Pan-India dataset with source badges and unbiased ranking scores.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.get('/api/exams', (_req: Request, res: Response) => {
  res.json({
    exams: repo.getExams(),
    lastRefreshed: repo.getMeta().lastRefreshed,
  });
});

app.get('/api/scholarships', (_req: Request, res: Response) => {
  res.json({
    scholarships: repo.getScholarships(),
    lastRefreshed: repo.getMeta().lastRefreshed,
  });
});

app.get('/api/cutoffs', (_req: Request, res: Response) => {
  res.json({
    cutoffs: repo.getCutoffs(),
    lastRefreshed: repo.getMeta().lastRefreshed,
  });
});

// --- Deterministic Calculation Endpoints ---

app.post('/api/eligibility', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = EligibilityRequestSchema.parse(req.body);
    const results = classifyEligibility(input, repo.getCutoffs());
    res.json({
      results,
      disclaimer:
        'Guidance only based on previous-year closing ranks/percentiles. Never a guarantee of admission.',
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/costs', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CostCalculationRequestSchema.parse(req.body);
    const result = calculateTrue4YearCost(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/roi', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = RoiCalculationRequestSchema.parse(req.body);
    const result = calculateRoiScore(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post(
  '/api/scholarships/match',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = ScholarshipMatchRequestSchema.parse(req.body);
      const matches = matchScholarships(input, repo.getScholarships());
      res.json({
        matches,
        count: matches.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// --- AI Endpoints (Server-Side Only, Cached & Validated) ---

app.post(
  '/api/ai/chat',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiChatRequestSchema.parse(req.body);
      const out = await handleAiChat(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiVerifyRequestSchema.parse(req.body);
      const out = await handleAiVerify(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/pitch',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiPitchRequestSchema.parse(req.body);
      const out = await handleAiPitch(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/fees',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiFeesRequestSchema.parse(req.body);
      const out = await handleAiFees(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/claims',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiClaimsRequestSchema.parse(req.body);
      const out = await handleAiClaims(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/branch',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiBranchRequestSchema.parse(req.body);
      const out = await handleAiBranch(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/plan',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiPlanRequestSchema.parse(req.body);
      const out = await handleAiPlan(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/family',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiFamilyRequestSchema.parse(req.body);
      const out = await handleAiFamily(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/translate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiTranslateRequestSchema.parse(req.body);
      const out = await handleAiTranslate(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  '/api/ai/scholarship-explain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = AiScholarshipExplainRequestSchema.parse(req.body);
      const out = await handleAiScholarshipExplain(input);
      res.json(out);
    } catch (err) {
      next(err);
    }
  }
);

// --- Applications, Fraud Reports, Alerts & Reminders Endpoints ---

const CreateApplicationInputSchema = z.object({
  deviceId: z.string().min(4).max(120),
  studentName: z.string().min(2).max(120),
  studentCategory: z.string().min(1).max(30),
  homeState: z.string().min(2).max(60),
  preferredBranch: z.string().min(2).max(80),
  partnerCollegeIds: z.array(z.string()).min(1),
  consentConfirmed: z.literal(true),
});

app.post(
  '/api/applications',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = CreateApplicationInputSchema.parse(req.body);
      const allColleges = repo.getColleges();
      const selectedPartners = allColleges.filter(
        (c) => input.partnerCollegeIds.includes(c.id) && c.isPartner
      );
      if (selectedPartners.length === 0) {
        res.status(400).json({
          error: {
            code: 'NO_PARTNER_COLLEGES',
            message:
              'Common Application is only supported for verified Partner Colleges.',
          },
        });
        return;
      }

      const collegeFeesTotalInr = selectedPartners.reduce((sum, c) => {
        const fee = c.admissionRoutes[0]?.applicationFeeInr.value ?? 1500;
        return sum + fee;
      }, 0);

      const now = new Date().toISOString();
      const created = repo.createApplication({
        id: `APP-${Date.now().toString(36).toUpperCase()}`,
        deviceId: input.deviceId,
        studentName: input.studentName,
        studentCategory: input.studentCategory,
        homeState: input.homeState,
        preferredBranch: input.preferredBranch,
        partnerCollegeIds: selectedPartners.map((c) => c.id),
        partnerCollegeNames: selectedPartners.map((c) => c.shortName),
        collegeFeesTotalInr,
        platformFeePostAdmissionInr: PLATFORM_FEE_INR,
        status: 'Submitted',
        submittedAt: now,
        updatedAt: now,
        timeline: [
          {
            stage: 'Submitted',
            date: now.slice(0, 10),
            note: `Simulated Common Application submitted to ${selectedPartners.map((c) => c.shortName).join(', ')}. ₹0 charged by platform upfront.`,
          },
        ],
      });

      res.status(201).json({application: created});
    } catch (err) {
      next(err);
    }
  }
);

app.get('/api/applications/:deviceId', (req: Request, res: Response) => {
  const deviceId = String(req.params['deviceId']);
  res.json({
    applications: repo.getApplicationsByDevice(deviceId),
  });
});

const PatchApplicationStatusSchema = z.object({
  deviceId: z.string().min(4),
  status: ApplicationStageSchema,
  note: z.string().max(400).optional(),
});

app.patch(
  '/api/applications/:id/status',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params['id']);
      const input = PatchApplicationStatusSchema.parse(req.body);
      const updated = repo.updateApplicationStatus(
        id,
        input.deviceId,
        input.status,
        input.note || `Stage updated to ${input.status}`
      );
      if (!updated) {
        res.status(404).json({
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Application record not found for this device.',
          },
        });
        return;
      }
      res.json({application: updated});
    } catch (err) {
      next(err);
    }
  }
);

const CreateFraudReportSchema = z.object({
  type: z.enum([
    'Fake Agent / Guaranteed Seat Scam',
    'Unapproved Institute Claim',
    'Hidden Fee / Original Document Retention',
    'Misleading Placement Brochure',
  ]),
  entityType: z.enum(['College', 'Consultancy / Agent', 'Website / Portal']),
  stateOrCity: z.string().min(2).max(100),
  details: z.string().min(10).max(2000),
  evidenceSnippet: z.string().max(1000).optional(),
});

app.post('/api/reports', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateFraudReportSchema.parse(req.body);
    const stats = repo.addFraudReport({
      id: `REP-${Date.now().toString(36).toUpperCase()}`,
      type: input.type,
      entityType: input.entityType,
      stateOrCity: input.stateOrCity,
      details: input.details,
      evidenceSnippet: input.evidenceSnippet,
      createdAt: new Date().toISOString(),
      status: 'Pending Review',
    });
    res.status(201).json({
      message:
        'Thank you. Your report is stored privately for compliance review. Only anonymised aggregate counts are shown publicly.',
      stats,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/reports/stats', (_req: Request, res: Response) => {
  res.json(repo.getAggregatedFraudStats());
});

const SubscribeAlertSchema = z.object({
  deviceId: z.string().min(4),
  collegeId: z.string().min(1),
  branchCode: z.string().min(1),
  counsellingRound: z.enum([
    'JoSAA / CSAB Special Round',
    'State CET Spot Round',
    'Institute Internal Sliding / Vacancy Round',
  ]),
  channel: z.enum([
    'Browser Notification',
    'Simulated WhatsApp',
    'Simulated SMS',
  ]),
});

app.post(
  '/api/alerts/subscribe',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = SubscribeAlertSchema.parse(req.body);
      const list = repo.addSeatAlertSubscription({
        id: `ALT-${Date.now().toString(36).toUpperCase()}`,
        ...input,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({subscriptions: list});
    } catch (err) {
      next(err);
    }
  }
);

app.get('/api/alerts/:deviceId', (req: Request, res: Response) => {
  res.json({
    subscriptions: repo.getSeatAlertsByDevice(String(req.params['deviceId'])),
  });
});

const SubscribeReminderSchema = z.object({
  deviceId: z.string().min(4),
  examOrEventId: z.string().min(1),
  title: z.string().min(2).max(160),
  date: z.string().min(4).max(40),
  channel: z.enum([
    'Browser Notification',
    'Simulated WhatsApp',
    'Simulated SMS',
  ]),
  optInConfirmed: z.literal(true),
});

app.post(
  '/api/reminders/subscribe',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = SubscribeReminderSchema.parse(req.body);
      const list = repo.addReminderSubscription({
        id: `REM-${Date.now().toString(36).toUpperCase()}`,
        ...input,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({reminders: list});
    } catch (err) {
      next(err);
    }
  }
);

app.get('/api/reminders/:deviceId', (req: Request, res: Response) => {
  res.json({
    reminders: repo.getRemindersByDevice(String(req.params['deviceId'])),
  });
});

app.delete('/api/user-data/:deviceId', (req: Request, res: Response) => {
  const deviceId = String(req.params['deviceId']);
  repo.deleteDeviceData(deviceId);
  res.json({
    deleted: true,
    message: 'All server-side records associated with your anonymous device ID have been permanently deleted.',
  });
});

// Centralised API error handler
app.use(
  '/api',
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues
            .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
            .join('; '),
        },
      });
      return;
    }
    const message =
      err instanceof Error ? err.message : 'An unexpected server error occurred.';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
    });
  }
);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
