import {z} from 'zod';

export const ConfidenceSchema = z.enum([
  'official',
  'third-party',
  'estimated',
  'unverified',
]);
export type ConfidenceLevel = z.infer<typeof ConfidenceSchema>;

export function createSourcedSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    sourceName: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    lastVerified: z.string().nullable(),
    confidence: ConfidenceSchema,
  });
}

export interface SourcedField<T> {
  value: T | null;
  sourceName: string | null;
  sourceUrl: string | null;
  lastVerified: string | null;
  confidence: ConfidenceLevel;
}

export const SourcedNumberSchema = createSourcedSchema(z.number());
export const SourcedStringSchema = createSourcedSchema(z.string());
export const SourcedBooleanSchema = createSourcedSchema(z.boolean());
export const SourcedStringArraySchema = createSourcedSchema(z.array(z.string()));

export const AdmissionRouteTypeSchema = z.enum([
  'direct',
  'college_process',
  'national_exam',
]);
export type AdmissionRouteType = z.infer<typeof AdmissionRouteTypeSchema>;

export const AdmissionRouteSchema = z.object({
  routeType: AdmissionRouteTypeSchema,
  label: z.string(),
  examsAccepted: z.array(z.string()),
  explanation: SourcedStringSchema,
  applicationFeeInr: SourcedNumberSchema,
  officialAdmissionUrl: z.string().url(),
});
export type AdmissionRoute = z.infer<typeof AdmissionRouteSchema>;

export const CourseSchema = z.object({
  id: z.string(),
  name: z.string(),
  branchCode: z.string(),
  durationYears: z.number(),
  intakeSeats: SourcedNumberSchema,
  NBAStatus: SourcedBooleanSchema,
});
export type Course = z.infer<typeof CourseSchema>;

export const FeeStructureSchema = z.object({
  tuitionPerYearInr: SourcedNumberSchema,
  hostelPerYearInr: SourcedNumberSchema,
  messPerYearInr: SourcedNumberSchema,
  examAndLabPerYearInr: SourcedNumberSchema,
  oneTimeAdmissionInr: SourcedNumberSchema,
  cautionDepositRefundableInr: SourcedNumberSchema,
  scholarshipNote: SourcedStringSchema,
});
export type FeeStructure = z.infer<typeof FeeStructureSchema>;

export const PlacementSchema = z.object({
  year: z.number(),
  medianSalaryInr: SourcedNumberSchema,
  highestSalaryInr: SourcedNumberSchema,
  placedPercent: SourcedNumberSchema,
  topRecruiters: SourcedStringArraySchema,
});
export type Placement = z.infer<typeof PlacementSchema>;

export const AccreditationSchema = z.object({
  aicteApproved: SourcedBooleanSchema,
  ugcStatus: SourcedStringSchema,
  naacGrade: SourcedStringSchema,
  nbaAccreditedBranches: SourcedStringArraySchema,
  nirfRank: SourcedNumberSchema,
  nirfYear: z.number(),
});
export type Accreditation = z.infer<typeof AccreditationSchema>;

export const ReviewCategorySchema = z.enum([
  'placement',
  'hostel',
  'faculty',
  'campus',
  'fees',
]);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  collegeId: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  category: ReviewCategorySchema,
  shortSnippet: z.string().max(280),
  rating: z.number().min(1).max(5),
  date: z.string(),
  authenticityScore: z.number().min(0).max(100),
  flags: z.array(z.string()),
});
export type Review = z.infer<typeof ReviewSchema>;

export const CityInfoSchema = z.object({
  city: z.string(),
  state: z.string(),
  costOfLivingMonthlyInr: SourcedNumberSchema,
  hostelFeeRangeAnnualInr: SourcedStringSchema,
  transportNotes: SourcedStringSchema,
  safetyNotes: SourcedStringSchema,
});
export type CityInfo = z.infer<typeof CityInfoSchema>;

export const RankingMetricsSchema = z.object({
  affordabilityScore: z.number().min(0).max(100),
  placementStrengthScore: z.number().min(0).max(100),
  valueForMoneyScore: z.number().min(0).max(100),
  roiPaybackYears: z.number().nullable(),
  trustScore: z.number().min(0).max(100),
  overallFairScore: z.number().min(0).max(100),
  lastComputed: z.string(),
});
export type RankingMetrics = z.infer<typeof RankingMetricsSchema>;

