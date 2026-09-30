import { setupEventListeners, setHasChanges } from './ui/events.js';
import { initAnalysis } from './ui/analysis.js';
import { state } from './core/state.js';
import { globals, canvasProc, ctxProc } from './core/constants.js';
import { showProcessingAndUpdate, initHistory } from './ui/canvas.js';
import { initShortcuts } from './ui/shortcuts.js';
import { initNewPresetSystem } from './ui/presets.js';
import { initExportSystem } from './ui/export.js';
import { initAIUpscale } from './ui/ai-upscale.js';
import { initDocument } from './modules/document.js';

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initAnalysis();
  initShortcuts();
  initNewPresetSystem();
  initExportSystem();
  initAIUpscale();
  initDocument();
  
  // Reset Button Logic
  document.getElementById('btnReset').addEventListener('click', () => {
    if (!globals.pristineImageData) return;
    
    globals.originalImageData = new ImageData(
      new Uint8ClampedArray(globals.pristineImageData.data),
      globals.pristineImageData.width,
      globals.pristineImageData.height
    );

    // Reset state
    state.activeFilter = null;
    state.gamma = 1.0;
    state.sharpness = 1.0;
    
    // Reset all sliders in state to default
    state.thresholdBlockSize = 7;
    state.unsharpAmount = 1.0;
    state.unsharpRadius = 2;
    state.cannyLowThresh = 50;
    state.cannyHighThresh = 150;
    state.claheClipLimit = 2.0;
    state.bilateralSigmaColor = 25;
    state.retinexScales = 3;
    state.regionSimilarity = 30;
    state.watershedMarkers = 5;
    state.kmeansK = 4;
    state.hue = 0;
    state.saturation = 1.0;
    state.vibrance = 0;
    state.colorSlicingHue = 0;
    state.colorSlicingRange = 30;
    state.wbStrength = 1.0;
    state.freqCutoff = 30;
    state.freqOrder = 2;
    state.meanSize = 3;
    state.contraQ = 1.5;
    state.wienerK = 0.01;
    state.motionAngle = 45;
    state.motionLen = 20;
    state.houghLinesCount = 15;
    state.homomorphicHigh = 1.5;
    state.homomorphicLow = 0.5;
    state.homomorphicCutoff = 30;

    // The UI elements (sliders and value displays) will now automatically update
    // to match the default state due to the Pub-Sub pattern implemented in state.js

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
    canvasProc.style.cursor = 'default';

    // Reset history to pristine state
    initHistory();

    showProcessingAndUpdate();

    // Clear changes indicator
    setHasChanges(false);
  });
});
