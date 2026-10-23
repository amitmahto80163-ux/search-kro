import {Review, ReviewCategory} from '../../shared/schemas';

export interface AuthenticityResult {
  score: number;
  reasons: string[];
  isAboveThreshold: boolean;
}

const PROMOTIONAL_PATTERNS = [
  /100%\s*placement/i,
  /guaranteed\s*placement/i,
  /best\s*college\s*in\s*the\s*world/i,
  /apply\s*now/i,
  /direct\s*seat\s*call/i,
  /no\s*donation\s*hurry/i,
  /world\s*class\s*unbeatable/i,
];

const SPECIFIC_EVIDENCE_PATTERNS = [
  /hostel/i,
  /mess/i,
  /lab/i,
  /curriculum/i,
  /faculty/i,
  /semester/i,
  /internship/i,
  /coding/i,
  /stipend/i,
  /library/i,
  /wifi/i,
  /attendance/i,
  /LPA/i,
  /recruiter/i,
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes a deterministic review authenticity likelihood score from 0 to 100.
 * Evaluates duplicate/near-duplicate text, same-date review bursts, extreme sentiment
 * without specifics, promotional wording, and cross-source diversity.
 */
export function evaluateReviewAuthenticity(
  review: Pick<Review, 'shortSnippet' | 'rating' | 'date' | 'source'>,
  peerReviewsForCollege: Pick<Review, 'shortSnippet' | 'rating' | 'date' | 'source'>[] = []
): AuthenticityResult {
  let score = 88;
  const reasons: string[] = [];
  const text = review.shortSnippet.trim();

  // 1. Check promotional wording
  for (const pattern of PROMOTIONAL_PATTERNS) {
    if (pattern.test(text)) {
      score -= 32;
      reasons.push('Contains promotional or marketing phrasing');
      break;
    }
  }

  // 2. Check extreme sentiment with no specifics
  const isExtremeRating = review.rating === 5 || review.rating === 1;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasSpecifics = SPECIFIC_EVIDENCE_PATTERNS.some((p) => p.test(text));

  if (isExtremeRating && wordCount < 8 && !hasSpecifics) {
    score -= 25;
    reasons.push('Extreme rating with very short text and no specific details');
  } else if (isExtremeRating && !hasSpecifics) {
    score -= 12;
    reasons.push('Extreme rating without concrete academic, placement, or campus specifics');
  } else if (hasSpecifics && wordCount >= 10) {
    score += 6;
  }

  // 3. Excessive exclamation marks or all-caps shouting
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    score -= 15;
    reasons.push('Unusual punctuation burst (multiple exclamation marks)');
  }

  // 4. Duplicate or near-duplicate text across peer reviews
  let nearDuplicateCount = 0;
  let sameDateCount = 0;
  const distinctSources = new Set<string>();

  for (const peer of peerReviewsForCollege) {
    distinctSources.add(peer.source);
    if (peer === review) continue;
    const sim = jaccardSimilarity(text, peer.shortSnippet);
    if (sim >= 0.7) {
      nearDuplicateCount++;
    }
    if (peer.date === review.date) {
      sameDateCount++;
    }
  }

  if (nearDuplicateCount > 0) {
    score -= Math.min(40, nearDuplicateCount * 25);
    reasons.push('Near-duplicate wording detected across multiple reviews');
  }

  // 5. Burst of reviews on the exact same date
  if (sameDateCount >= 2) {
    score -= 18;
    reasons.push(`Part of a same-date posting burst (${sameDateCount + 1} reviews on ${review.date})`);
  }

  // 6. Source diversity bonus
  if (distinctSources.size >= 2) {
    score += 4;
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  if (reasons.length === 0) {
    reasons.push('Specific campus details, natural phrasing, and diverse date/source signals');
  }

  return {
    score: clampedScore,
    reasons,
    isAboveThreshold: clampedScore >= 60,
  };
}

export interface CategoryReviewSummary {
  category: ReviewCategory;
  verifiedReviewCount: number;
  flaggedReviewCount: number;
  averageRating: number | null;
  sources: string[];
  summaryText: string;
}

export function summarizeAuthenticReviewsByCategory(
  reviews: Review[],
  threshold = 60
): CategoryReviewSummary[] {
  const categories: ReviewCategory[] = [
    'placement',
    'hostel',
    'faculty',
    'campus',
    'fees',
  ];

  return categories.map((category) => {
    const inCategory = reviews.filter((r) => r.category === category);
    const authentic = inCategory.filter((r) => r.authenticityScore >= threshold);
    const flagged = inCategory.filter((r) => r.authenticityScore < threshold);
    const sources = Array.from(new Set(authentic.map((r) => r.source)));

    if (authentic.length === 0) {
      return {
        category,
        verifiedReviewCount: 0,
        flaggedReviewCount: flagged.length,
        averageRating: null,
        sources: [],
        summaryText:
          'No reviews above the authenticity signal threshold (60/100) for this category yet.',
      };
    }

    const avg =
      Math.round(
        (authentic.reduce((acc, r) => acc + r.rating, 0) / authentic.length) * 10
      ) / 10;

    const snippets = authentic.map((r) => r.shortSnippet).join(' | ');
    return {
      category,
      verifiedReviewCount: authentic.length,
      flaggedReviewCount: flagged.length,
      averageRating: avg,
      sources,
      summaryText: `Based on ${authentic.length} signal-checked snippet(s) (${sources.join(', ')}): ${snippets}`,
    };
  });
}