export const CollegeSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  ownership: z.enum(['Government', 'Private', 'Public-Private']),
  establishedYear: SourcedNumberSchema,
  officialWebsite: z.string().url(),
  isPartner: z.boolean(),
  hasHostel: z.boolean(),
  cityInfo: CityInfoSchema,
  accreditation: AccreditationSchema,
  admissionRoutes: z.array(AdmissionRouteSchema),
  courses: z.array(CourseSchema),
  fees: FeeStructureSchema,
  placements: PlacementSchema,
  reviews: z.array(ReviewSchema),
  rankingMetrics: RankingMetricsSchema.optional(),
});
export type College = z.infer<typeof CollegeSchema>;

export const ExamStatusSchema = z.enum([
  'Upcoming',
  'Open',
  'Closing soon',
  'Closed',
]);
export type ExamStatus = z.infer<typeof ExamStatusSchema>;

export const ExamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  stream: z.enum(['Engineering', 'Architecture', 'Multi-Stream']),
  level: z.enum(['National', 'State', 'Institute']),
  conductingBody: z.string(),
  eligibility: SourcedStringSchema,
  minClass12Percent: SourcedNumberSchema,
  registrationStart: SourcedStringSchema,
  registrationEnd: SourcedStringSchema,
  examDate: SourcedStringSchema,
  officialUrl: z.string().url(),
  year: z.number(),
  applicationFeeGeneralInr: SourcedNumberSchema,
  status: ExamStatusSchema,
});
export type Exam = z.infer<typeof ExamSchema>;

export const ScholarshipSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  providerType: z.enum(['Central Govt', 'State Govt', 'AICTE', 'Institute']),
  maxIncomeLakhs: SourcedNumberSchema,
  minMarksPercent: SourcedNumberSchema,
  eligibleCategories: z.array(z.string()),
  eligibleGenders: z.array(z.string()),
  eligibleStates: z.array(z.string()),
  benefitDescription: SourcedStringSchema,
  annualAmountInr: SourcedNumberSchema,
  deadline: SourcedStringSchema,
  documentsNeeded: z.array(z.string()),
  officialUrl: z.string().url(),
});
export type Scholarship = z.infer<typeof ScholarshipSchema>;

export const CutoffRecordSchema = z.object({
  id: z.string(),
  collegeId: z.string(),
  collegeName: z.string(),
  branchCode: z.string(),
  branchName: z.string(),
  examId: z.string(),
  examName: z.string(),
  metricType: z.enum(['rank', 'percentile', 'score']),
  category: z.enum(['GEN', 'OBC-NCL', 'SC', 'ST', 'EWS']),
  year: z.number(),
  closingValue: SourcedNumberSchema,
});
export type CutoffRecord = z.infer<typeof CutoffRecordSchema>;

export const SeniorProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  collegeId: z.string(),
  collegeName: z.string(),
  branch: z.string(),
  yearOfStudy: z.string(),
  homeState: z.string(),
  languages: z.array(z.string()),
  topics: z.array(z.string()),
  shortBio: z.string(),
  isDemo: z.literal(true),
});
export type SeniorProfile = z.infer<typeof SeniorProfileSchema>;

export const RoommateProfileSchema = z.object({
  id: z.string(),
  alias: z.string(),
  targetCity: z.string(),
  targetCollegeId: z.string(),
  homeState: z.string(),
  sleepSchedule: z.enum(['Early Bird', 'Night Owl', 'Flexible']),
  studyHabit: z.enum(['Quiet Room', 'Library Studier', 'Group Discussion']),
  foodPreference: z.enum(['Veg', 'Non-Veg', 'Flexible']),
  budgetMonthlyInr: z.number(),
  languages: z.array(z.string()),
  isDemo: z.literal(true),
});
export type RoommateProfile = z.infer<typeof RoommateProfileSchema>;

export const MetaSchema = z.object({
  lastRefreshed: z.string(),
  datasetType: z.enum(['sample', 'live-refreshed']),
  refreshScheduleCron: z.string(),
  examRefreshScheduleCron: z.string(),
  totalColleges: z.number(),
  totalExams: z.number(),
  totalScholarships: z.number(),
});
export type MetaInfo = z.infer<typeof MetaSchema>;

// Persistence Schemas
export const ApplicationStageSchema = z.enum([
  'Submitted',
  'Document Check',
  'Counselling / Merit Review',
  'Offer Released',
  'Admission Confirmed',
]);
export type ApplicationStage = z.infer<typeof ApplicationStageSchema>;

