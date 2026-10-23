import { describe, expect, it } from 'vitest';
import {
  calculateEducationLoanEmi,
  calculateRoiScore,
  calculateTrue4YearCost,
  classifyEligibility,
} from '../server-lib/analysis/calculators';
import { evaluateReviewAuthenticity } from '../server-lib/analysis/reviewAuthenticity';
import {
  AiBranchResponseSchema,
  AiChatResponseSchema,
  AiClaimsResponseSchema,
  AiFeesResponseSchema,
  AiPitchResponseSchema,
  AiVerifyResponseSchema,
  CollegeSchema,
  CutoffRecordSchema,
  ExamSchema,
  ScholarshipSchema,
} from '../shared/schemas';
import {
  SEED_COLLEGES,
  SEED_CUTOFFS,
  SEED_EXAMS,
  SEED_SCHOLARSHIPS,
} from '../shared/seed-data';

describe('AdmitWise Core Analysis & Schema Suite', () => {
  describe('1. 4-Year True Cost Calculator', () => {
    it('accurately computes 4-year tuition, hostel, mess, one-time fees, and hidden buffers', () => {
      const result = calculateTrue4YearCost({
        tuitionPerYearInr: 150000,
        hostelPerYearInr: 45000,
        messPerYearInr: 35000,
        examAndLabPerYearInr: 10000,
        oneTimeAdmissionInr: 15000,
        booksAndSuppliesPerYearInr: 12000,
        travelPerYearInr: 10000,
        miscPerYearInr: 8000,
        annualFeeIncreasePercent: 0,
        scholarshipPerYearInr: 20000,
      });

      expect(result.totalTuition4Years).toBe(600000);
      expect(result.totalScholarship4Years).toBe(80000);
      expect(result.grandTotal4YearsInr).toBeGreaterThan(900000);
      expect(result.yearlyBreakdown).toHaveLength(4);
    });
  });

  describe('2. ROI & Payback Period Calculator', () => {
    it('computes payback years, EMI, and ROI rating', () => {
      const roi = calculateRoiScore({
        total4YearCostInr: 600000,
        medianAnnualSalaryInr: 1200000,
      });

      expect(roi.paybackPeriodYears).toBe(0.5);
      expect(roi.roiRating).toBe('High Value');

      const emi = calculateEducationLoanEmi(400000, 8.5, 7);
      expect(emi.monthlyEmiInr).toBeGreaterThan(0);
      expect(emi.totalPayableInr).toBeGreaterThan(400000);
    });
  });

  describe('3. Rank-Based Eligibility Classifier', () => {
    it('classifies student ranks into Safe, Target, and Ambitious tiers', () => {
      const results = classifyEligibility(
        {
          examId: 'jee-main',
          metricValue: 800,
          category: 'GEN',
        },
        SEED_CUTOFFS
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.classification === 'Safe')).toBe(true);
    });
  });

  describe('4. Review Authenticity Scoring', () => {
    it('scores specific, balanced student reviews higher than generic promotional text', () => {
      const authenticScore = evaluateReviewAuthenticity({
        shortSnippet:
          'CSE semester 5 labs and coding culture are solid. Hostel mess food is average on weekends, but median placement was around 14 LPA.',
        rating: 4,
        date: '2024-11-15',
        source: 'Reddit r/Btechtards',
      });

      const promotionalScore = evaluateReviewAuthenticity({
        shortSnippet:
          'Best college in the world!!! 100% placement guaranteed! Apply now!',
        rating: 5,
        date: '2024-11-15',
        source: 'Agent Blog',
      });

      expect(authenticScore.score).toBeGreaterThan(promotionalScore.score);
      expect(authenticScore.isAboveThreshold).toBe(true);
      expect(promotionalScore.isAboveThreshold).toBe(false);
    });
  });

  describe('5. Zod Schemas Against Seed Data', () => {
    it('validates all 15 seed colleges, 15 exams, 6 scholarships, and 14 cutoff records', () => {
      expect(SEED_COLLEGES.length).toBeGreaterThanOrEqual(15);
      for (const college of SEED_COLLEGES) {
        const parsed = CollegeSchema.safeParse(college);
        expect(parsed.success).toBe(true);
      }

      expect(SEED_EXAMS.length).toBeGreaterThanOrEqual(15);
      for (const exam of SEED_EXAMS) {
        const parsed = ExamSchema.safeParse(exam);
        expect(parsed.success).toBe(true);
      }

      expect(SEED_SCHOLARSHIPS.length).toBeGreaterThanOrEqual(6);
      for (const sch of SEED_SCHOLARSHIPS) {
        const parsed = ScholarshipSchema.safeParse(sch);
        expect(parsed.success).toBe(true);
      }

      expect(SEED_CUTOFFS.length).toBeGreaterThanOrEqual(10);
      for (const cutoff of SEED_CUTOFFS) {
        const parsed = CutoffRecordSchema.safeParse(cutoff);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('6. AI Response Validators', () => {
    it('validates structured AI output schemas with sample payloads', () => {
      expect(
        AiChatResponseSchema.safeParse({
          answer: 'NIT Trichy has an official tuition fee of ₹1,25,000 per year.',
          citedSources: [{ name: 'NIRF 2024', url: 'https://www.nirfindia.org' }],
          suggestedFollowUps: ['Check hostel fees'],
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);

      expect(
        AiVerifyResponseSchema.safeParse({
          riskLevel: 'High',
          matchedCollegeName: null,
          approvalStatusSummary: 'Unverified agent claim.',
          redFlagsDetected: ['100% placement guarantee'],
          aiExplanation: 'Do not pay cash.',
          nextSteps: ['Check UGC list'],
          officialPortalsToVerify: [{ name: 'UGC', url: 'https://www.ugc.gov.in' }],
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);

      expect(
        AiPitchResponseSchema.safeParse({
          riskLevel: 'High',
          pressureTactics: ['Urgency'],
          claimsVsData: [{ claim: '50L average', factInDataset: 'Median is 8L' }],
          redFlags: ['Personal UPI'],
          questionsToAskBack: ['Share NIRF PDF'],
          summary: 'High risk pitch.',
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);

      expect(
        AiFeesResponseSchema.safeParse({
          extractedCharges: [
            {
              item: 'Tuition Fee',
              amountInr: 150000,
              frequency: 'Yearly',
              refundable: 'No',
              isVagueOrHiddenFlag: false,
              note: 'Official fee',
            },
          ],
          computedFirstYearTotalInr: 150000,
          computedFourYearEstimateInr: 600000,
          vagueItemsFlagged: [],
          refundAndWithdrawalRulesSummary: 'As per UGC norms.',
          missingItemsNotice: [],
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);

      expect(
        AiClaimsResponseSchema.safeParse({
          claimsAnalysis: [
            {
              claim: '100% placement',
              evidenceFromData: 'NIRF shows 88%',
              sourceUrl: 'https://www.nirfindia.org',
              verdict: 'Not supported',
            },
          ],
          overallAssessment: 'Check official NIRF filing.',
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);

      expect(
        AiBranchResponseSchema.safeParse({
          recommendedBranches: [
            {
              branchName: 'Computer Science and Engineering',
              branchCode: 'CSE',
              fitReason: 'Strong interest in algorithms.',
              coreSkillsToBuild: ['DSA', 'OS'],
              typicalCareers: ['Software Engineer'],
            },
          ],
          summaryAdvice: 'Explore CSE and ECE.',
          disclaimer: 'AI-generated guidance. Verify with the official college or portal.',
        }).success
      ).toBe(true);
    });
  });
});
