/**
 * AI Upscale Studio Module
 * Manages the separate AI workspace "room" for anime/2D image upscaling.
 * Supports Anime4K, Waifu2x, Real-ESRGAN, and CUGAN models.
 */

import { globals } from '../core/constants.js';
import { runAIUpscaleAsync } from '../filters/ai-upscale-engines.js';
import { denoiseAndSharpenAsync } from '../filters/sharpness-engines.js';

// ============================================================
// AI State
// ============================================================
export const aiState = {
  isActive: false,
  selectedModel: 'anime4k',
  selectedScale: 2,
  denoiseLevel: 1,
  sourceImageData: null, // Original ImageData loaded into AI mode
  resultImageData: null, // Result after upscale
  sourceWidth: 0,
  sourceHeight: 0,
  displayMode: 'side',   // 'side' or 'split'
  currentZoom: 1.0,
  panX: 0,
  panY: 0,
  syncZoom: true,
  resultZoom: 1.0,
  resultPanX: 0,
  resultPanY: 0,
};

// Model information database
const MODEL_INFO = {
  anime4k: {
    icon: '⚡',
    name: 'Anime4K',
    desc: 'Sử dụng WebGL Shader để phóng đại ảnh anime cực nhanh. Phù hợp cho phóng to thời gian thực với chất lượng tốt.',
    speed: '⚡ <15ms',
    type: '🌐 Client-side',
    supportsDenoise: false,
    maxScale: 4,
  },
  waifu2x: {
    icon: '🎨',
    name: 'Waifu2x',
    desc: 'Mô hình mạng nơ-ron chuyên biệt cho ảnh anime. Khử nhiễu và phóng đại vượt trội, hoạt động offline trên trình duyệt.',
    speed: '🕐 2-5s',
    type: '🌐 Client-side (ONNX)',
    supportsDenoise: true,
    maxScale: 4,
  },
  realesrgan: {
    icon: '🌟',
    name: 'Real-ESRGAN',
    desc: 'Mô hình AI thế hệ mới, được huấn luyện đặc biệt cho ảnh anime. Cho kết quả sắc nét nhất với đường viền mượt mà.',
    speed: '🕐 3-8s',
    type: '🌐 Client / 🖥️ Server',
    supportsDenoise: false,
    maxScale: 4,
  },
  cugan: {
    icon: '💎',
    name: 'CUGAN',
    desc: 'Chất lượng Studio chuyên nghiệp. Yêu cầu GPU server để đạt hiệu suất tối ưu. Tốt nhất cho upscale ảnh quan trọng.',
    speed: '🕐 5-15s',
    type: '🖥️ Server (GPU)',
    supportsDenoise: true,
    maxScale: 4,
  },
  denoiseSharp: {
    icon: '✨',
    name: 'Sharpness',
    desc: 'Làm nét ảnh bằng cách kết hợp khử nhiễu Bilateral và bộ lọc Unsharp Mask. Giúp ảnh rõ nét và loại bỏ nhiễu hạt.',
    speed: '⚡ 1s-4s',
    type: '🌐 Client-side',
    supportsDenoise: false,
    maxScale: 1,
  },
};

// Max output dimension (4K limit per user request)
const MAX_OUTPUT_DIMENSION = 3840;

// Dynamic file input for image loading in AI room
let aiFileInput = null;

// ============================================================
// DOM Cache
// ============================================================
let dom = {};

