import { state, saveState, subscribe } from '../core/state.js';
import { globals, imageInput, canvasProc, ctxProc } from '../core/constants.js';
import { loadImageFromFile, showProcessingAndUpdate, saveToHistory, commitCurrentState, performUndo, performRedo } from './canvas.js';
import { downloadURI, debounce } from '../core/utils.js';
import { isDocumentActive } from '../modules/document.js';

export function setHasChanges(hasChanges) {
  const btnApply = document.getElementById('btnApply');
  if (btnApply) {
    if (hasChanges) {
      btnApply.classList.add('has-changes');
    } else {
      btnApply.classList.remove('has-changes');
    }
  }
  document.title = hasChanges ? '● G&W Pixel Lab v2' : 'G&W Pixel Lab v2';
}

export function setupEventListeners() {
  // Sliders
  const setupSlider = (id, stateKey, valueId, isImmediate = false) => {
    const slider = document.getElementById(id);
    const valueDisp = document.getElementById(valueId);
    if (!slider) return;

    if (state[stateKey] !== undefined) {
      slider.value = state[stateKey];
      if (valueDisp) {
        if (valueDisp.tagName === 'INPUT') {
          valueDisp.value = state[stateKey];
        } else {
          valueDisp.innerText = state[stateKey];
        }
      }
    }
    
    // Subscribe to state changes to update the UI
    subscribe((property, value) => {
      if (property === stateKey) {
        slider.value = value;
        if (valueDisp) {
          if (valueDisp.tagName === 'INPUT') {
            valueDisp.value = value;
          } else {
            valueDisp.innerText = value;
          }
        }
      }
    });

    const debouncedPreview = debounce(() => {
      if (globals.originalImageData) showProcessingAndUpdate(false, true);
    }, 150);

    slider.addEventListener('input', (e) => {
      state[stateKey] = parseFloat(e.target.value);
      setHasChanges(true);
      debouncedPreview();
    });
    
    slider.addEventListener('change', (e) => {
      state[stateKey] = parseFloat(e.target.value);
      if (globals.originalImageData) showProcessingAndUpdate();
    });

    if (valueDisp && valueDisp.tagName === 'INPUT') {
      valueDisp.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) return; // Prevent intermediate NaN states (e.g. empty box) from propagating
        
        const min = parseFloat(slider.min) ?? 0;
        const max = parseFloat(slider.max) ?? 100;
        const clamped = Math.max(min, Math.min(max, val));

        // This triggers the proxy which calls subscribe, updating the slider
        state[stateKey] = clamped;
        
        setHasChanges(true);
        debouncedPreview();
      });

      valueDisp.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        const min = parseFloat(slider.min) ?? 0;
        const max = parseFloat(slider.max) ?? 100;
        
        if (isNaN(val)) {
          // Revert to old value which updates the input box back to normal
          val = state[stateKey];
          e.target.value = val;
        } else {
          val = Math.max(min, Math.min(max, val));
          state[stateKey] = val;
        }

        if (globals.originalImageData) showProcessingAndUpdate();
      });
    }
  };

  setupSlider('gammaSlider', 'gamma', 'gammaValue');
  setupSlider('sharpnessStrengthSlider', 'sharpnessStrength', 'sharpnessStrengthValue');
  setupSlider('sharpnessSlider', 'sharpness', 'sharpnessValue');
  setupSlider('thresholdBlockSlider', 'thresholdBlockSize', 'thresholdBlockValue');
  setupSlider('unsharpAmountSlider', 'unsharpAmount', 'unsharpAmountValue');
  setupSlider('unsharpRadiusSlider', 'unsharpRadius', 'unsharpRadiusValue');
  setupSlider('cannyLowSlider', 'cannyLowThresh', 'cannyLowValue');
  setupSlider('cannyHighSlider', 'cannyHighThresh', 'cannyHighValue');
  setupSlider('claheClipSlider', 'claheClipLimit', 'claheClipValue');
  setupSlider('bilateralSigmaSlider', 'bilateralSigmaColor', 'bilateralSigmaValue');
  setupSlider('retinexScalesSlider', 'retinexScales', 'retinexScalesValue');
  setupSlider('wbStrengthSlider', 'wbStrength', 'wbStrengthValue');
  
  // Phase 5 Sliders
  setupSlider('hueSlider', 'hue', 'hueValue');
  setupSlider('saturationSlider', 'saturation', 'saturationValue');
  setupSlider('vibranceSlider', 'vibrance', 'vibranceValue');
  setupSlider('colorSlicingHueSlider', 'colorSlicingHue', 'colorSlicingHueValue');
  setupSlider('colorSlicingRangeSlider', 'colorSlicingRange', 'colorSlicingRangeValue');

  // Phase 4 Segmentation Sliders
  setupSlider('regionThreshSlider', 'regionSimilarity', 'regionThreshValue');
  setupSlider('kmeansKSlider', 'kmeansK', 'kmeansKValue');
  setupSlider('watershedMarkersSlider', 'watershedMarkers', 'watershedMarkersValue');

  // Phase 7 Sliders
  setupSlider('freqCutoffSlider', 'freqCutoff', 'freqCutoffValue');
  setupSlider('freqOrderSlider', 'freqOrder', 'freqOrderValue');

  // Phase 8 Sliders
  setupSlider('meanSizeSlider', 'meanSize', 'meanSizeValue');
  setupSlider('contraQSlider', 'contraQ', 'contraQValue');
  setupSlider('wienerKSlider', 'wienerK', 'wienerKValue');
  setupSlider('motionAngleSlider', 'motionAngle', 'motionAngleValue');
  setupSlider('motionLenSlider', 'motionLen', 'motionLenValue');

  // Phase 10 Sliders
  setupSlider('houghLinesSlider', 'houghLinesCount', 'houghLinesValue');
  setupSlider('homomorphicHighSlider', 'homomorphicHigh', 'homomorphicHighValue');
  setupSlider('homomorphicLowSlider', 'homomorphicLow', 'homomorphicLowValue');
  setupSlider('homomorphicCutoffSlider', 'homomorphicCutoff', 'homomorphicCutoffValue');

  const freqTypeSelect = document.getElementById('freqTypeSelect');
  if (freqTypeSelect) {
    freqTypeSelect.addEventListener('change', (e) => {
      state.freqFilterType = e.target.value;
      const orderGroup = document.getElementById('freqOrderGroup');
      if (orderGroup) orderGroup.style.display = (e.target.value === 'butterworth') ? 'block' : 'none';
      if (globals.originalImageData) showProcessingAndUpdate();
    });
  }

  // Accordion
  const savedAccordion = localStorage.getItem('gw_active_accordion');

  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = document.getElementById(header.dataset.target);
      const isOpen = content.classList.contains('open');

      document.querySelectorAll('.accordion-content').forEach(c => {
        c.style.maxHeight = null;
        c.classList.remove('open');
      });
      document.querySelectorAll('.accordion-header').forEach(h => h.classList.remove('active'));

      if (!isOpen) {
        header.classList.add('active');
        content.classList.add('open');
        content.style.maxHeight = content.scrollHeight + "px";
        localStorage.setItem('gw_active_accordion', header.dataset.target);
      } else {
        localStorage.removeItem('gw_active_accordion');
      }
    });

    if (savedAccordion && header.dataset.target === savedAccordion) {
      setTimeout(() => header.click(), 100);
    }
  });

  // Filter Params Visibility
  const updateFilterParamsVisibility = () => {
    const homoGroup = document.getElementById('homomorphicParamsGroup');
    if (homoGroup) {
      homoGroup.style.display = (state.activeFilter === 'homomorphic') ? 'block' : 'none';
    }
  };
  updateFilterParamsVisibility();

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (state.activeFilter === btn.dataset.filter) {
      btn.classList.add('active-filter');
    }

    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
      if (state.activeFilter === btn.dataset.filter) {
        state.activeFilter = null;
      } else {
        btn.classList.add('active-filter');
        state.activeFilter = btn.dataset.filter;
      }
      updateFilterParamsVisibility();
      if (globals.originalImageData) showProcessingAndUpdate();
      
      setHasChanges(true);
    });
  });

  // Image Actions
  imageInput.addEventListener('change', (e) => loadImageFromFile(e.target.files[0]));
  window.addEventListener('paste', (e) => {
    // Skip when Document mode is active — let document.js handle its own paste
    if (isDocumentActive()) return;
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        loadImageFromFile(item.getAsFile());
        break;
      }
    }
  });

  document.getElementById('btnSaveHistory').addEventListener('click', saveToHistory);
  document.getElementById('btnDownloadAll').addEventListener('click', () => {
    if (globals.processingHistory.length === 0) return alert("KhÃ´ng cÃ³ áº£nh nÃ o!");
    globals.processingHistory.forEach((uri, i) => {
      setTimeout(() => downloadURI(uri, `GW_PixelLab_${Date.now()}_${i}.png`), i * 300);
    });
  });

  // Theme
  const themeToggleBtn = document.getElementById('btnTheme');
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  let isLightMode = localStorage.getItem('gw_theme') === 'light';

  const updateThemeIcons = () => {
    if (moonIcon && sunIcon) {
      moonIcon.style.display = isLightMode ? 'none' : 'block';
      sunIcon.style.display = isLightMode ? 'block' : 'none';
    }
  };
  
  if (isLightMode) {
    document.body.classList.add('light-mode');
  }
  updateThemeIcons();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      isLightMode = !isLightMode;
      document.body.classList.toggle('light-mode', isLightMode);
      updateThemeIcons();
      localStorage.setItem('gw_theme', isLightMode ? 'light' : 'dark');
    });
  }

  // Save state on unload
  window.addEventListener('beforeunload', saveState);

  // ============================================================
  // UNDO / REDO / APPLY
  // ============================================================
  const btnApply = document.getElementById('btnApply');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      if (globals.originalImageData) {
        commitCurrentState();
        setHasChanges(false);
      }
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => performUndo());
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', () => performRedo());
  }

  // Floating Compare Button
  const floatCompareBtn = document.getElementById('floatCompareBtn');
  let tempProcessedSnapshot = null;
  let isComparing = false;

  if (floatCompareBtn) {
    const startCompare = (e) => {
      if (e) e.preventDefault();
      if (!globals.originalImageData || isComparing) return;

      const baselineData = (state.activeFilter || btnApply?.classList.contains('has-changes'))
        ? globals.originalImageData
        : (globals.pristineImageData || globals.originalImageData);

      if (!baselineData) return;

      isComparing = true;
      floatCompareBtn.classList.add('active');
      floatCompareBtn.innerText = '👁 Gốc (Đang xem)';

      // Save processed image
      tempProcessedSnapshot = ctxProc.getImageData(0, 0, canvasProc.width, canvasProc.height);

      // Render baseline image on processed canvas
      ctxProc.putImageData(baselineData, 0, 0);
    };

    const stopCompare = (e) => {
      if (e) e.preventDefault();
      if (!isComparing) return;

      if (tempProcessedSnapshot) {
        ctxProc.putImageData(tempProcessedSnapshot, 0, 0);
        tempProcessedSnapshot = null;
      }

      isComparing = false;
      floatCompareBtn.classList.remove('active');
      floatCompareBtn.innerText = '👁 Gốc';
    };

    floatCompareBtn.addEventListener('mousedown', startCompare);
    floatCompareBtn.addEventListener('mouseup', stopCompare);
    floatCompareBtn.addEventListener('mouseleave', stopCompare);

    floatCompareBtn.addEventListener('touchstart', startCompare, { passive: false });
    floatCompareBtn.addEventListener('touchend', stopCompare, { passive: false });
    floatCompareBtn.addEventListener('touchcancel', stopCompare, { passive: false });
  }
}


