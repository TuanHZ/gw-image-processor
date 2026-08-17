import { showProcessingAndUpdate } from './canvas.js';
import { globals } from '../core/constants.js';

// Slider mapping to state keys
const STATE_KEYS_MAPPING = {
  gammaSlider: 'gamma',
  sharpnessSlider: 'sharpness', // Deprecated
  sharpnessStrengthSlider: 'sharpnessStrength',
  thresholdBlockSlider: 'thresholdBlockSize',
  unsharpAmountSlider: 'unsharpAmount',
  unsharpRadiusSlider: 'unsharpRadius',
  cannyLowSlider: 'cannyLowThresh',
  cannyHighSlider: 'cannyHighThresh',
  claheClipSlider: 'claheClipLimit',
  bilateralSigmaSlider: 'bilateralSigmaColor',
  retinexScalesSlider: 'retinexScales',
  wbStrengthSlider: 'wbStrength',
  hueSlider: 'hue',
  saturationSlider: 'saturation',
  vibranceSlider: 'vibrance',
  colorSlicingHueSlider: 'colorSlicingHue',
  colorSlicingRangeSlider: 'colorSlicingRange',
  regionThreshSlider: 'regionSimilarity',
  kmeansKSlider: 'kmeansK',
  watershedMarkersSlider: 'watershedMarkers',
  freqCutoffSlider: 'freqCutoff',
  freqOrderSlider: 'freqOrder',
  meanSizeSlider: 'meanSize',
  contraQSlider: 'contraQ',
  wienerKSlider: 'wienerK',
  motionAngleSlider: 'motionAngle',
  motionLenSlider: 'motionLen',
  houghLinesSlider: 'houghLinesCount',
  homomorphicHighSlider: 'homomorphicHigh',
  homomorphicLowSlider: 'homomorphicLow',
  homomorphicCutoffSlider: 'homomorphicCutoff'
};

const DEFAULT_SLIDER_VALUES = {
  gammaSlider: 1.0,
  sharpnessSlider: 1.0, // Deprecated
  sharpnessStrengthSlider: 50,
  thresholdBlockSlider: 7,
  unsharpAmountSlider: 1.0,
  unsharpRadiusSlider: 2,
  cannyLowSlider: 50,
  cannyHighSlider: 150,
  claheClipSlider: 2.0,
  bilateralSigmaSlider: 25,
  retinexScalesSlider: 3,
  wbStrengthSlider: 1.0,
  hueSlider: 0,
  saturationSlider: 1.0,
  vibranceSlider: 0,
  colorSlicingHueSlider: 0,
  colorSlicingRangeSlider: 30,
  regionThreshSlider: 30,
  kmeansKSlider: 4,
  watershedMarkersSlider: 5,
  freqCutoffSlider: 30,
  freqOrderSlider: 2,
  meanSizeSlider: 3,
  contraQSlider: 1.5,
  wienerKSlider: 0.01,
  motionAngleSlider: 45,
  motionLenSlider: 20,
  houghLinesSlider: 15,
  homomorphicHighSlider: 1.5,
  homomorphicLowSlider: 0.5,
  homomorphicCutoffSlider: 30
};

// Built-in presets config
const BUILT_IN_PRESETS = {
  preset_default: {
    values: DEFAULT_SLIDER_VALUES
  },
  preset_sharp_light: {
    values: {
      ...DEFAULT_SLIDER_VALUES,
      sharpnessStrengthSlider: 65,
      gammaSlider: 1.05
    }
  },
  preset_contrast_boost: {
    values: {
      ...DEFAULT_SLIDER_VALUES,
      claheClipSlider: 3.0,
      gammaSlider: 0.9
    }
  }
};