function cacheDom() {
  dom = {
    // Views
    aiWorkspace: document.getElementById('aiUpscaleView'),
    aiUploadScreen: document.getElementById('aiUploadScreen'),
    aiProcessingView: document.getElementById('aiProcessingView'),
    // Header elements
    mainHeader: document.querySelector('.app-header'),
    mainContainer: document.querySelector('.app-container'),
    btnAIMode: document.getElementById('btnAIMode'),
    btnBackToEditor: document.getElementById('btnBackToEditor'),
    aiBtnChangeImage: document.getElementById('aiBtnChangeImage'),
    aiImageInfo: document.getElementById('aiImageInfo'),
    aiOriginalSize: document.getElementById('aiOriginalSize'),
    aiResultSize: document.getElementById('aiResultSize'),
    // Upload
    aiDropzone: document.getElementById('aiDropzone'),
    aiBtnUseCurrentImage: document.getElementById('aiBtnUseCurrentImage'),
    // Canvases
    aiCanvasOriginal: document.getElementById('aiCanvasOriginal'),
    aiCanvasResult: document.getElementById('aiCanvasResult'),
    aiCanvasContainer: document.getElementById('aiCanvasContainer'),
    aiSliderDivider: document.getElementById('aiSliderDivider'),
    // View modes
    aiBtnModeSplit: document.getElementById('aiBtnModeSplit'),
    aiBtnModeSide: document.getElementById('aiBtnModeSide'),
    // Zoom Controls
    aiBtnZoomIn: document.getElementById('aiBtnZoomIn'),
    aiBtnZoomOut: document.getElementById('aiBtnZoomOut'),
    aiBtnZoomLabel: document.getElementById('aiBtnZoomLabel'),
    aiBtnZoomFit: document.getElementById('aiBtnZoomFit'),
    aiBtnZoomReset: document.getElementById('aiBtnZoomReset'),
    aiCbSyncZoom: document.getElementById('aiCbSyncZoom'),
    // Controls
    aiModelSelect: document.getElementById('aiModelSelect'),
    aiScaleSelect: document.getElementById('aiScaleSelect'),
    aiScaleSection: document.getElementById('aiScaleSection'),
    aiDenoiseSlider: document.getElementById('aiDenoiseSlider'),
    aiDenoiseValue: document.getElementById('aiDenoiseValue'),
    aiDenoiseSection: document.getElementById('aiDenoiseSection'),
    aiSharpnessSection: document.getElementById('aiSharpnessSection'),
    aiSharpnessStrengthSlider: document.getElementById('aiSharpnessStrengthSlider'),
    aiSharpnessStrengthValue: document.getElementById('aiSharpnessStrengthValue'),
    aiSharpnessRadiusSlider: document.getElementById('aiSharpnessRadiusSlider'),
    aiSharpnessRadiusValue: document.getElementById('aiSharpnessRadiusValue'),
    aiOutputDimensions: document.getElementById('aiOutputDimensions'),
    // Actions
    aiBtnStartUpscale: document.getElementById('aiBtnStartUpscale'),
    aiProgressContainer: document.getElementById('aiProgressContainer'),
    aiProgressFill: document.getElementById('aiProgressFill'),
    aiProgressText: document.getElementById('aiProgressText'),
    aiResultActions: document.getElementById('aiResultActions'),
    aiBtnApplyReturn: document.getElementById('aiBtnApplyReturn'),
    aiBtnDownloadAI: document.getElementById('aiBtnDownloadAI'),
    // Model info
    aiInfoModelName: document.getElementById('aiInfoModelName'),
    aiInfoModelDesc: document.getElementById('aiInfoModelDesc'),
    aiInfoSpeed: document.getElementById('aiInfoSpeed'),
    aiInfoType: document.getElementById('aiInfoType'),
  };
}

// ============================================================
// View Switching (Enter / Exit AI Room)
// ============================================================

function enterAIMode() {
  aiState.isActive = true;
  
  // Hide main content area only (keep header visible for dark mode & settings)
  dom.mainContainer.style.display = 'none';
  
  // Show AI workspace (sits below header in normal flow)
  dom.aiWorkspace.style.display = 'flex';
  dom.btnAIMode.classList.add('active');
  
  // Check if there's a current image in the editor
  if (globals.originalImageData && globals.originalImageData.width > 0) {
    dom.aiBtnUseCurrentImage.style.display = 'flex';
  } else {
    dom.aiBtnUseCurrentImage.style.display = 'none';
  }
  
  // Show upload screen or processing view
  if (!aiState.sourceImageData) {
    dom.aiUploadScreen.style.display = 'flex';
    dom.aiProcessingView.style.display = 'none';
    if (dom.aiBtnChangeImage) dom.aiBtnChangeImage.style.display = 'none';
  } else {
    dom.aiUploadScreen.style.display = 'none';
    dom.aiProcessingView.style.display = 'flex';
    if (dom.aiBtnChangeImage) dom.aiBtnChangeImage.style.display = 'flex';
    setTimeout(() => {
      aiFitToView();
    }, 0);
  }
}

function exitAIMode() {
  aiState.isActive = false;
  
  // Show main content area
  dom.mainContainer.style.display = 'flex';
  
  // Hide AI workspace
  dom.aiWorkspace.style.display = 'none';
  dom.btnAIMode.classList.remove('active');
  if (dom.aiBtnChangeImage) dom.aiBtnChangeImage.style.display = 'none';
}

