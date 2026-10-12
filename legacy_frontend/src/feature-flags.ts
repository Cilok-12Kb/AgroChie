export type FeatureAvailability = 'unavailable' | 'demo' | 'ready';

type FeatureKeys = 'xgboost' | 'cnn' | 'gemini' | 'photoMetadataVerification' | 'bankSubmission' | 'openMeteoWeather';

export const FEATURE_AVAILABILITY: Record<FeatureKeys, FeatureAvailability> = {
  xgboost: 'unavailable',
  cnn: 'unavailable',
  gemini: 'unavailable',
  photoMetadataVerification: 'unavailable',
  bankSubmission: 'demo',
  openMeteoWeather: 'demo',
};

/**
 * Helper: apakah fitur siap dipakai (bukan mock/demo).
 */
export function isFeatureReady(feature: keyof typeof FEATURE_AVAILABILITY): boolean {
  return FEATURE_AVAILABILITY[feature] === 'ready';
}

/**
 * Helper: apakah fitur dalam mode demo (harus berlabel).
 */
export function isFeatureDemo(feature: keyof typeof FEATURE_AVAILABILITY): boolean {
  return FEATURE_AVAILABILITY[feature] === 'demo';
}