export const ApplicationRecordSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  studentName: z.string(),
  studentCategory: z.string(),
  homeState: z.string(),
  preferredBranch: z.string(),
  partnerCollegeIds: z.array(z.string()),
  partnerCollegeNames: z.array(z.string()),
  collegeFeesTotalInr: z.number(),
  platformFeePostAdmissionInr: z.number(),
  status: ApplicationStageSchema,
  submittedAt: z.string(),
  updatedAt: z.string(),
  timeline: z.array(
    z.object({
      stage: z.string(),
      date: z.string(),
      note: z.string(),
    })
  ),
});
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>;

export const FraudReportSchema = z.object({
  id: z.string(),
  type: z.enum([
    'Fake Agent / Guaranteed Seat Scam',
    'Unapproved Institute Claim',
    'Hidden Fee / Original Document Retention',
    'Misleading Placement Brochure',
  ]),
  entityType: z.enum(['College', 'Consultancy / Agent', 'Website / Portal']),
  stateOrCity: z.string(),
  details: z.string().min(10).max(2000),
  evidenceSnippet: z.string().max(1000).optional(),
  createdAt: z.string(),
  status: z.enum(['Pending Review', 'Aggregated']),
});
export type FraudReport = z.infer<typeof FraudReportSchema>;

export const SeatAlertSubscriptionSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  collegeId: z.string(),
  branchCode: z.string(),
  counsellingRound: z.enum([
    'JoSAA / CSAB Special Round',
    'State CET Spot Round',
    'Institute Internal Sliding / Vacancy Round',
  ]),
  channel: z.enum(['Browser Notification', 'Simulated WhatsApp', 'Simulated SMS']),
  createdAt: z.string(),
});
export type SeatAlertSubscription = z.infer<typeof SeatAlertSubscriptionSchema>;

export const ReminderSubscriptionSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  examOrEventId: z.string(),
  title: z.string(),
  date: z.string(),
  channel: z.enum(['Browser Notification', 'Simulated WhatsApp', 'Simulated SMS']),
  optInConfirmed: z.boolean(),
  createdAt: z.string(),
});
export type ReminderSubscription = z.infer<typeof ReminderSubscriptionSchema>;

// Calculator & API Request/Response Schemas
export const EligibilityRequestSchema = z.object({
  examId: z.string().min(1),
  metricValue: z.number().positive(),
  category: z.enum(['GEN', 'OBC-NCL', 'SC', 'ST', 'EWS']),
  branchCode: z.string().optional(),
});
export type EligibilityRequest = z.infer<typeof EligibilityRequestSchema>;

export const EligibilityResultItemSchema = z.object({
  collegeId: z.string(),
  collegeName: z.string(),
  branchCode: z.string(),
  branchName: z.string(),
  examName: z.string(),
  metricType: z.enum(['rank', 'percentile', 'score']),
  closingValue: z.number().nullable(),
  sourceName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  lastVerified: z.string().nullable(),
  classification: z.enum(['Safe', 'Target', 'Ambitious', 'Cutoff Not Verified']),
  explanation: z.string(),
});
export type EligibilityResultItem = z.infer<typeof EligibilityResultItemSchema>;

export const CostCalculationRequestSchema = z.object({
  collegeId: z.string().optional(),
  tuitionPerYearInr: z.number().min(0),
  hostelPerYearInr: z.number().min(0),
  messPerYearInr: z.number().min(0),
  examAndLabPerYearInr: z.number().min(0),
  oneTimeAdmissionInr: z.number().min(0),
  booksAndSuppliesPerYearInr: z.number().min(0),
  travelPerYearInr: z.number().min(0),
  miscPerYearInr: z.number().min(0),
  annualFeeIncreasePercent: z.number().min(0).max(25).default(0),
  scholarshipPerYearInr: z.number().min(0).default(0),
});
export type CostCalculationRequest = z.infer<typeof CostCalculationRequestSchema>;