// ============================================================
// Image Loading into AI Mode
// ============================================================

function loadImageIntoAI(imageData) {
  aiState.sourceImageData = imageData;
  aiState.sourceWidth = imageData.width;
  aiState.sourceHeight = imageData.height;
  aiState.resultImageData = null;
  
  // Draw original canvas
  const ctxOrig = dom.aiCanvasOriginal.getContext('2d');
  dom.aiCanvasOriginal.width = imageData.width;
  dom.aiCanvasOriginal.height = imageData.height;
  ctxOrig.putImageData(imageData, 0, 0);
  
  // Clear result canvas
  const ctxResult = dom.aiCanvasResult.getContext('2d');
  dom.aiCanvasResult.width = imageData.width;
  dom.aiCanvasResult.height = imageData.height;
  ctxResult.clearRect(0, 0, imageData.width, imageData.height);
  // Show a placeholder - copy original as baseline
  ctxResult.putImageData(imageData, 0, 0);
  
  // Update size info
  dom.aiOriginalSize.textContent = `${imageData.width}×${imageData.height}`;
  dom.aiImageInfo.style.display = 'flex';
  updateOutputDimensions();
  
  // Enable start button
  dom.aiBtnStartUpscale.disabled = false;
  
  // Switch to processing view
  dom.aiUploadScreen.style.display = 'none';
  dom.aiProcessingView.style.display = 'flex';
  if (dom.aiBtnChangeImage) dom.aiBtnChangeImage.style.display = 'flex';
  
  setTimeout(() => {
    aiFitToView();
  }, 0);
  
  // Reset result actions
  dom.aiResultActions.style.display = 'none';
  dom.aiProgressContainer.style.display = 'none';
}

function useCurrentEditorImage() {
  if (globals.originalImageData && globals.originalImageData.width > 0) {
    // Clone the image data to avoid mutation
    const cloned = new ImageData(
      new Uint8ClampedArray(globals.originalImageData.data),
      globals.originalImageData.width,
      globals.originalImageData.height
    );
    loadImageIntoAI(cloned);
  }
}

// ============================================================
// AI Dropzone (File Upload in AI mode)
// ============================================================

function setupAIDropzone() {
  const dropzone = dom.aiDropzone;
  aiFileInput = document.createElement('input');
  aiFileInput.type = 'file';
  aiFileInput.accept = 'image/*';
  aiFileInput.style.display = 'none';
  document.body.appendChild(aiFileInput);
  
  dropzone.addEventListener('click', () => aiFileInput.click());
  
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadAIImageFromFile(file);
    }
  });
  
  aiFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadAIImageFromFile(file);
    }
    aiFileInput.value = '';
  });
}

function loadAIImageFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      loadImageIntoAI(imageData);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================
// Model / Scale / Denoise Selection
// ============================================================

function setupModelSelection() {
  // Model buttons
  dom.aiModelSelect.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-model-option');
    if (!btn) return;
    
    dom.aiModelSelect.querySelectorAll('.ai-model-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    aiState.selectedModel = btn.dataset.aiModel;
    updateModelInfo();
    updateOutputDimensions();
    
    // Toggle sections visibility
    const modelInfo = MODEL_INFO[aiState.selectedModel];
    dom.aiDenoiseSection.style.display = modelInfo.supportsDenoise ? 'block' : 'none';
    if (dom.aiScaleSection) {
      dom.aiScaleSection.style.display = (aiState.selectedModel === 'denoiseSharp') ? 'none' : 'block';
    }
    if (dom.aiSharpnessSection) {
      dom.aiSharpnessSection.style.display = (aiState.selectedModel === 'denoiseSharp') ? 'block' : 'none';
    }
  });
  
  // Scale buttons
  dom.aiScaleSelect.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-scale-btn');
    if (!btn) return;
    
    dom.aiScaleSelect.querySelectorAll('.ai-scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    aiState.selectedScale = parseInt(btn.dataset.scale);
    updateOutputDimensions();
  });
  
  // Denoise slider
  dom.aiDenoiseSlider.addEventListener('input', (e) => {
    aiState.denoiseLevel = parseInt(e.target.value);
    dom.aiDenoiseValue.textContent = aiState.denoiseLevel;
  });

  // Sharpness Sliders (manual execution only)
  if (dom.aiSharpnessStrengthSlider) {
    dom.aiSharpnessStrengthSlider.addEventListener('input', (e) => {
      dom.aiSharpnessStrengthValue.textContent = e.target.value + '%';
    });
  }
  if (dom.aiSharpnessRadiusSlider) {
    dom.aiSharpnessRadiusSlider.addEventListener('input', (e) => {
      dom.aiSharpnessRadiusValue.textContent = e.target.value + 'px';
    });
  }
}

