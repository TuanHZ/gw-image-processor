import { state } from '../core/state.js';
import { globals } from '../core/constants.js';
import { showProcessingAndUpdate } from './canvas.js';

// ============================================================
// STATE KEYS TO DOM SLIDERS MAPPING
// ============================================================
const SLIDER_MAPPINGS = {
  gamma: { sliderId: 'gammaSlider', labelId: 'gammaValue' },
  sharpness: { sliderId: 'sharpnessSlider', labelId: 'sharpnessValue' },
  thresholdBlockSize: { sliderId: 'thresholdBlockSlider', labelId: 'thresholdBlockValue' },
  unsharpAmount: { sliderId: 'unsharpAmountSlider', labelId: 'unsharpAmountValue' },
  unsharpRadius: { sliderId: 'unsharpRadiusSlider', labelId: 'unsharpRadiusValue' },
  cannyLowThresh: { sliderId: 'cannyLowSlider', labelId: 'cannyLowValue' },
  cannyHighThresh: { sliderId: 'cannyHighSlider', labelId: 'cannyHighValue' },
  claheClipLimit: { sliderId: 'claheClipSlider', labelId: 'claheClipValue' },
  bilateralSigmaColor: { sliderId: 'bilateralSigmaSlider', labelId: 'bilateralSigmaValue' },
  retinexScales: { sliderId: 'retinexScalesSlider', labelId: 'retinexScalesValue' },
  wbStrength: { sliderId: 'wbStrengthSlider', labelId: 'wbStrengthValue' },
  hue: { sliderId: 'hueSlider', labelId: 'hueValue' },
  saturation: { sliderId: 'saturationSlider', labelId: 'saturationValue' },
  vibrance: { sliderId: 'vibranceSlider', labelId: 'vibranceValue' },
  colorSlicingHue: { sliderId: 'colorSlicingHueSlider', labelId: 'colorSlicingHueValue' },
  colorSlicingRange: { sliderId: 'colorSlicingRangeSlider', labelId: 'colorSlicingRangeValue' },
  regionSimilarity: { sliderId: 'regionThreshSlider', labelId: 'regionThreshValue' },
  kmeansK: { sliderId: 'kmeansKSlider', labelId: 'kmeansKValue' },
  watershedMarkers: { sliderId: 'watershedMarkersSlider', labelId: 'watershedMarkersValue' },
  freqCutoff: { sliderId: 'freqCutoffSlider', labelId: 'freqCutoffValue' },
  freqOrder: { sliderId: 'freqOrderSlider', labelId: 'freqOrderValue' },
  meanSize: { sliderId: 'meanSizeSlider', labelId: 'meanSizeValue' },
  contraQ: { sliderId: 'contraQSlider', labelId: 'contraQValue' },
  wienerK: { sliderId: 'wienerKSlider', labelId: 'wienerKValue' },
  motionAngle: { sliderId: 'motionAngleSlider', labelId: 'motionAngleValue' },
  motionLen: { sliderId: 'motionLenSlider', labelId: 'motionLenValue' },
  houghLinesCount: { sliderId: 'houghLinesSlider', labelId: 'houghLinesValue' },
  homomorphicHigh: { sliderId: 'homomorphicHighSlider', labelId: 'homomorphicHighValue' },
  homomorphicLow: { sliderId: 'homomorphicLowSlider', labelId: 'homomorphicLowValue' },
  homomorphicCutoff: { sliderId: 'homomorphicCutoffSlider', labelId: 'homomorphicCutoffValue' }
};

// Built-in G&W academic configurations
const BUILTIN_PRESETS = {
  lowpass: {
    activeFilter: 'freqLowpass',
    sliders: {
      freqCutoff: 40
    },
    dropdowns: {
      freqTypeSelect: 'gaussian'
    }
  },
  highpass: {
    activeFilter: 'freqHighpass',
    sliders: {
      freqCutoff: 30,
      freqOrder: 2
    },
    dropdowns: {
      freqTypeSelect: 'butterworth'
    }
  },
  otsu: {
    activeFilter: 'otsuThreshold',
    sliders: {},
    dropdowns: {}
  },
  contrast: {
    activeFilter: 'laplacian',
    sliders: {
      sharpness: 2.5,
      claheClipLimit: 3.0
    },
    dropdowns: {}
  }
};

