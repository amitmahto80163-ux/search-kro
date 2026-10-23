import {
  CostCalculationRequest,
  CostCalculationResponse,
  CutoffRecord,
  EligibilityRequest,
  EligibilityResultItem,
  RoiCalculationRequest,
  RoiCalculationResponse,
  Scholarship,
  ScholarshipMatchRequest,
} from '../../shared/schemas';

export function calculateTrue4YearCost(
  req: CostCalculationRequest
): CostCalculationResponse {
  const yearlyBreakdown: CostCalculationResponse['yearlyBreakdown'] = [];
  let totalTuition4Years = 0;
  let totalLiving4Years = 0;
  let totalOther4Years = 0;
  const totalOneTime = Math.round(req.oneTimeAdmissionInr);
  let totalScholarship4Years = 0;

  const growthMultiplier = 1 + (req.annualFeeIncreasePercent || 0) / 100;

  for (let year = 1; year <= 4; year++) {
    const factor = Math.pow(growthMultiplier, year - 1);
    const tuition = Math.round(req.tuitionPerYearInr * factor);
    const livingAndHostel = Math.round(
      (req.hostelPerYearInr + req.messPerYearInr) * factor
    );
    const examBooksTravelMisc = Math.round(
      (req.examAndLabPerYearInr +
        req.booksAndSuppliesPerYearInr +
        req.travelPerYearInr +
        req.miscPerYearInr) *
        factor
    );
    const oneTime = year === 1 ? totalOneTime : 0;
    const scholarshipDeduction = Math.min(
      tuition + livingAndHostel,
      Math.round(req.scholarshipPerYearInr || 0)
    );
    const netYearCost = Math.max(
      0,
      tuition +
        livingAndHostel +
        examBooksTravelMisc +
        oneTime -
        scholarshipDeduction
    );

    totalTuition4Years += tuition;
    totalLiving4Years += livingAndHostel;
    totalOther4Years += examBooksTravelMisc;
    totalScholarship4Years += scholarshipDeduction;

    yearlyBreakdown.push({
      year,
      tuition,
      livingAndHostel,
      examBooksTravelMisc,
      oneTime,
      scholarshipDeduction,
      netYearCost,
    });
  }

  const grandTotal4YearsInr =
    totalTuition4Years +
    totalLiving4Years +
    totalOther4Years +
    totalOneTime -
    totalScholarship4Years;

  return {
    yearlyBreakdown,
    totalTuition4Years,
    totalLiving4Years,
    totalOther4Years,
    totalOneTime,
    totalScholarship4Years,
    grandTotal4YearsInr: Math.max(0, grandTotal4YearsInr),
  };
}

export function calculateRoiScore(
  req: RoiCalculationRequest
): RoiCalculationResponse {
  const formula =
    'Payback Period (Years) = Total 4-Year Net Cost (INR) ÷ Verified Median Annual Salary (INR)';
  const caveat =
    'Payback uses gross median first-year salary (never highest package) before taxes and living expenses. Individual outcomes depend on branch, skills, and market conditions.';

  if (
    req.medianAnnualSalaryInr === null ||
    req.medianAnnualSalaryInr <= 0 ||
    req.total4YearCostInr <= 0
  ) {
    return {
      total4YearCostInr: req.total4YearCostInr,
      medianAnnualSalaryInr: req.medianAnnualSalaryInr,
      paybackPeriodYears: null,
      roiRating: 'Cannot Compute',
      formula,
      caveat,
    };
  }

  const paybackPeriodYears =
    Math.round((req.total4YearCostInr / req.medianAnnualSalaryInr) * 100) / 100;

  let roiRating: RoiCalculationResponse['roiRating'] = 'Moderate Payback';
  if (paybackPeriodYears <= 1.5) {
    roiRating = 'High Value';
  } else if (paybackPeriodYears > 3.5) {
    roiRating = 'Long Payback';
  }

  return {
    total4YearCostInr: req.total4YearCostInr,
    medianAnnualSalaryInr: req.medianAnnualSalaryInr,
    paybackPeriodYears,
    roiRating,
    formula,
    caveat,
  };
}

