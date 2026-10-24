export const APP_NAME = 'Search Kro';
export const APP_TAGLINE = 'Unbiased Engineering Admission Guidance for Indian Students & Parents';
export const SUPPORT_HELPLINE = '1800-180-5522';
export const PLATFORM_FEE_INR = 99;
export const MAX_AI_INPUT_LENGTH = 8000;
export const AI_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