export const CostCalculationResponseSchema = z.object({
  yearlyBreakdown: z.array(
    z.object({
      year: z.number(),
      tuition: z.number(),
      livingAndHostel: z.number(),
      examBooksTravelMisc: z.number(),
      oneTime: z.number(),
      scholarshipDeduction: z.number(),
      netYearCost: z.number(),
    })
  ),
  totalTuition4Years: z.number(),
  totalLiving4Years: z.number(),
  totalOther4Years: z.number(),
  totalOneTime: z.number(),
  totalScholarship4Years: z.number(),
  grandTotal4YearsInr: z.number(),
});
export type CostCalculationResponse = z.infer<typeof CostCalculationResponseSchema>;

export const RoiCalculationRequestSchema = z.object({
  total4YearCostInr: z.number().positive(),
  medianAnnualSalaryInr: z.number().nullable(),
});
export type RoiCalculationRequest = z.infer<typeof RoiCalculationRequestSchema>;

export const RoiCalculationResponseSchema = z.object({
  total4YearCostInr: z.number(),
  medianAnnualSalaryInr: z.number().nullable(),
  paybackPeriodYears: z.number().nullable(),
  roiRating: z.enum(['High Value', 'Moderate Payback', 'Long Payback', 'Cannot Compute']),
  formula: z.string(),
  caveat: z.string(),
});
export type RoiCalculationResponse = z.infer<typeof RoiCalculationResponseSchema>;

export const ScholarshipMatchRequestSchema = z.object({
  category: z.string(),
  marksPercent: z.number().min(0).max(100),
  familyIncomeLakhs: z.number().min(0),
  state: z.string(),
  gender: z.string(),
});
export type ScholarshipMatchRequest = z.infer<typeof ScholarshipMatchRequestSchema>;

// AI Endpoint Schemas
export const AiChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  language: z.enum(['en', 'hi', 'pa']).default('en'),
});
export const AiChatResponseSchema = z.object({
  answer: z.string(),
  citedSources: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    })
  ),
  suggestedFollowUps: z.array(z.string()),
  disclaimer: z.string(),
});
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;

export const AiVerifyRequestSchema = z.object({
  queryText: z.string().min(2).max(8000),
});
export const AiVerifyResponseSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  matchedCollegeName: z.string().nullable(),
  approvalStatusSummary: z.string(),
  redFlagsDetected: z.array(z.string()),
  aiExplanation: z.string(),
  nextSteps: z.array(z.string()),
  officialPortalsToVerify: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    })
  ),
  disclaimer: z.string(),
});
export type AiVerifyResponse = z.infer<typeof AiVerifyResponseSchema>;

export const AiPitchRequestSchema = z.object({
  pitchText: z.string().min(5).max(8000),
});
export const AiPitchResponseSchema = z.object({
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  pressureTactics: z.array(z.string()),
  claimsVsData: z.array(
    z.object({
      claim: z.string(),
      factInDataset: z.string(),
    })
  ),
  redFlags: z.array(z.string()),
  questionsToAskBack: z.array(z.string()),
  summary: z.string(),
  disclaimer: z.string(),
});
export type AiPitchResponse = z.infer<typeof AiPitchResponseSchema>;

export const AiFeesRequestSchema = z.object({
  feeText: z.string().min(5).max(8000),
});
export const AiFeesResponseSchema = z.object({
  extractedCharges: z.array(
    z.object({
      item: z.string(),
      amountInr: z.number().nullable(),
      frequency: z.enum(['One-time', 'Yearly', 'Per Semester', 'Not specified']),
      refundable: z.enum(['Yes', 'No', 'Conditional', 'Not found']),
      isVagueOrHiddenFlag: z.boolean(),
      note: z.string(),
    })
  ),
  computedFirstYearTotalInr: z.number().nullable(),
  computedFourYearEstimateInr: z.number().nullable(),
  vagueItemsFlagged: z.array(z.string()),
  refundAndWithdrawalRulesSummary: z.string(),
  missingItemsNotice: z.array(z.string()),
  disclaimer: z.string(),
});
export type AiFeesResponse = z.infer<typeof AiFeesResponseSchema>;

export const AiClaimsRequestSchema = z.object({
  collegeId: z.string().optional(),
  brochureText: z.string().min(5).max(8000),
});
export const AiClaimsResponseSchema = z.object({
  claimsAnalysis: z.array(
    z.object({
      claim: z.string(),
      evidenceFromData: z.string(),
      sourceUrl: z.string().nullable(),
      verdict: z.enum([
        'Supported',
        'Partly supported',
        'Not supported',
        'Cannot verify',
      ]),
    })
  ),
  overallAssessment: z.string(),
  disclaimer: z.string(),
});
export type AiClaimsResponse = z.infer<typeof AiClaimsResponseSchema>;

