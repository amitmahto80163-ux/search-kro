import {College, RankingMetrics} from '../../shared/schemas';

export const RANKING_FORMULAS_DOCUMENTATION = {
  principle:
    'Ordering and scores depend strictly on verified public data and the filters you select. Partner membership or payment has zero weight (0%) in every formula.',
  formulas: [
    {
      name: 'Affordability Score (0–100)',
      formula: 'max(0, min(100, 100 - ((AnnualTuition + AnnualHostelAndMess - 50,000) / 4,500)))',
      explanation:
        'Compares annual verified tuition and hostel fees against a ₹50,000–₹5,00,000 per year benchmark. Lower total cost yields a higher affordability score.',
    },
    {
      name: 'Placement Strength Score (0–100)',
      formula: 'min(65, (MedianSalaryINR / 25,00,000) * 65) + ((PlacedPercent / 100) * 35)',
      explanation:
        'Uses official NIRF median salary (65% weight, never headline highest package) and placement percentage (35% weight).',
    },
    {
      name: 'ROI Payback Period (Years)',
      formula: 'Total4YearCostINR / MedianAnnualSalaryINR',
      explanation:
        'Number of years of gross median starting salary required to equal the 4-year tuition + hostel + exam cost.',
    },
    {
      name: 'Value for Money Score (0–100)',
      formula: 'max(0, min(100, 115 - (ROIPaybackYears * 25)))',
      explanation:
        'Rewards colleges where the 4-year cost is recovered quickly relative to verified median placement outcomes.',
    },
    {
      name: 'Trust & Accreditation Score (0–100)',
      formula: 'AICTE(25) + UGC(25) + NAAC(20) + NBA(15) + NIRF_Verified(15)',
      explanation:
        'Measures regulatory verification completeness across AICTE, UGC, NAAC, NBA, and NIRF.',
    },
  ],
};

/**
 * Deterministically computes unbiased ranking metrics for a college.
 * Partner status (`college.isPartner`) is never read or used.
 */
export function computeCollegeRankingMetrics(college: College): RankingMetrics {
  const tuition = college.fees.tuitionPerYearInr.value;
  const hostel = college.fees.hostelPerYearInr.value ?? 0;
  const mess = college.fees.messPerYearInr.value ?? 0;
  const examFee = college.fees.examAndLabPerYearInr.value ?? 0;
  const oneTime = college.fees.oneTimeAdmissionInr.value ?? 0;

  // 1. Affordability Score
  let affordabilityScore = 50;
  let total4YearCost: number | null = null;
  if (tuition !== null) {
    const annualCore = tuition + hostel + mess + examFee;
    total4YearCost = annualCore * 4 + oneTime;
    affordabilityScore = Math.max(
      10,
      Math.min(100, Math.round(100 - (annualCore - 50000) / 4500))
    );
  }

  // 2. Placement Strength Score
  const medianSalary = college.placements.medianSalaryInr.value;
  const placedPercent = college.placements.placedPercent.value;
  let placementStrengthScore = 40;
  if (medianSalary !== null) {
    const salaryComponent = Math.min(65, (medianSalary / 2500000) * 65);
    const placedComponent =
      placedPercent !== null ? (placedPercent / 100) * 35 : 22;
    placementStrengthScore = Math.max(
      10,
      Math.min(100, Math.round(salaryComponent + placedComponent))
    );
  }

  // 3. ROI Payback & Value for Money
  let roiPaybackYears: number | null = null;
  let valueForMoneyScore = 50;
  if (total4YearCost !== null && medianSalary !== null && medianSalary > 0) {
    roiPaybackYears = Math.round((total4YearCost / medianSalary) * 100) / 100;
    valueForMoneyScore = Math.max(
      15,
      Math.min(100, Math.round(115 - roiPaybackYears * 25))
    );
  }

  // 4. Trust Score
  let trustScore = 0;
  if (college.accreditation.aicteApproved.value === true) trustScore += 25;
  if (college.accreditation.ugcStatus.value) trustScore += 25;
  if (college.accreditation.naacGrade.value) trustScore += 20;
  if (
    college.accreditation.nbaAccreditedBranches.value &&
    college.accreditation.nbaAccreditedBranches.value.length > 0
  ) {
    trustScore += 15;
  }
  if (college.accreditation.nirfRank.value !== null) trustScore += 15;

  const overallFairScore = Math.round(
    placementStrengthScore * 0.35 +
      valueForMoneyScore * 0.25 +
      affordabilityScore * 0.2 +
      trustScore * 0.2
  );

  return {
    affordabilityScore,
    placementStrengthScore,
    valueForMoneyScore,
    roiPaybackYears,
    trustScore,
    overallFairScore,
    lastComputed: '2025-02-15',
  };
}
