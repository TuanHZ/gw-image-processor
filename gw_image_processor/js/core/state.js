export const state = {
  activeFilter: null,
  gamma: 1.0,
  sharpness: 1.0, // Deprecated
  thresholdBlockSize: 7,
  unsharpAmount: 1.0, // Deprecated
  unsharpRadius: 2, // Deprecated
  sharpnessStrength: 50,
  // Tier 2: Advanced Edge Detection
  cannyLowThresh: 50,
  cannyHighThresh: 150,
  // Tier 3: Adaptive Brightness & Restoration
  claheClipLimit: 2.0,
  claheTileSize: 16,
  bilateralSigmaColor: 25,
  bilateralSigmaSpace: 1.5,
  retinexScales: 3,
  // Phase 3: Medium Filters
  quantizationColors: 8,
  // Phase 4: Advanced Segmentation
  regionSimilarity: 30,
  watershedMarkers: 5,
  kmeansK: 4,
  // Phase 5: Color Mastery
  hue: 0,
  saturation: 1.0,
  vibrance: 0,
  colorSlicingHue: 0,
  colorSlicingRange: 30,
  wbStrength: 1.0,

  // Phase 7: Frequency Domain
  freqCutoff: 30,
  freqOrder: 2,
  freqFilterType: 'ideal', // 'ideal', 'butterworth', 'gaussian'

  // Phase 8: Restoration
  meanSize: 3,
  contraQ: 1.5,
  adaptiveMedianMax: 7,
  wienerK: 0.01,
  motionAngle: 45,
  motionLen: 20,

  // Phase 10: Advanced G&W Algorithms
  houghLinesCount: 15,
  homomorphicHigh: 1.5,
  homomorphicLow: 0.5,
  homomorphicCutoff: 30
};

const savedState = localStorage.getItem('gw_state');
if (savedState) {
  try {
    const parsed = JSON.parse(savedState);
    Object.assign(state, parsed);
  } catch (e) {
    console.error("Error loading state from localStorage", e);
  }
}

export function saveState() {
  localStorage.setItem('gw_state', JSON.stringify(state));
}