function updateModelInfo() {
  const info = MODEL_INFO[aiState.selectedModel];
  if (!info) return;
  
  dom.aiInfoModelName.innerHTML = `<span class="ai-info-icon">${info.icon}</span><span>${info.name}</span>`;
  dom.aiInfoModelDesc.textContent = info.desc;
  dom.aiInfoSpeed.textContent = info.speed;
  dom.aiInfoType.textContent = info.type;
}

function updateOutputDimensions() {
  if (!aiState.sourceWidth || !aiState.sourceHeight) {
    dom.aiOutputDimensions.textContent = '-- × -- px';
    dom.aiResultSize.textContent = '--';
    return;
  }
  
  if (aiState.selectedModel === 'denoiseSharp') {
    dom.aiOutputDimensions.textContent = `${aiState.sourceWidth} × ${aiState.sourceHeight} px`;
    dom.aiResultSize.textContent = `${aiState.sourceWidth}×${aiState.sourceHeight}`;
    return;
  }
  
  let outW = aiState.sourceWidth * aiState.selectedScale;
  let outH = aiState.sourceHeight * aiState.selectedScale;
  
  // Clamp to 4K max
  if (outW > MAX_OUTPUT_DIMENSION || outH > MAX_OUTPUT_DIMENSION) {
    const ratio = Math.min(MAX_OUTPUT_DIMENSION / outW, MAX_OUTPUT_DIMENSION / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }
  
  dom.aiOutputDimensions.textContent = `${outW} × ${outH} px`;
  dom.aiResultSize.textContent = `${outW}×${outH}`;
}

// ============================================================
// AI Upscale Processing (Simulated for now - hooks for real AI)
// ============================================================

async function startUpscale() {
  if (!aiState.sourceImageData) return;
  
  const model = aiState.selectedModel;
  const srcW = aiState.sourceWidth;
  const srcH = aiState.sourceHeight;
  
  if (model === 'denoiseSharp') {
    dom.aiBtnStartUpscale.disabled = true;
    dom.aiProgressContainer.style.display = 'flex';
    dom.aiResultActions.style.display = 'none';
    
    try {
      const strength = parseInt(dom.aiSharpnessStrengthSlider.value);
      const radius = parseInt(dom.aiSharpnessRadiusSlider.value);
      
      const resultImageData = await denoiseAndSharpenAsync(
        aiState.sourceImageData,
        strength,
        radius,
        (percent, text) => {
          updateProgress(percent, text);
        }
      );
      
      aiState.resultImageData = resultImageData;
      
      dom.aiCanvasResult.width = srcW;
      dom.aiCanvasResult.height = srcH;
      const ctxResult = dom.aiCanvasResult.getContext('2d');
      ctxResult.putImageData(aiState.resultImageData, 0, 0);
      
      dom.aiCanvasOriginal.width = srcW;
      dom.aiCanvasOriginal.height = srcH;
      const ctxOrig = dom.aiCanvasOriginal.getContext('2d');
      ctxOrig.putImageData(aiState.sourceImageData, 0, 0);
      
      dom.aiResultSize.textContent = `${srcW}×${srcH}`;
      dom.aiProgressContainer.style.display = 'none';
      dom.aiResultActions.style.display = 'flex';
      
      aiFitToView();
    } catch (error) {
      console.error('[AI Sharpness] Error processing image:', error);
      updateProgress(0, 'Có lỗi xảy ra trong quá trình xử lý.');
      dom.aiProgressContainer.style.display = 'none';
    } finally {
      dom.aiBtnStartUpscale.disabled = false;
    }
    return;
  }

  // Disable start button, show progress
  dom.aiBtnStartUpscale.disabled = true;
  dom.aiProgressContainer.style.display = 'flex';
  dom.aiResultActions.style.display = 'none';
  
  const scale = aiState.selectedScale;
  const denoise = aiState.denoiseLevel;
  
  let outW = srcW * scale;
  let outH = srcH * scale;
  
  // Clamp to 4K
  if (outW > MAX_OUTPUT_DIMENSION || outH > MAX_OUTPUT_DIMENSION) {
    const ratio = Math.min(MAX_OUTPUT_DIMENSION / outW, MAX_OUTPUT_DIMENSION / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }
  
  try {
    // Run the high-fidelity AI upscale engine asynchronously
    const resultImageData = await runAIUpscaleAsync(
      aiState.sourceImageData,
      model,
      scale,
      denoise,
      (percent, text) => {
        updateProgress(percent, text);
      },
      outW,
      outH
    );
    
    // Store result
    aiState.resultImageData = resultImageData;
    
    // Display result on AI canvas
    dom.aiCanvasResult.width = outW;
    dom.aiCanvasResult.height = outH;
    const ctxResult = dom.aiCanvasResult.getContext('2d');
    ctxResult.putImageData(aiState.resultImageData, 0, 0);
    
    // Scale up original canvas to match for split comparison
    dom.aiCanvasOriginal.width = outW;
    dom.aiCanvasOriginal.height = outH;
    const ctxOrig = dom.aiCanvasOriginal.getContext('2d');
    
    // Create temporary canvas from source to draw it stretched
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(aiState.sourceImageData, 0, 0);
    
    ctxOrig.imageSmoothingEnabled = false; // Pixelated original for comparison
    ctxOrig.drawImage(tempCanvas, 0, 0, outW, outH);
    
    // Update size display
    dom.aiResultSize.textContent = `${outW}×${outH}`;
    
    // Show result actions
    dom.aiProgressContainer.style.display = 'none';
    dom.aiResultActions.style.display = 'flex';
    
    // Fit to view with new dimensions
    aiFitToView();
  } catch (error) {
    console.error('[AI Upscale] Error processing image:', error);
    updateProgress(0, 'Có lỗi xảy ra trong quá trình xử lý.');
  } finally {
    dom.aiBtnStartUpscale.disabled = false;
  }
}

function updateProgress(percent, text) {
  dom.aiProgressFill.style.width = `${percent}%`;
  dom.aiProgressText.textContent = text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Result Actions (Apply & Return, Download)
// ============================================================

function applyAIResult() {
  if (aiState.resultImageData) {
    // Apply the upscaled image back to the main editor
    globals.originalImageData = new ImageData(
      new Uint8ClampedArray(aiState.resultImageData.data),
      aiState.resultImageData.width,
      aiState.resultImageData.height
    );
    
    // Update pristine data
    globals.pristineImageData = new ImageData(
      new Uint8ClampedArray(aiState.resultImageData.data),
      aiState.resultImageData.width,
      aiState.resultImageData.height
    );
    
    // Trigger re-render in main editor if image is loaded
    window.dispatchEvent(new CustomEvent('aiUpscaleApplied'));
    
    // Show a temporary success state on the button
    const btn = dom.aiBtnApplyReturn;
    if (btn) {
      const originalHTML = btn.innerHTML;
      const isEn = (localStorage.getItem('pixel_lab_lang') || 'vi') === 'en';
      const successText = isEn ? 'Applied!' : 'Đã áp dụng!';
      
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${successText}</span>
      `;
      const originalBg = btn.style.background;
      btn.style.background = 'linear-gradient(135deg, #047857, #065f46)'; // Darker green
      btn.disabled = true;
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = originalBg;
        btn.disabled = false;
      }, 2000);
    }
  }
}

function downloadAIResult() {
  if (!aiState.resultImageData) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = aiState.resultImageData.width;
  canvas.height = aiState.resultImageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(aiState.resultImageData, 0, 0);
  
  const link = document.createElement('a');
  const modelName = MODEL_INFO[aiState.selectedModel].name;
  link.download = `upscaled_${modelName}_${aiState.selectedScale}x_${canvas.width}x${canvas.height}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ============================================================
// Split View Slider (AI Canvas)
// ============================================================

function setupAISplitSlider() {
  const divider = dom.aiSliderDivider;
  const container = dom.aiCanvasContainer;
  let isDragging = false;
  
  function updateSplitPosition(clientX) {
    const rect = container.getBoundingClientRect();
    let pos = (clientX - rect.left) / rect.width;
    pos = Math.max(0.05, Math.min(0.95, pos));
    
    divider.style.left = `${pos * 100}%`;
    
    // Update clip-path for the result canvas
    const resultCanvas = dom.aiCanvasResult;
    resultCanvas.style.clipPath = `polygon(${pos * 100}% 0, 100% 0, 100% 100%, ${pos * 100}% 100%)`;
  }
  
  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    updateSplitPosition(e.clientX);
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  // Touch support
  divider.addEventListener('touchstart', (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    updateSplitPosition(e.touches[0].clientX);
  });
  
  document.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// ============================================================
// AI Zoom & Pan Logic
// ============================================================

export function aiApplyTransform() {
  const tOrg = `translate(${aiState.panX}px, ${aiState.panY}px) scale(${aiState.currentZoom})`;
  dom.aiCanvasOriginal.style.transform = tOrg;

  let rZoom, rPanX, rPanY;
  if (aiState.syncZoom) {
    rZoom = aiState.currentZoom;
    if (dom.aiCanvasOriginal.width && dom.aiCanvasResult.width) {
      rZoom = aiState.currentZoom * (dom.aiCanvasOriginal.width / dom.aiCanvasResult.width);
    }
    rPanX = aiState.panX;
    rPanY = aiState.panY;
  } else {
    rZoom = aiState.resultZoom;
    rPanX = aiState.resultPanX;
    rPanY = aiState.resultPanY;
  }
  const tProc = `translate(${rPanX}px, ${rPanY}px) scale(${rZoom})`;
  dom.aiCanvasResult.style.transform = tProc;

  if (dom.aiBtnZoomLabel) {
    dom.aiBtnZoomLabel.textContent = Math.round(aiState.currentZoom * 100) + '%';
  }
}

export function aiDoZoom(newZoom, pivotX, pivotY) {
  const prevZoom = aiState.currentZoom;
  aiState.currentZoom = Math.min(4.0, Math.max(0.25, newZoom)); // Min 25%, Max 400%
  
  const paneOriginal = document.querySelector('.ai-pane-original');
  const rect = paneOriginal ? paneOriginal.getBoundingClientRect() : dom.aiCanvasContainer.getBoundingClientRect();
  
  const cx = pivotX !== undefined ? pivotX : rect.width / 2;
  const cy = pivotY !== undefined ? pivotY : rect.height / 2;
  
  const localX = (cx - aiState.panX) / prevZoom;
  const localY = (cy - aiState.panY) / prevZoom;
  
  aiState.panX = cx - localX * aiState.currentZoom;
  aiState.panY = cy - localY * aiState.currentZoom;
  
  if (aiState.currentZoom === 1) { 
    aiState.panX = 0; 
    aiState.panY = 0; 
  }
  
  aiApplyTransform();
}

export function aiFitToView() {
  const imgW = dom.aiCanvasOriginal.width;
  const imgH = dom.aiCanvasOriginal.height;
  if (!imgW || !imgH) return;
  
  const container = dom.aiCanvasContainer;
  const rect = container.getBoundingClientRect();
  if (!rect.width) return;
  
  const paneW = aiState.displayMode === 'side' ? rect.width / 2 : rect.width;
  const paneH = rect.height;
  const padding = 20;
  
  const scaleX = (paneW - padding) / imgW;
  const scaleY = (paneH - padding) / imgH;
  
  aiState.currentZoom = Math.min(scaleX, scaleY);
  
  const scaledW = imgW * aiState.currentZoom;
  const scaledH = imgH * aiState.currentZoom;
  
  aiState.panX = (paneW - scaledW) / 2;
  aiState.panY = (paneH - scaledH) / 2;
  
  if (!aiState.syncZoom) {
    // If not synced, fit the result view too
    let rZoom = aiState.currentZoom;
    if (dom.aiCanvasOriginal.width && dom.aiCanvasResult.width) {
      rZoom = aiState.currentZoom * (dom.aiCanvasOriginal.width / dom.aiCanvasResult.width);
    }
    aiState.resultZoom = rZoom;
    aiState.resultPanX = aiState.panX;
    aiState.resultPanY = aiState.panY;
  }
  
  aiApplyTransform();
}

function setupAIPanningAndZooming() {
  const container = dom.aiCanvasContainer;
  let isPanning = false;
  let startPanX, startPanY;
  let targetPane = null; // 'original' or 'result'
  
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.ai-slider-divider') || e.target.closest('.ai-slider-thumb')) return;
    
    isPanning = true;
    
    // Check which pane the mouse is down on
    const paneResult = e.target.closest('.ai-pane-result');
    if (paneResult && !aiState.syncZoom) {
      targetPane = 'result';
      startPanX = e.clientX - aiState.resultPanX;
      startPanY = e.clientY - aiState.resultPanY;
    } else {
      targetPane = 'original';
      startPanX = e.clientX - aiState.panX;
      startPanY = e.clientY - aiState.panY;
    }
    container.style.cursor = 'grabbing';
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!isPanning || !aiState.isActive) return;
    
    if (targetPane === 'result' && !aiState.syncZoom) {
      aiState.resultPanX = e.clientX - startPanX;
      aiState.resultPanY = e.clientY - startPanY;
    } else {
      aiState.panX = e.clientX - startPanX;
      aiState.panY = e.clientY - startPanY;
    }
    aiApplyTransform();
  });
  
  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      container.style.cursor = '';
      targetPane = null;
    }
  });
  
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.1 : -0.1;
      
      // Check which pane the wheel event is on
      const paneResult = e.target.closest('.ai-pane-result');
      if (paneResult && !aiState.syncZoom) {
        // Zoom result independently
        const resultPaneRect = paneResult.getBoundingClientRect();
        const pivotX = e.clientX - resultPaneRect.left;
        const pivotY = e.clientY - resultPaneRect.top;
        
        const prevZoom = aiState.resultZoom;
        aiState.resultZoom = Math.min(4.0, Math.max(0.05, aiState.resultZoom + step));
        
        const localX = (pivotX - aiState.resultPanX) / prevZoom;
        const localY = (pivotY - aiState.resultPanY) / prevZoom;
        
        aiState.resultPanX = pivotX - localX * aiState.resultZoom;
        aiState.resultPanY = pivotY - localY * aiState.resultZoom;
        
        aiApplyTransform();
      } else {
        // Zoom original/synced
        const hoveredPane = e.target.closest('.ai-pane') || container;
        const paneRect = hoveredPane.getBoundingClientRect();
        const pivotX = e.clientX - paneRect.left;
        const pivotY = e.clientY - paneRect.top;
        aiDoZoom(aiState.currentZoom + step, pivotX, pivotY);
      }
  }, { passive: false });
}