export function initAnalysis() {
  // 1. LISTEN TO METRICS UPDATES FROM ENGINE
  window.addEventListener('metricsUpdate', (e) => {
    updateMetricsUI(e.detail);
  });

  // 2. SETUP BUILT-IN PRESETS
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      const config = BUILTIN_PRESETS[presetKey];
      if (config) {
        applyPresetConfig(config);
      }
    });
  });

  // 3. SETUP CUSTOM PRESETS
  loadCustomPresetsList();

  const btnSavePreset = document.getElementById('btnSavePreset');
  const btnDeletePreset = document.getElementById('btnDeletePreset');
  const selectCustomPreset = document.getElementById('selectCustomPreset');
  const inputPresetName = document.getElementById('inputPresetName');

  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', () => {
      const name = inputPresetName.value.trim();
      if (!name) {
        alert(localStorage.getItem('pixel_lab_lang') === 'en' ? 'Please enter a preset name!' : 'Vui lòng nhập tên thiết lập sẵn!');
        return;
      }
      saveCustomPreset(name);
      inputPresetName.value = '';
    });
  }

  if (selectCustomPreset) {
    selectCustomPreset.addEventListener('change', (e) => {
      const name = e.target.value;
      if (btnDeletePreset) {
        btnDeletePreset.disabled = !name;
      }
      if (name) {
        const presets = getCustomPresetsFromStorage();
        if (presets[name]) {
          applyPresetConfig(presets[name]);
        }
      }
    });
  }

  if (btnDeletePreset) {
    btnDeletePreset.addEventListener('click', () => {
      const name = selectCustomPreset.value;
      if (!name) return;
      
      const confirmMsg = localStorage.getItem('pixel_lab_lang') === 'en' 
        ? `Are you sure you want to delete preset "${name}"?`
        : `Bạn có chắc chắn muốn xóa thiết lập sẵn "${name}" không?`;

      if (confirm(confirmMsg)) {
        deleteCustomPreset(name);
      }
    });
  }

  // 4. LISTEN FOR LANGUAGE TOGGLE TO UPDATE PRESETS DROPDOWN
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      loadCustomPresetsList();
    });
  }
}

// ============================================================
// METRICS UI RENDERING
// ============================================================
function updateMetricsUI(metrics) {
  const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
  
  const valMSE = document.getElementById('valMSE');
  const valPSNR = document.getElementById('valPSNR');
  const valSSIM = document.getElementById('valSSIM');
  const cardSSIM = document.getElementById('cardSSIM');
  const lblSSIMQuality = document.getElementById('lblSSIMQuality');
  
  const valEntropyOrg = document.getElementById('valEntropyOrg');
  const valEntropyProc = document.getElementById('valEntropyProc');

  const statMinOrg = document.getElementById('statMinOrg');
  const statMinProc = document.getElementById('statMinProc');
  const statMaxOrg = document.getElementById('statMaxOrg');
  const statMaxProc = document.getElementById('statMaxProc');
  const statMeanOrg = document.getElementById('statMeanOrg');
  const statMeanProc = document.getElementById('statMeanProc');
  const statStdDevOrg = document.getElementById('statStdDevOrg');
  const statStdDevProc = document.getElementById('statStdDevProc');

  // Helper for numeric rounding
  const formatNum = (num, decimals = 3) => {
    if (num === null || num === undefined) return 'N/A';
    if (num === Infinity) return '∞';
    return num.toFixed(decimals);
  };

  // MSE
  if (valMSE) valMSE.innerText = formatNum(metrics.mse, 2);

  // PSNR
  if (valPSNR) {
    valPSNR.innerText = metrics.psnr === Infinity ? '∞' : formatNum(metrics.psnr, 2) + ' dB';
  }

  // SSIM & Card styling rating
  if (valSSIM) {
    valSSIM.innerText = formatNum(metrics.ssim, 4);
    
    // Clear previous color rating classes
    if (valSSIM.classList) {
      valSSIM.classList.remove('excellent', 'good', 'warning');
    }

    if (metrics.ssim === null) {
      if (lblSSIMQuality) lblSSIMQuality.innerText = isEn ? 'Structural Similarity' : 'Chỉ số tương đồng cấu trúc';
    } else if (metrics.ssim >= 0.95) {
      valSSIM.classList.add('excellent');
      if (lblSSIMQuality) lblSSIMQuality.innerText = isEn ? 'Excellent Similarity' : 'Độ tương đồng: Xuất sắc';
    } else if (metrics.ssim >= 0.85) {
      valSSIM.classList.add('good');
      if (lblSSIMQuality) lblSSIMQuality.innerText = isEn ? 'Good Similarity' : 'Độ tương đồng: Tốt';
    } else if (metrics.ssim >= 0.70) {
      valSSIM.classList.add('warning');
      if (lblSSIMQuality) lblSSIMQuality.innerText = isEn ? 'Moderate Similarity' : 'Độ tương đồng: Trung bình';
    } else {
      valSSIM.classList.add('warning');
      if (lblSSIMQuality) lblSSIMQuality.innerText = isEn ? 'Low Similarity' : 'Khác biệt lớn';
    }
  }

  // Shannon Entropy
  if (valEntropyOrg) valEntropyOrg.innerText = formatNum(metrics.entropyOriginal, 3);
  if (valEntropyProc) valEntropyProc.innerText = formatNum(metrics.entropyProcessed, 3);

  // Intensity Statistics
  if (statMinOrg) statMinOrg.innerText = formatNum(metrics.statsOriginal.min, 1);
  if (statMinProc) statMinProc.innerText = formatNum(metrics.statsProcessed.min, 1);
  if (statMaxOrg) statMaxOrg.innerText = formatNum(metrics.statsOriginal.max, 1);
  if (statMaxProc) statMaxProc.innerText = formatNum(metrics.statsProcessed.max, 1);
  if (statMeanOrg) statMeanOrg.innerText = formatNum(metrics.statsOriginal.mean, 2);
  if (statMeanProc) statMeanProc.innerText = formatNum(metrics.statsProcessed.mean, 2);
  if (statStdDevOrg) statStdDevOrg.innerText = formatNum(metrics.statsOriginal.stdDev, 2);
  if (statStdDevProc) statStdDevProc.innerText = formatNum(metrics.statsProcessed.stdDev, 2);
}