export function initNewPresetSystem() {
  const dropdown = document.getElementById('presetDropdown');
  const btnSave = document.getElementById('btnSaveNewPreset');
  const btnDelete = document.getElementById('btnDeleteNewPreset');

  if (!dropdown || !btnSave || !btnDelete) return;

  const getCustomPresets = () => {
    const data = localStorage.getItem('gwlab_presets');
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Error parsing custom presets", e);
      return {};
    }
  };

  const populateDropdown = () => {
    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    const custom = getCustomPresets();

    // Reset dropdown structure
    dropdown.innerHTML = '';
    
    // Default placeholder
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.innerText = isEn ? '-- Choose a preset --' : '-- Chọn thiết lập sẵn --';
    dropdown.appendChild(optPlaceholder);

    // Default System Presets
    const optDefault = document.createElement('option');
    optDefault.value = 'preset_default';
    optDefault.innerText = isEn ? 'Default' : 'Mặc định';
    dropdown.appendChild(optDefault);

    const optSharp = document.createElement('option');
    optSharp.value = 'preset_sharp_light';
    optSharp.innerText = isEn ? 'Light Sharpness' : 'Làm nét nhẹ';
    dropdown.appendChild(optSharp);

    const optContrast = document.createElement('option');
    optContrast.value = 'preset_contrast_boost';
    optContrast.innerText = isEn ? 'Contrast Booster' : 'Tăng tương phản';
    dropdown.appendChild(optContrast);

    // Custom user presets
    for (const name of Object.keys(custom)) {
      const opt = document.createElement('option');
      opt.value = 'custom_' + name;
      opt.innerText = name;
      dropdown.appendChild(opt);
    }

    btnDelete.disabled = true;
  };

  // 1. POPULATE DROPDOWN INITIAL STATE
  populateDropdown();

  // 2. LISTEN TO LANGUAGE TOGGLES
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      const currentSelected = dropdown.value;
      populateDropdown();
      dropdown.value = currentSelected;
      if (dropdown.value && dropdown.value.startsWith('custom_')) {
        btnDelete.disabled = false;
      }
    });
  }

  // 3. LISTEN TO DROPDOWN CHANGED
  dropdown.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) {
      btnDelete.disabled = true;
      return;
    }

    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    const noImageMsg = isEn ? 'Please upload an image first!' : 'Vui lòng tải ảnh lên trước!';
    if (!globals.originalImageData) {
      alert(noImageMsg);
      dropdown.value = '';
      btnDelete.disabled = true;
      return;
    }

    let preset = null;
    if (val.startsWith('preset_')) {
      preset = BUILT_IN_PRESETS[val];
      btnDelete.disabled = true;
    } else if (val.startsWith('custom_')) {
      const customName = val.substring(7); // strip 'custom_'
      const custom = getCustomPresets();
      preset = custom[customName];
      btnDelete.disabled = false;
    }

    if (preset && preset.values) {
      // Set values to sliders
      for (const [sliderId, value] of Object.entries(preset.values)) {
        const slider = document.getElementById(sliderId);
        if (slider) {
          slider.value = value;
          
          // Trigger standard input/change events to sync UI and state correctly
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      
      // Render visual preview immediately
      showProcessingAndUpdate();
    }
  });

  // 4. SAVE BUTTON CLICK
  btnSave.addEventListener('click', () => {
    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    const promptMsg = isEn ? 'Enter custom preset name:' : 'Nhập tên thiết lập sẵn mới:';
    const emptyMsg = isEn ? 'Preset name cannot be empty!' : 'Tên thiết lập sẵn không được để trống!';
    const noImageMsg = isEn ? 'Please upload an image first!' : 'Vui lòng tải ảnh lên trước!';

    if (!globals.originalImageData) {
      alert(noImageMsg);
      return;
    }

    const name = prompt(promptMsg);
    if (name === null) return; // User cancelled
    const trimmed = name.trim();
    if (!trimmed) {
      alert(emptyMsg);
      return;
    }

    // Capture values from all sliders
    const values = {};
    document.querySelectorAll('.tab-content-wrapper input[type="range"]').forEach(slider => {
      values[slider.id] = parseFloat(slider.value);
    });

    const custom = getCustomPresets();
    custom[trimmed] = {
      name: trimmed,
      values
    };

    // Save with exception handling for full quota
    try {
      localStorage.setItem('gwlab_presets', JSON.stringify(custom));
      populateDropdown();
      dropdown.value = 'custom_' + trimmed;
      btnDelete.disabled = false;
    } catch (err) {
      console.error("QuotaExceededError while saving preset", err);
      const errorMsg = isEn 
        ? "Failed to save preset. Browser storage limit exceeded! Please delete some old presets first." 
        : "Không thể lưu thiết lập sẵn. Bộ nhớ trình duyệt đã đầy! Vui lòng xóa một số preset cũ trước.";
      alert(errorMsg);
    }
  });

  // 5. DELETE BUTTON CLICK
  btnDelete.addEventListener('click', () => {
    const val = dropdown.value;
    if (!val || !val.startsWith('custom_')) return;

    const name = val.substring(7); // strip 'custom_'
    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    const confirmMsg = isEn 
      ? `Are you sure you want to delete preset "${name}"?`
      : `Bạn có chắc chắn muốn xóa thiết lập sẵn "${name}" không?`;

    if (confirm(confirmMsg)) {
      const custom = getCustomPresets();
      delete custom[name];
      
      try {
        localStorage.setItem('gwlab_presets', JSON.stringify(custom));
        populateDropdown();
      } catch (err) {
        console.error("Error deleting preset", err);
      }
    }
  });
}