function setupAIZoomButtons() {
  if (!dom.aiBtnZoomIn) return;
  dom.aiBtnZoomIn.addEventListener('click', () => aiDoZoom(aiState.currentZoom + 0.1));
  dom.aiBtnZoomOut.addEventListener('click', () => aiDoZoom(aiState.currentZoom - 0.1));
  
  dom.aiBtnZoomReset.addEventListener('click', () => {
    aiState.currentZoom = 1.0;
    aiState.panX = 0;
    aiState.panY = 0;
    aiState.resultZoom = 1.0;
    aiState.resultPanX = 0;
    aiState.resultPanY = 0;
    aiApplyTransform();
  });
  
  dom.aiBtnZoomFit.addEventListener('click', () => {
    aiFitToView();
  });
  
  if (dom.aiCbSyncZoom) {
    dom.aiCbSyncZoom.addEventListener('change', () => {
      aiState.syncZoom = dom.aiCbSyncZoom.checked;
      if (!aiState.syncZoom) {
        // Copy current visual zoom & pan state to independent result state
        let rZoom = aiState.currentZoom;
        if (dom.aiCanvasOriginal.width && dom.aiCanvasResult.width) {
          rZoom = aiState.currentZoom * (dom.aiCanvasOriginal.width / dom.aiCanvasResult.width);
        }
        aiState.resultZoom = rZoom;
        aiState.resultPanX = aiState.panX;
        aiState.resultPanY = aiState.panY;
      } else {
        // Sync them back
        aiFitToView();
      }
    });
  }
  
  dom.aiBtnZoomLabel.addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'zoom-input';
    input.value = Math.round(aiState.currentZoom * 100);
    input.style.width = '52px';
    input.style.height = '30px';
    input.style.textAlign = 'center';
    input.style.fontSize = '0.8rem';
    input.style.border = '1px solid var(--accent-color)';
    input.style.borderRadius = '5px';
    input.style.backgroundColor = 'var(--bg-tertiary)';
    input.style.color = 'var(--text-color)';
    input.style.outline = 'none';

    dom.aiBtnZoomLabel.replaceWith(input);
    input.focus();
    input.select();

    const restoreLabel = () => {
      if (input.parentNode) {
        input.replaceWith(dom.aiBtnZoomLabel);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 25 && val <= 400) {
          aiDoZoom(val / 100);
        }
        restoreLabel();
      } else if (e.key === 'Escape') {
        restoreLabel();
      }
    });

    input.addEventListener('blur', () => {
      restoreLabel();
    });
  });
}