export function classifyEligibility(
  req: EligibilityRequest,
  cutoffs: CutoffRecord[]
): EligibilityResultItem[] {
  const relevant = cutoffs.filter((c) => {
    const examMatch = c.examId.toLowerCase() === req.examId.toLowerCase();
    const catMatch = c.category === req.category;
    const branchMatch =
      !req.branchCode ||
      req.branchCode === 'ALL' ||
      c.branchCode.toLowerCase() === req.branchCode.toLowerCase();
    return examMatch && catMatch && branchMatch;
  });

  return relevant.map((record) => {
    const closingVal = record.closingValue.value;
    if (closingVal === null) {
      return {
        collegeId: record.collegeId,
        collegeName: record.collegeName,
        branchCode: record.branchCode,
        branchName: record.branchName,
        examName: record.examName,
        metricType: record.metricType,
        closingValue: null,
        sourceName: record.closingValue.sourceName,
        sourceUrl: record.closingValue.sourceUrl,
        lastVerified: record.closingValue.lastVerified,
        classification: 'Cutoff Not Verified',
        explanation:
          'Official previous-year closing cutoff is not verified in our dataset for this category/branch. Check the official counselling portal.',
      };
    }

    if (record.metricType === 'rank') {
      // Lower rank number is better (e.g., Rank 1200 vs Closing Rank 2000)
      const ratio = req.metricValue / closingVal;
      if (ratio <= 0.85) {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Safe',
          explanation: `Your rank (${req.metricValue.toLocaleString('en-IN')}) is comfortably better than the ${record.year} closing rank (${closingVal.toLocaleString('en-IN')}). Not a guarantee of admission.`,
        };
      } else if (ratio <= 1.1) {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Target',
          explanation: `Your rank (${req.metricValue.toLocaleString('en-IN')}) is close to the ${record.year} closing rank (${closingVal.toLocaleString('en-IN')}). Include Safe backups.`,
        };
      } else {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Ambitious',
          explanation: `Your rank (${req.metricValue.toLocaleString('en-IN')}) is outside the ${record.year} closing rank (${closingVal.toLocaleString('en-IN')}). Keep as an aspirational choice.`,
        };
      }
    } else {
      // Percentile or score: Higher is better (e.g., 98.5 percentile vs 97.2 cutoff)
      const diff = req.metricValue - closingVal;
      const margin = record.metricType === 'percentile' ? 1.0 : 15;
      if (diff >= margin) {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Safe',
          explanation: `Your ${record.metricType} (${req.metricValue}) exceeds the ${record.year} cutoff (${closingVal}) by a healthy margin. Not a guarantee.`,
        };
      } else if (diff >= -margin) {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Target',
          explanation: `Your ${record.metricType} (${req.metricValue}) is right near the ${record.year} cutoff (${closingVal}).`,
        };
      } else {
        return {
          collegeId: record.collegeId,
          collegeName: record.collegeName,
          branchCode: record.branchCode,
          branchName: record.branchName,
          examName: record.examName,
          metricType: record.metricType,
          closingValue: closingVal,
          sourceName: record.closingValue.sourceName,
          sourceUrl: record.closingValue.sourceUrl,
          lastVerified: record.closingValue.lastVerified,
          classification: 'Ambitious',
          explanation: `Your ${record.metricType} (${req.metricValue}) is below the ${record.year} closing cutoff (${closingVal}).`,
        };
      }
    }
  });
}

export function matchScholarships(
  req: ScholarshipMatchRequest,
  scholarships: Scholarship[]
): Scholarship[] {
  return scholarships.filter((sch) => {
    const incomeCap = sch.maxIncomeLakhs.value;
    if (incomeCap !== null && req.familyIncomeLakhs > incomeCap) {
      return false;
    }

    const minMarks = sch.minMarksPercent.value;
    if (minMarks !== null && req.marksPercent < minMarks) {
      return false;
    }

    const categoryMatch =
      sch.eligibleCategories.includes('ALL') ||
      sch.eligibleCategories.includes(req.category);
    if (!categoryMatch) return false;

    const genderMatch =
      sch.eligibleGenders.includes('ALL') ||
      sch.eligibleGenders.includes(req.gender);
    if (!genderMatch) return false;

    const stateMatch =
      sch.eligibleStates.includes('ALL') ||
      sch.eligibleStates.some(
        (s) => s.toLowerCase() === req.state.toLowerCase()
      );
    if (!stateMatch) return false;

    return true;
  });
}

export function calculateEducationLoanEmi(
  principalInr: number,
  annualRatePercent: number,
  tenureYears: number
): {
  monthlyEmiInr: number;
  totalPayableInr: number;
  totalInterestInr: number;
} {
  if (principalInr <= 0 || tenureYears <= 0) {
    return {monthlyEmiInr: 0, totalPayableInr: 0, totalInterestInr: 0};
  }
  const months = tenureYears * 12;
  if (annualRatePercent <= 0) {
    const monthly = Math.round(principalInr / months);
    return {
      monthlyEmiInr: monthly,
      totalPayableInr: principalInr,
      totalInterestInr: 0,
    };
  }
  const r = annualRatePercent / 12 / 100;
  const factor = Math.pow(1 + r, months);
  const emi = (principalInr * r * factor) / (factor - 1);
  const monthlyEmiInr = Math.round(emi);
  const totalPayableInr = monthlyEmiInr * months;
  const totalInterestInr = Math.max(0, totalPayableInr - principalInr);
  return {monthlyEmiInr, totalPayableInr, totalInterestInr};
}