export const AiBranchRequestSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        question: z.string(),
        selectedOption: z.string(),
      })
    )
    .min(1)
    .max(12),
});
export const AiBranchResponseSchema = z.object({
  recommendedBranches: z.array(
    z.object({
      branchName: z.string(),
      branchCode: z.string(),
      fitReason: z.string(),
      coreSkillsToBuild: z.array(z.string()),
      typicalCareers: z.array(z.string()),
    })
  ),
  summaryAdvice: z.string(),
  disclaimer: z.string(),
});
export type AiBranchResponse = z.infer<typeof AiBranchResponseSchema>;

export const AiPlanRequestSchema = z.object({
  budgetPerYearInr: z.number().positive(),
  preferredBranches: z.array(z.string()),
  preferredStates: z.array(z.string()),
  jeePercentileOrRank: z.string().optional(),
  class12Percent: z.number().min(0).max(100).optional(),
});
export const AiPlanResponseSchema = z.object({
  dreamColleges: z.array(
    z.object({
      collegeId: z.string(),
      collegeName: z.string(),
      route: z.string(),
      deadlineNote: z.string(),
      reason: z.string(),
    })
  ),
  targetColleges: z.array(
    z.object({
      collegeId: z.string(),
      collegeName: z.string(),
      route: z.string(),
      deadlineNote: z.string(),
      reason: z.string(),
    })
  ),
  safeColleges: z.array(
    z.object({
      collegeId: z.string(),
      collegeName: z.string(),
      route: z.string(),
      deadlineNote: z.string(),
      reason: z.string(),
    })
  ),
  ifThisFailsThenThatSteps: z.array(
    z.object({
      scenario: z.string(),
      fallbackAction: z.string(),
      timeline: z.string(),
    })
  ),
  disclaimer: z.string(),
});
export type AiPlanResponse = z.infer<typeof AiPlanResponseSchema>;

export const AiFamilyRequestSchema = z.object({
  studentWeights: z.object({
    budget: z.number().min(1).max(10),
    location: z.number().min(1).max(10),
    safety: z.number().min(1).max(10),
    branch: z.number().min(1).max(10),
    placements: z.number().min(1).max(10),
  }),
  parentWeights: z.object({
    budget: z.number().min(1).max(10),
    location: z.number().min(1).max(10),
    safety: z.number().min(1).max(10),
    branch: z.number().min(1).max(10),
    placements: z.number().min(1).max(10),
  }),
  maxAnnualBudgetInr: z.number().positive(),
});
export const AiFamilyResponseSchema = z.object({
  alignmentScorePercent: z.number().min(0).max(100),
  sharedPriorities: z.array(z.string()),
  keyTradeOffs: z.array(
    z.object({
      dimension: z.string(),
      studentScore: z.number(),
      parentScore: z.number(),
      compromiseSuggestion: z.string(),
    })
  ),
  topBalancedColleges: z.array(
    z.object({
      collegeId: z.string(),
      collegeName: z.string(),
      fitExplanation: z.string(),
    })
  ),
  shareableSummaryText: z.string(),
  disclaimer: z.string(),
});
export type AiFamilyResponse = z.infer<typeof AiFamilyResponseSchema>;

export const AiTranslateRequestSchema = z.object({
  text: z.string().min(1).max(8000),
  targetLanguage: z.enum(['en', 'hi', 'pa']),
});
export const AiTranslateResponseSchema = z.object({
  translatedText: z.string(),
  targetLanguage: z.enum(['en', 'hi', 'pa']),
  disclaimer: z.string(),
});
export type AiTranslateResponse = z.infer<typeof AiTranslateResponseSchema>;

export const AiScholarshipExplainRequestSchema = z.object({
  scholarshipId: z.string(),
  studentCategory: z.string(),
  familyIncomeLakhs: z.number(),
  marksPercent: z.number(),
});
export const AiScholarshipExplainResponseSchema = z.object({
  plainLanguageExplanation: z.string(),
  eligibilityChecklist: z.array(z.string()),
  stepByStepApplication: z.array(z.string()),
  commonRejectionReasons: z.array(z.string()),
  disclaimer: z.string(),
});
export type AiScholarshipExplainResponse = z.infer<
  typeof AiScholarshipExplainResponseSchema
>;