// ============================================================
// Display Mode Switching (Split / Side-by-side)
// ============================================================

export function setAIDisplayMode(mode) {
  aiState.displayMode = mode;
  
  if (!dom.aiCanvasContainer || !dom.aiCanvasResult || !dom.aiSliderDivider || !dom.aiBtnModeSplit || !dom.aiBtnModeSide) {
    return;
  }
  
  if (mode === 'split') {
    dom.aiCanvasContainer.classList.remove('mode-side-by-side');
    dom.aiCanvasContainer.classList.add('mode-split');
    dom.aiBtnModeSplit.classList.add('active');
    dom.aiBtnModeSide.classList.remove('active');
    
    // Restore/reset split slider to 50% if no inline clipPath exists, or trigger split position update
    const rect = dom.aiCanvasContainer.getBoundingClientRect();
    if (rect.width > 0) {
      const dividerLeft = dom.aiSliderDivider.style.left;
      const percent = dividerLeft ? parseFloat(dividerLeft) : 50;
      dom.aiCanvasResult.style.clipPath = `polygon(${percent}% 0, 100% 0, 100% 100%, ${percent}% 100%)`;
    } else {
      dom.aiCanvasResult.style.clipPath = `polygon(50% 0, 100% 0, 100% 100%, 50% 100%)`;
      dom.aiSliderDivider.style.left = '50%';
    }
  } else {
    dom.aiCanvasContainer.classList.remove('mode-split');
    dom.aiCanvasContainer.classList.add('mode-side-by-side');
    dom.aiBtnModeSide.classList.add('active');
    dom.aiBtnModeSplit.classList.remove('active');
    dom.aiCanvasResult.style.clipPath = 'none';
  }
  
  setTimeout(() => {
    aiFitToView();
  }, 0);
}