// ============================================================
// APPLY PRESETS CONFIGURATION
// ============================================================
function applyPresetConfig(config) {
  // 1. Sync dropdowns if specified
  if (config.dropdowns) {
    for (const [id, val] of Object.entries(config.dropdowns)) {
      const el = document.getElementById(id);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  // 2. Sync sliders
  if (config.sliders) {
    for (const [key, val] of Object.entries(config.sliders)) {
      const mapping = SLIDER_MAPPINGS[key];
      if (mapping) {
        state[key] = val;
        const sliderEl = document.getElementById(mapping.sliderId);
        const valEl = document.getElementById(mapping.labelId);
        
        if (sliderEl) sliderEl.value = val;
        if (valEl) valEl.innerText = val;
      }
    }
  }

  // 3. Highlight corresponding filter button in UI
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active-filter');
    if (config.activeFilter && btn.dataset.filter === config.activeFilter) {
      btn.classList.add('active-filter');
    }
  });

  // 4. Update the active filter in state
  state.activeFilter = config.activeFilter || null;

  // Sync parameters visibility
  const homoGroup = document.getElementById('homomorphicParamsGroup');
  if (homoGroup) {
    homoGroup.style.display = (state.activeFilter === 'homomorphic') ? 'block' : 'none';
  }

  // 5. Trigger processing
  if (globals.originalImageData) {
    showProcessingAndUpdate();
  }
}

// ============================================================
// CUSTOM PRESETS STORAGE MANAGEMENT
// ============================================================
function getCustomPresetsFromStorage() {
  const data = localStorage.getItem('gw_custom_presets');
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Error parsing custom presets", e);
    return {};
  }
}

function saveCustomPresetsToStorage(presets) {
  localStorage.setItem('gw_custom_presets', JSON.stringify(presets));
}

function loadCustomPresetsList() {
  const selectCustomPreset = document.getElementById('selectCustomPreset');
  const btnDeletePreset = document.getElementById('btnDeletePreset');
  if (!selectCustomPreset) return;

  const isEn = localStorage.getItem('pixel_lab_lang') === 'en';

  // Keep first option
  selectCustomPreset.innerHTML = `<option value="">${isEn ? '-- Choose a preset --' : '-- Chọn thiết lập sẵn --'}</option>`;

  const presets = getCustomPresetsFromStorage();
  for (const name of Object.keys(presets)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.innerText = name;
    selectCustomPreset.appendChild(opt);
  }

  if (btnDeletePreset) btnDeletePreset.disabled = true;
}

function saveCustomPreset(name) {
  const presets = getCustomPresetsFromStorage();

  // Capture current slider values
  const sliders = {};
  for (const key of Object.keys(SLIDER_MAPPINGS)) {
    if (state[key] !== undefined) {
      sliders[key] = state[key];
    }
  }

  // Capture current active filter and optional dropdown state
  const dropdowns = {};
  const freqTypeSelect = document.getElementById('freqTypeSelect');
  if (freqTypeSelect) {
    dropdowns.freqTypeSelect = freqTypeSelect.value;
  }

  presets[name] = {
    activeFilter: state.activeFilter,
    sliders,
    dropdowns
  };

  saveCustomPresetsToStorage(presets);
  loadCustomPresetsList();

  // Select the newly created preset
  const selectCustomPreset = document.getElementById('selectCustomPreset');
  if (selectCustomPreset) {
    selectCustomPreset.value = name;
    selectCustomPreset.dispatchEvent(new Event('change'));
  }
}

function deleteCustomPreset(name) {
  const presets = getCustomPresetsFromStorage();
  if (presets[name]) {
    delete presets[name];
    saveCustomPresetsToStorage(presets);
    loadCustomPresetsList();
  }
}