// ============================================================
// Initialization
// ============================================================

export function initAIUpscale() {
  cacheDom();
  
  if (!dom.btnAIMode || !dom.aiWorkspace) {
    console.warn('[AI Upscale] Required DOM elements not found.');
    return;
  }
  
  // Enter/Exit AI Mode
  dom.btnAIMode.addEventListener('click', () => {
    if (aiState.isActive) {
      exitAIMode();
    } else {
      enterAIMode();
    }
  });
  
  dom.btnBackToEditor.addEventListener('click', exitAIMode);
  
  if (dom.aiBtnChangeImage) {
    dom.aiBtnChangeImage.addEventListener('click', () => {
      if (aiFileInput) aiFileInput.click();
    });
  }
  
  // Use current editor image
  dom.aiBtnUseCurrentImage.addEventListener('click', useCurrentEditorImage);
  
  // Setup dropzone
  setupAIDropzone();
  
  // Setup controls
  setupModelSelection();
  
  // Setup split slider
  setupAISplitSlider();
  
  // Setup display mode buttons
  if (dom.aiBtnModeSplit && dom.aiBtnModeSide) {
    dom.aiBtnModeSplit.addEventListener('click', () => setAIDisplayMode('split'));
    dom.aiBtnModeSide.addEventListener('click', () => setAIDisplayMode('side'));
    setAIDisplayMode(aiState.displayMode);
  }
  
  // Setup Panning and Zooming
  setupAIPanningAndZooming();
  setupAIZoomButtons();
  
  window.addEventListener('resize', () => {
    if (aiState.isActive) {
      aiFitToView();
    }
  });
  window.addEventListener('canvasResized', () => {
    if (aiState.isActive) {
      aiFitToView();
    }
  });
  
  // Start upscale
  dom.aiBtnStartUpscale.addEventListener('click', startUpscale);
  
  // Result actions
  dom.aiBtnApplyReturn.addEventListener('click', applyAIResult);
  dom.aiBtnDownloadAI.addEventListener('click', downloadAIResult);
  
  // Initialize model info display
  updateModelInfo();
  
  // Denoise section visibility based on default model (anime4k doesn't support it)
  dom.aiDenoiseSection.style.display = MODEL_INFO[aiState.selectedModel].supportsDenoise ? 'block' : 'none';
  
  // ESC key to exit AI mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiState.isActive) {
      exitAIMode();
    }
  });
  
  console.log('[AI Upscale Studio] Initialized successfully.');
}
