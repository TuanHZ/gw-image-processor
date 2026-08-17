/**
 * G&W Pixel Lab
 * Based on "Digital Image Processing" by Rafael C. Gonzalez & Richard E. Woods
 */

const imageInput = document.getElementById('imageInput');
const canvasOrg = document.getElementById('canvasOriginal');
const canvasProc = document.getElementById('canvasProcessed');
const ctxOrg = canvasOrg.getContext('2d', { willReadFrequently: true });
const ctxProc = canvasProc.getContext('2d', { willReadFrequently: true });

let pristineImageData = null; // Ảnh gốc hoàn toàn
let originalImageData = null; // Ảnh gốc (có thể bị sửa đổi vĩnh viễn bởi công cụ Blur)
let processingHistory = []; // Lưu trữ lịch sử ảnh

const state = {
  activeFilter: null,
  gamma: 1.0,
  sharpness: 1.0,
  thresholdBlockSize: 7,
  unsharpAmount: 1.0,
  unsharpRadius: 2,
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
  // Phase 5: Color Mastery
  hue: 0,
  saturation: 1.0,
  vibrance: 0,
  colorSlicingHue: 0,
  colorSlicingRange: 30
};

// ----------------------------------------------------
// UI Elements & Listeners
const sliders = {
  gamma: document.getElementById('gammaSlider'),
  sharpness: document.getElementById('sharpnessSlider'),
  thresholdBlock: document.getElementById('thresholdBlockSlider'),
  unsharpAmount: document.getElementById('unsharpAmountSlider'),
  unsharpRadius: document.getElementById('unsharpRadiusSlider')
};
const values = {
  gamma: document.getElementById('gammaValue'),
  sharpness: document.getElementById('sharpnessValue'),
  thresholdBlock: document.getElementById('thresholdBlockValue'),
  unsharpAmount: document.getElementById('unsharpAmountValue'),
  unsharpRadius: document.getElementById('unsharpRadiusValue')
};

function showProcessingAndUpdate() {
  // Thay vì dùng overlay gây cản trở/che ảnh, ta làm mờ Canvas nhẹ (opacity)
  canvasProc.style.transition = 'none';
  canvasProc.style.opacity = '0.5';

  // Dùng setTimeout để trình duyệt kịp render UI trước khi bị block bởi thuật toán
  setTimeout(() => {
    updateImage();
    canvasProc.style.transition = 'opacity 0.2s';
    canvasProc.style.opacity = '1.0';
  }, 10);
}

function updateSliderValue(key, val, shouldProcess = false) {
  state[key] = val;
  values[key].innerText = val;
  if (shouldProcess && originalImageData) {
    showProcessingAndUpdate();
  }
}

// Cập nhật số liệu hiển thị liên tục khi đang kéo (không gọi hàm xử lý)
sliders.gamma.addEventListener('input', (e) => updateSliderValue('gamma', parseFloat(e.target.value), false));
sliders.sharpness.addEventListener('input', (e) => updateSliderValue('sharpness', parseFloat(e.target.value), false));
sliders.thresholdBlock.addEventListener('input', (e) => updateSliderValue('thresholdBlockSize', parseInt(e.target.value, 10), false));
sliders.unsharpAmount.addEventListener('input', (e) => updateSliderValue('unsharpAmount', parseFloat(e.target.value), false));
sliders.unsharpRadius.addEventListener('input', (e) => updateSliderValue('unsharpRadius', parseInt(e.target.value, 10), false));

// Tier 2 & 3 sliders
const slidersCanny = {
  low: document.getElementById('cannyLowSlider'),
  high: document.getElementById('cannyHighSlider')
};
const slidersAdaptive = {
  claheClip: document.getElementById('claheClipSlider'),
  claheTile: document.getElementById('claheTileSlider'),
  bilateralColor: document.getElementById('bilateralSigmaSlider'),
  bilateralSpace: document.getElementById('bilateralSpaceSlider'),
  retinex: document.getElementById('retinexScalesSlider')
};
const valuesCanny = {
  low: document.getElementById('cannyLowValue'),
  high: document.getElementById('cannyHighValue')
};
const valuesAdaptive = {
  claheClip: document.getElementById('claheClipValue'),
  claheTile: document.getElementById('claheTileValue'),
  bilateralColor: document.getElementById('bilateralSigmaValue'),
  bilateralSpace: document.getElementById('bilateralSpaceValue'),
  retinex: document.getElementById('retinexScalesValue')
};

// Phase 5 sliders
const slidersColor = {
  hue: document.getElementById('hueSlider'),
  saturation: document.getElementById('saturationSlider'),
  vibrance: document.getElementById('vibranceSlider'),
  sliceHue: document.getElementById('colorSlicingHueSlider'),
  sliceRange: document.getElementById('colorSlicingRangeSlider')
};
const valuesColor = {
  hue: document.getElementById('hueValue'),
  saturation: document.getElementById('saturationValue'),
  vibrance: document.getElementById('vibranceValue'),
  sliceHue: document.getElementById('colorSlicingHueValue'),
  sliceRange: document.getElementById('colorSlicingRangeValue')
};

// Add event listeners for new sliders
if (slidersCanny.low) slidersCanny.low.addEventListener('input', (e) => updateSliderValue('cannyLowThresh', parseInt(e.target.value, 10), false));
if (slidersCanny.high) slidersCanny.high.addEventListener('input', (e) => updateSliderValue('cannyHighThresh', parseInt(e.target.value, 10), false));
if (slidersCanny.low) slidersCanny.low.addEventListener('change', (e) => updateSliderValue('cannyLowThresh', parseInt(e.target.value, 10), true));
if (slidersCanny.high) slidersCanny.high.addEventListener('change', (e) => updateSliderValue('cannyHighThresh', parseInt(e.target.value, 10), true));

if (slidersAdaptive.claheClip) slidersAdaptive.claheClip.addEventListener('input', (e) => updateSliderValue('claheClipLimit', parseFloat(e.target.value), false));
if (slidersAdaptive.claheClip) slidersAdaptive.claheClip.addEventListener('change', (e) => updateSliderValue('claheClipLimit', parseFloat(e.target.value), true));

if (slidersAdaptive.bilateralColor) slidersAdaptive.bilateralColor.addEventListener('input', (e) => updateSliderValue('bilateralSigmaColor', parseInt(e.target.value, 10), false));
if (slidersAdaptive.bilateralColor) slidersAdaptive.bilateralColor.addEventListener('change', (e) => updateSliderValue('bilateralSigmaColor', parseInt(e.target.value, 10), true));

if (slidersAdaptive.retinex) slidersAdaptive.retinex.addEventListener('change', (e) => updateSliderValue('retinexScales', parseInt(e.target.value, 10), true));

// Phase 5 slider listeners
Object.keys(slidersColor).forEach(key => {
  const slider = slidersColor[key];
  if (!slider) return;
  const stateKey = key === 'sliceHue' ? 'colorSlicingHue' : (key === 'sliceRange' ? 'colorSlicingRange' : key);
  
  slider.addEventListener('input', (e) => {
    state[stateKey] = parseFloat(e.target.value);
    if (valuesColor[key]) valuesColor[key].innerText = e.target.value;
  });
  
  slider.addEventListener('change', (e) => {
    state[stateKey] = parseFloat(e.target.value);
    if (originalImageData) showProcessingAndUpdate();
  });
});

// Kích hoạt tính toán thực sự khi buông chuột (nhả thanh trượt)
sliders.gamma.addEventListener('change', (e) => updateSliderValue('gamma', parseFloat(e.target.value), true));
sliders.sharpness.addEventListener('change', (e) => updateSliderValue('sharpness', parseFloat(e.target.value), true));
sliders.thresholdBlock.addEventListener('change', (e) => updateSliderValue('thresholdBlockSize', parseInt(e.target.value, 10), true));
sliders.unsharpAmount.addEventListener('change', (e) => updateSliderValue('unsharpAmount', parseFloat(e.target.value), true));
sliders.unsharpRadius.addEventListener('change', (e) => updateSliderValue('unsharpRadius', parseInt(e.target.value, 10), true));

// Accordion Logic
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
    }
  });
});

// Filter Buttons Logic
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));

    if (state.activeFilter === btn.dataset.filter) {
      state.activeFilter = null;
    } else {
      btn.classList.add('active-filter');
      state.activeFilter = btn.dataset.filter;
    }

    // Đổi cursor nếu chọn Security Blur
    if (state.activeFilter === 'securityBlur') {
      canvasProc.style.cursor = 'crosshair';
    } else {
      canvasProc.style.cursor = 'default';
    }

    if (originalImageData) {
      showProcessingAndUpdate();
    }
  });
});

// ----------------------------------------------------
// Image Loading (Upload & Paste)
// ----------------------------------------------------
function loadImageFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      canvasOrg.width = img.width;
      canvasOrg.height = img.height;
      canvasProc.width = img.width;
      canvasProc.height = img.height;

      ctxOrg.drawImage(img, 0, 0);
      pristineImageData = ctxOrg.getImageData(0, 0, canvasOrg.width, canvasOrg.height);
      originalImageData = new ImageData(new Uint8ClampedArray(pristineImageData.data), img.width, img.height);

      showProcessingAndUpdate();

      // Auto-fit image to view after loading
      if (typeof fitToView === 'function') {
        setTimeout(fitToView, 50);
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

imageInput.addEventListener('change', (e) => loadImageFromFile(e.target.files[0]));

// Ctrl + V to Paste Image
window.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      loadImageFromFile(blob);
      break;
    }
  }
});

// ----------------------------------------------------
// Central Update Function
// ----------------------------------------------------
function updateImage() {
  if (!originalImageData) return;

  const imageData = new ImageData(
    new Uint8ClampedArray(originalImageData.data),
    originalImageData.width,
    originalImageData.height
  );

  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  switch (state.activeFilter) {
    case 'negative':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      break;

    case 'log':
      const cLog = 255 / Math.log(1 + 255);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = cLog * Math.log(1 + data[i]);
        data[i + 1] = cLog * Math.log(1 + data[i + 1]);
        data[i + 2] = cLog * Math.log(1 + data[i + 2]);
      }
      break;

    case 'gamma':
      const cGamma = 255 / Math.pow(255, state.gamma);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = cGamma * Math.pow(data[i], state.gamma);
        data[i + 1] = cGamma * Math.pow(data[i + 1], state.gamma);
        data[i + 2] = cGamma * Math.pow(data[i + 2], state.gamma);
      }
      break;

    case 'histEq':
      applyHistogram(data, width * height);
      break;

    case 'unsharpMask':
      applyUnsharpMask(data, width, height, state.unsharpAmount, state.unsharpRadius);
      break;

    case 'laplacian':
      const kernelLaplacian = [
        0, 1, 0,
        1, -4, 1,
        0, 1, 0
      ];
      const laplacianData = applyConvolution(data, width, height, kernelLaplacian);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] - state.sharpness * laplacianData[i]));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] - state.sharpness * laplacianData[i + 1]));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - state.sharpness * laplacianData[i + 2]));
      }
      break;

    case 'median':
      applyMedian(data, width, height);
      break;

    case 'sobel':
      applySobel(data, width, height);
      break;

    case 'adaptiveThresh':
      applyAdaptiveThreshold(data, width, height, state.thresholdBlockSize);
      break;

    case 'erosion':
      applyMorphology(data, width, height, false);
      break;

    case 'dilation':
      applyMorphology(data, width, height, true);
      break;

    case 'scanDocument': // Macro
      applyAdaptiveThreshold(data, width, height, state.thresholdBlockSize);
      applyMorphology(data, width, height, false); // Dùng erosion để làm chữ mỏng và sắc hơn một chút, hoặc dilation. Tách nền thường làm chữ bị gai nên erosion giúp chữ mượt hơn.
      break;

    case 'securityBlur':
      // Không làm gì lúc render, Blur được áp dụng trực tiếp lên originalImageData qua sự kiện chuột
      break;

    // ===== TIER 2: ADVANCED EDGE DETECTION =====
    case 'prewittEdge':
      applyPrewittEdge(data, width, height);
      break;

    case 'cannyEdge':
      applyCannyEdgeDetection(data, width, height, state.cannyLowThresh, state.cannyHighThresh);
      break;

    // ===== TIER 3: ADAPTIVE BRIGHTNESS & RESTORATION =====
    case 'clahe':
      applyCLAHE(data, width, height, state.claheClipLimit, state.claheTileSize);
      break;

    case 'bilateral':
      applyBilateralFilter(data, width, height, state.bilateralSigmaColor, state.bilateralSigmaSpace);
      break;

    case 'retinex':
      applyRetinex(data, width, height, state.retinexScales);
      break;

    // ===== PHASE 2: EASY MORPHOLOGY & EDGE FILTERS =====
    case 'opening':
      applyOpening(data, width, height);
      break;

    case 'closing':
      applyClosing(data, width, height);
      break;

    case 'robertsEdge':
      applyRobertsEdge(data, width, height);
      break;

    // ===== PHASE 3: MEDIUM DIFFICULTY FILTERS =====
    case 'otsuThreshold':
      applyOtsuThreshold(data, width, height);
      break;

    case 'skeletonization':
      applySkeletonization(data, width, height);
      break;

    case 'colorQuantization':
      applyColorQuantization(data, width, height, state.quantizationColors || 8);
      break;

    // ===== PHASE 4: ADVANCED SEGMENTATION =====
    case 'regionGrowing':
      applyRegionGrowing(data, width, height, state.regionSimilarity || 30);
      break;

    case 'watershed':
      applyWatershedSegmentation(data, width, height, state.watershedMarkers || 5);
      break;

    case 'whiteBalance':
      applyWhiteBalance(data, width, height);
      break;

    // ===== PHASE 5: COLOR MASTERY =====
    case 'colorAdjust':
      applyColorAdjustments(data, width, height, state.hue, state.saturation, state.vibrance);
      break;

    case 'hsvView':
      applyHSVView(data, width, height);
      break;

    case 'colorSlicing':
      applyColorSlicing(data, width, height, state.colorSlicingHue, state.colorSlicingRange);
      break;
  }

  ctxProc.putImageData(imageData, 0, 0);
}

// ----------------------------------------------------
// Interactive Security Blur (Chọn vùng)
// ----------------------------------------------------
let isDragging = false;
let startX, startY;
const selectionBox = document.getElementById('selectionBox');
const processedContainer = document.getElementById('processedContainer');

processedContainer.addEventListener('mousedown', (e) => {
  if (state.activeFilter !== 'securityBlur' || !originalImageData) return;
  const rect = canvasProc.getBoundingClientRect();
  startX = (e.clientX - rect.left);
  startY = (e.clientY - rect.top);

  isDragging = true;
  selectionBox.style.display = 'block';
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';
  selectionBox.style.width = '0px';
  selectionBox.style.height = '0px';
});

processedContainer.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = canvasProc.getBoundingClientRect();
  const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

  const boxX = Math.min(startX, currentX);
  const boxY = Math.min(startY, currentY);
  const boxW = Math.abs(currentX - startX);
  const boxH = Math.abs(currentY - startY);

  selectionBox.style.left = boxX + 'px';
  selectionBox.style.top = boxY + 'px';
  selectionBox.style.width = boxW + 'px';
  selectionBox.style.height = boxH + 'px';
});

processedContainer.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  selectionBox.style.display = 'none';

  const rect = canvasProc.getBoundingClientRect();
  const scaleX = canvasProc.width / rect.width;
  const scaleY = canvasProc.height / rect.height;

  const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

  const boxX = Math.min(startX, currentX) * scaleX;
  const boxY = Math.min(startY, currentY) * scaleY;
  const boxW = Math.abs(currentX - startX) * scaleX;
  const boxH = Math.abs(currentY - startY) * scaleY;

  if (boxW > 5 && boxH > 5) {
    // Blur 2 lần để tạo độ mờ (Gaussian approximation)
    const blurRect = { x: Math.floor(boxX), y: Math.floor(boxY), w: Math.floor(boxW), h: Math.floor(boxH) };
    applyFastBoxBlurRegion(originalImageData.data, originalImageData.width, originalImageData.height, blurRect, 10);
    applyFastBoxBlurRegion(originalImageData.data, originalImageData.width, originalImageData.height, blurRect, 10);
    showProcessingAndUpdate();
  }
});

// Fast Box Blur Algorithm (O(N) per pixel)
function applyFastBoxBlurRegion(data, width, height, rect, radius) {
  const { x, y, w, h } = rect;
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width - 1, x + w);
  const endY = Math.min(height - 1, y + h);
  if (startX >= endX || startY >= endY) return;

  const temp = new Uint8ClampedArray(data);

  // Horizontal pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let kx = -radius; kx <= radius; kx++) {
        const px = cx + kx;
        if (px >= startX && px <= endX) {
          const idx = (cy * width + px) * 4;
          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          count++;
        }
      }
      const dstIdx = (cy * width + cx) * 4;
      data[dstIdx] = r / count;
      data[dstIdx + 1] = g / count;
      data[dstIdx + 2] = b / count;
    }
  }

  // Copy back for vertical pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      const idx = (cy * width + cx) * 4;
      temp[idx] = data[idx];
      temp[idx + 1] = data[idx + 1];
      temp[idx + 2] = data[idx + 2];
    }
  }

  // Vertical pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const py = cy + ky;
        if (py >= startY && py <= endY) {
          const idx = (py * width + cx) * 4;
          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          count++;
        }
      }
      const dstIdx = (cy * width + cx) * 4;
      data[dstIdx] = r / count;
      data[dstIdx + 1] = g / count;
      data[dstIdx + 2] = b / count;
    }
  }
}

// ----------------------------------------------------
// History & Download Logic
// ----------------------------------------------------
const btnSaveHistory = document.getElementById('btnSaveHistory');
const btnDownloadAll = document.getElementById('btnDownloadAll');
const historyGallery = document.getElementById('historyGallery');

btnSaveHistory.addEventListener('click', () => {
  if (!originalImageData) return;
  const dataURL = canvasProc.toDataURL('image/png');
  processingHistory.push(dataURL);

  const imgElement = document.createElement('img');
  imgElement.src = dataURL;
  imgElement.title = "Nhấp để tải ảnh này";
  imgElement.onclick = () => {
    downloadURI(dataURL, `GW_PixelLab_${Date.now()}.png`);
  };
  historyGallery.appendChild(imgElement);
});

btnDownloadAll.addEventListener('click', () => {
  if (processingHistory.length === 0) {
    alert("Không có ảnh nào trong lịch sử để tải về!");
    return;
  }
  processingHistory.forEach((dataURL, index) => {
    // Thêm delay nhỏ để trình duyệt không chặn download nhiều file
    setTimeout(() => {
      downloadURI(dataURL, `GW_PixelLab_${Date.now()}_${index}.png`);
    }, index * 300);
  });
});

function downloadURI(uri, name) {
  const link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ----------------------------------------------------
// Core Logic Extracted
// ----------------------------------------------------
function applyHistogram(data, totalPixels) {
  let hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    let luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[luminance]++;
  }
  let cdf = new Array(256).fill(0);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + hist[i];
  }
  let cdfMin = cdf.find(v => v > 0);
  let hEq = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) {
    hEq[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    let lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    if (lum > 0) {
      let ratio = hEq[lum] / lum;
      data[i] = Math.min(255, r * ratio);
      data[i + 1] = Math.min(255, g * ratio);
      data[i + 2] = Math.min(255, b * ratio);
    }
  }
}

function applyConvolution(srcData, width, height, kernel) {
  const kSize = Math.sqrt(kernel.length);
  const half = Math.floor(kSize / 2);
  const dstData = new Float32Array(srcData.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const cy = Math.min(Math.max(y + ky - half, 0), height - 1);
          const cx = Math.min(Math.max(x + kx - half, 0), width - 1);
          const srcIdx = (cy * width + cx) * 4;
          const weight = kernel[ky * kSize + kx];
          r += srcData[srcIdx] * weight;
          g += srcData[srcIdx + 1] * weight;
          b += srcData[srcIdx + 2] * weight;
        }
      }
      dstData[dstIdx] = r;
      dstData[dstIdx + 1] = g;
      dstData[dstIdx + 2] = b;
      dstData[dstIdx + 3] = srcData[dstIdx + 3];
    }
  }
  return dstData;
}

function applyMedian(data, width, height) {
  const tempData = new Uint8ClampedArray(data);
  const rWindow = new Uint8Array(9);
  const gWindow = new Uint8Array(9);
  const bWindow = new Uint8Array(9);

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - 1);
    const yMax = Math.min(height - 1, y + 1);

    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - 1);
      const xMax = Math.min(width - 1, x + 1);

      let count = 0;
      for (let cy = yMin; cy <= yMax; cy++) {
        const rowOffset = cy * width;
        for (let cx = xMin; cx <= xMax; cx++) {
          const idx = (rowOffset + cx) * 4;
          rWindow[count] = tempData[idx];
          gWindow[count] = tempData[idx + 1];
          bWindow[count] = tempData[idx + 2];
          count++;
        }
      }

      // Sort only the elements we actually found (handles edges)
      const rSort = rWindow.subarray(0, count).sort();
      const gSort = gWindow.subarray(0, count).sort();
      const bSort = bWindow.subarray(0, count).sort();

      const mid = Math.floor(count / 2);
      const dstIdx = (y * width + x) * 4;
      data[dstIdx] = rSort[mid];
      data[dstIdx + 1] = gSort[mid];
      data[dstIdx + 2] = bSort[mid];
    }
  }
}

function applySobel(data, width, height) {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gx = applyConvolution(data, width, height, sobelX);
  const gy = applyConvolution(data, width, height, sobelY);
  for (let i = 0; i < data.length; i += 4) {
    const magR = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const magG = Math.sqrt(gx[i + 1] * gx[i + 1] + gy[i + 1] * gy[i + 1]);
    const magB = Math.sqrt(gx[i + 2] * gx[i + 2] + gy[i + 2] * gy[i + 2]);
    data[i] = Math.min(255, magR);
    data[i + 1] = Math.min(255, magG);
    data[i + 2] = Math.min(255, magB);
  }
}

// ============================================================
// TIER 2: ADVANCED EDGE DETECTION (G&W Ch. 10)
// ============================================================

function applyPrewittEdge(data, width, height) {
  const prewittX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const prewittY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
  const gx = applyConvolution(data, width, height, prewittX);
  const gy = applyConvolution(data, width, height, prewittY);
  for (let i = 0; i < data.length; i += 4) {
    const magR = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const magG = Math.sqrt(gx[i + 1] * gx[i + 1] + gy[i + 1] * gy[i + 1]);
    const magB = Math.sqrt(gx[i + 2] * gx[i + 2] + gy[i + 2] * gy[i + 2]);
    data[i] = Math.min(255, magR);
    data[i + 1] = Math.min(255, magG);
    data[i + 2] = Math.min(255, magB);
  }
}

function applyCannyEdgeDetection(data, width, height, lowThresh = 50, highThresh = 150) {
  // Canny Edge Detection - Gonzalez & Woods Ch. 10.2.3
  // Step 1: Gaussian Blur để giảm nhiễu
  const blurred = new Uint8ClampedArray(data);
  gaussianBlur(blurred, width, height, 1);

  // Step 2: Tính gradient Sobel
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gx = applyConvolution(blurred, width, height, sobelX);
  const gy = applyConvolution(blurred, width, height, sobelY);

  // Step 3: Magnitude và Direction
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const gxVal = gx[i * 4], gyVal = gy[i * 4];
    magnitude[i] = Math.sqrt(gxVal * gxVal + gyVal * gyVal);
    direction[i] = Math.atan2(gyVal, gxVal);
  }

  // Step 4: Non-Maximum Suppression
  const suppressed = new Uint8ClampedArray(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx];
      let q = 0, r = 0;

      // Kiểm tra 4 hướng chính
      if ((angle > -Math.PI / 8 && angle <= Math.PI / 8) || (angle > 7 * Math.PI / 8 || angle <= -7 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + 1], magnitude[idx - 1]);
      } else if ((angle > Math.PI / 8 && angle <= 3 * Math.PI / 8) || (angle > -7 * Math.PI / 8 && angle <= -5 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + width - 1], magnitude[idx - width + 1]);
      } else if ((angle > 3 * Math.PI / 8 && angle <= 5 * Math.PI / 8) || (angle > -5 * Math.PI / 8 && angle <= -3 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + width], magnitude[idx - width]);
      } else {
        q = Math.max(magnitude[idx + width + 1], magnitude[idx - width - 1]);
      }

      suppressed[idx] = magnitude[idx] >= q ? magnitude[idx] : 0;
    }
  }

  // Step 5: Double Thresholding + Edge Linking (Hysteresis)
  const edges = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    if (suppressed[i] > highThresh) edges[i] = 255;
    else if (suppressed[i] > lowThresh) edges[i] = 128;
    else edges[i] = 0;
  }

  // Edge linking: konnect weak edges để strong edges
  for (let i = 0; i < 2; i++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] === 128) {
          if (edges[idx - 1] === 255 || edges[idx + 1] === 255 || edges[idx - width] === 255 ||
            edges[idx + width] === 255 || edges[idx - width - 1] === 255 || edges[idx - width + 1] === 255 ||
            edges[idx + width - 1] === 255 || edges[idx + width + 1] === 255) {
            edges[idx] = 255;
          }
        }
      }
    }
  }

  // Ghi kết quả vào data
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = edges[i];
  }
}

// ============================================================
// TIER 3: ADAPTIVE BRIGHTNESS & RESTORATION (G&W Ch. 3.4)
// ============================================================

function applyCLAHE(data, width, height, clipLimit = 2.0, tileSize = 16) {
  // CLAHE (Contrast Limited Adaptive Histogram Equalization)
  // Gonzalez & Woods Ch. 3.4.4

  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  const nTilesX = Math.ceil(width / tileSize);
  const nTilesY = Math.ceil(height / tileSize);
  const clipped = new Uint8ClampedArray(lum);

  // Xử lý từng tile
  for (let ty = 0; ty < nTilesY; ty++) {
    for (let tx = 0; tx < nTilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);

      // Tính histogram cục bộ
      const hist = new Uint32Array(256);
      const pixelCount = (x1 - x0) * (y1 - y0);
      const clipThreshold = Math.floor(clipLimit * pixelCount / 256);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[lum[y * width + x]]++;
        }
      }

      // Clip histogram
      let clipped_count = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipThreshold) {
          clipped_count += hist[i] - clipThreshold;
          hist[i] = clipThreshold;
        }
      }

      // Redistribute clipped pixels
      const redistBins = 256;
      const redistValue = Math.floor(clipped_count / redistBins);
      for (let i = 0; i < 256; i++) hist[i] += redistValue;

      // Tính CDF
      const cdf = new Uint32Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];

      // Áp dụng equalization
      const cdfMin = cdf[0];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          const val = lum[idx];
          clipped[idx] = Math.round(((cdf[val] - cdfMin) / (pixelCount - 1)) * 255);
        }
      }
    }
  }

  // Copy kết quả
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const ratio = clipped[i] / Math.max(1, lum[i]);
    data[idx] = Math.min(255, data[idx] * ratio);
    data[idx + 1] = Math.min(255, data[idx + 1] * ratio);
    data[idx + 2] = Math.min(255, data[idx + 2] * ratio);
  }
}

function applyBilateralFilter(data, width, height, sigmaColor = 25, sigmaSpace = 1.5) {
  // Bilateral Filter - Optimized version (Gonzalez & Woods Ch. 3.6)
  const temp = new Uint8ClampedArray(data);
  const radius = Math.ceil(sigmaSpace * 3);
  const size = radius * 2 + 1;

  // 1. Precompute spatial weights (Gaussian kernel)
  const spatialWeights = new Float32Array(size * size);
  const spaceSigma2 = 2 * sigmaSpace * sigmaSpace;
  for (let ky = -radius; ky <= radius; ky++) {
    for (let kx = -radius; kx <= radius; kx++) {
      const dist = kx * kx + ky * ky;
      spatialWeights[(ky + radius) * size + (kx + radius)] = Math.exp(-dist / spaceSigma2);
    }
  }

  // 2. Precompute color weights (LUT for 256 differences)
  const colorWeights = new Float32Array(256);
  const colorSigma2 = 2 * sigmaColor * sigmaColor;
  for (let i = 0; i < 256; i++) {
    colorWeights[i] = Math.exp(-(i * i) / colorSigma2);
  }

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - radius);
    const yMax = Math.min(height - 1, y + radius);

    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - radius);
      const xMax = Math.min(height - 1, x + radius);

      const idx = (y * width + x) * 4;
      const r0 = temp[idx], g0 = temp[idx + 1], b0 = temp[idx + 2];

      let sumR = 0, sumG = 0, sumB = 0;
      let weightSumR = 0, weightSumG = 0, weightSumB = 0;

      for (let cy = yMin; cy <= yMax; cy++) {
        const rowOffset = cy * width;
        const ky = cy - y;
        const kernelRowOffset = (ky + radius) * size;

        for (let cx = xMin; cx <= xMax; cx++) {
          const nidx = (rowOffset + cx) * 4;
          const kx = cx - x;
          
          const rn = temp[nidx], gn = temp[nidx + 1], bn = temp[nidx + 2];
          
          const sWeight = spatialWeights[kernelRowOffset + (kx + radius)];
          
          const wr = sWeight * colorWeights[Math.abs(rn - r0)];
          const wg = sWeight * colorWeights[Math.abs(gn - g0)];
          const wb = sWeight * colorWeights[Math.abs(bn - b0)];

          sumR += rn * wr;
          sumG += gn * wg;
          sumB += bn * wb;
          weightSumR += wr;
          weightSumG += wg;
          weightSumB += wb;
        }
      }

      data[idx] = sumR / weightSumR;
      data[idx + 1] = sumG / weightSumG;
      data[idx + 2] = sumB / weightSumB;
    }
  }
}

function applyRetinex(data, width, height, numScales = 3) {
  // Retinex Color Restoration - Optimized (Gonzalez & Woods Ch. 3.4.5)
  const scales = [];
  for (let i = 0; i < numScales; i++) {
    scales.push(Math.round(16 + i * 40));
  }

  const logR = new Float32Array(width * height);
  const logG = new Float32Array(width * height);
  const logB = new Float32Array(width * height);

  const R = new Float32Array(width * height);
  const G = new Float32Array(width * height);
  const B = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    R[i] = data[i * 4];
    G[i] = data[i * 4 + 1];
    B[i] = data[i * 4 + 2];
  }

  for (let sigma of scales) {
    // Use separated 1D passes for O(N) instead of O(N^2)
    const blurR = gaussianBlurChannel(R, width, height, sigma);
    const blurG = gaussianBlurChannel(G, width, height, sigma);
    const blurB = gaussianBlurChannel(B, width, height, sigma);

    for (let i = 0; i < width * height; i++) {
      logR[i] += Math.log(Math.max(1, R[i]) / Math.max(1, blurR[i]));
      logG[i] += Math.log(Math.max(1, G[i]) / Math.max(1, blurG[i]));
      logB[i] += Math.log(Math.max(1, B[i]) / Math.max(1, blurB[i]));
    }
  }

  const scaleInv = 1.0 / numScales;
  const gain = 128, offset = 128;
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = gain * (logR[i] * scaleInv) + offset;
    data[i * 4 + 1] = gain * (logG[i] * scaleInv) + offset;
    data[i * 4 + 2] = gain * (logB[i] * scaleInv) + offset;
  }
}

function gaussianBlurChannel(channel, width, height, sigma) {
  const radius = Math.min(Math.ceil(2 * sigma), 50); // Limit radius to prevent freeze on very large scales
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = val;
    sum += val;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;

  const temp = new Float32Array(width * height);
  const result = new Float32Array(width * height);

  // Horizontal Pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let i = -radius; i <= radius; i++) {
        const cx = Math.min(Math.max(x + i, 0), width - 1);
        val += channel[rowOffset + cx] * kernel[i + radius];
      }
      temp[rowOffset + x] = val;
    }
  }

  // Vertical Pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let val = 0;
      for (let i = -radius; i <= radius; i++) {
        const cy = Math.min(Math.max(y + i, 0), height - 1);
        val += temp[cy * width + x] * kernel[i + radius];
      }
      result[y * width + x] = val;
    }
  }
  return result;
}

function applyAdaptiveThreshold(data, width, height, kSize) {
  const half = Math.floor(kSize / 2);
  const C = 10;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const cy = y + ky, cx = x + kx;
          if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
            sum += lum[cy * width + cx];
            count++;
          }
        }
      }
      const threshold = (sum / count) - C;
      const idx = (y * width + x) * 4;
      const val = lum[y * width + x] >= threshold ? 255 : 0;
      data[idx] = data[idx + 1] = data[idx + 2] = val;
    }
  }
}

function applyMorphology(data, width, height, isDilation) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  const resultData = new Uint8ClampedArray(data.length);
  const half = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let extremum = isDilation ? 0 : 255;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const cy = Math.min(Math.max(y + ky, 0), height - 1);
          const cx = Math.min(Math.max(x + kx, 0), width - 1);
          const val = lum[cy * width + cx];
          if (isDilation) { if (val > extremum) extremum = val; }
          else { if (val < extremum) extremum = val; }
        }
      }
      const idx = (y * width + x) * 4;
      resultData[idx] = resultData[idx + 1] = resultData[idx + 2] = extremum;
      resultData[idx + 3] = data[idx + 3];
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = resultData[i];
}

// ============================================================
// PHASE 2: EASY FILTERS (G&W Ch. 9)
// ============================================================

function applyOpening(data, width, height) {
  // Opening = Erosion then Dilation (remove small objects)
  // Gonzalez & Woods Ch. 9.4
  // First: Erosion
  applyMorphology(data, width, height, false);
  // Then: Dilation
  applyMorphology(data, width, height, true);
}

function applyClosing(data, width, height) {
  // Closing = Dilation then Erosion (fill small holes)
  // Gonzalez & Woods Ch. 9.4
  // First: Dilation
  applyMorphology(data, width, height, true);
  // Then: Erosion
  applyMorphology(data, width, height, false);
}

function applyRobertsEdge(data, width, height) {
  // Roberts Cross Edge Detection (45° and 135° diagonals)
  // Gonzalez & Woods Ch. 10.2.1
  // More sensitive to diagonal edges than Sobel

  const robertsGx = [1, 0, 0, -1];  // 45° diagonal
  const robertsGy = [0, 1, -1, 0];  // 135° diagonal

  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);

  // Apply Roberts operators (2×2 kernel)
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idx_right = (y * width + (x + 1)) * 4;
      const idx_down = ((y + 1) * width + x) * 4;
      const idx_diag = ((y + 1) * width + (x + 1)) * 4;

      // Get luminance
      const p1 = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const p2 = 0.299 * data[idx_right] + 0.587 * data[idx_right + 1] + 0.114 * data[idx_right + 2];
      const p3 = 0.299 * data[idx_down] + 0.587 * data[idx_down + 1] + 0.114 * data[idx_down + 2];
      const p4 = 0.299 * data[idx_diag] + 0.587 * data[idx_diag + 1] + 0.114 * data[idx_diag + 2];

      // Roberts Gx: [[1, 0], [0, -1]]
      gx[y * width + x] = p1 - p4;

      // Roberts Gy: [[0, 1], [-1, 0]]
      gy[y * width + x] = p2 - p3;
    }
  }

  // Compute magnitude
  for (let i = 0; i < width * height; i++) {
    const mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const idx = i * 4;
    const magnitude = Math.min(255, mag);
    data[idx] = data[idx + 1] = data[idx + 2] = magnitude;
  }
}

// ============================================================
// PHASE 3: MEDIUM DIFFICULTY FILTERS (G&W Ch. 10, 9, 6)
// ============================================================

function applyOtsuThreshold(data, width, height) {
  // Otsu's Automatic Threshold Selection
  // Gonzalez & Woods Ch. 10.3.2
  // Maximize between-class variance to find optimal threshold

  // Step 1: Compute histogram
  const histogram = new Uint32Array(256);
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[lum]++;
  }

  // Step 2: Normalize histogram to get probabilities
  const probabilities = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    probabilities[i] = histogram[i] / totalPixels;
  }

  // Step 3: Compute means
  let totalMean = 0;
  for (let i = 0; i < 256; i++) {
    totalMean += i * probabilities[i];
  }

  // Step 4: Find threshold that maximizes between-class variance
  let maxVariance = 0;
  let optimalThreshold = 0;
  let w0 = 0;  // Class 0 probability
  let mu0 = 0; // Class 0 mean

  for (let t = 0; t < 256; t++) {
    w0 += probabilities[t];
    if (w0 === 0) continue;

    mu0 = (mu0 * (w0 - probabilities[t]) + t * probabilities[t]) / w0;

    const w1 = 1 - w0;
    if (w1 === 0) break;

    const mu1 = (totalMean - w0 * mu0) / w1;
    const variance = w0 * w1 * Math.pow(mu0 - mu1, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      optimalThreshold = t;
    }
  }

  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = lum >= optimalThreshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
}

function applySkeletonization(data, width, height) {
  // Skeletonization via Morphological Thinning
  // Gonzalez & Woods Ch. 9.5.3
  // Extract skeleton (center line) of binary objects

  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const skeleton = new Uint8ClampedArray(lum);
  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    const temp = new Uint8ClampedArray(skeleton);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        if (temp[idx] === 0) continue; // Skip black pixels

        // Get 8-neighborhood
        const p1 = temp[idx - width - 1];
        const p2 = temp[idx - width];
        const p3 = temp[idx - width + 1];
        const p4 = temp[idx + 1];
        const p5 = temp[idx + width + 1];
        const p6 = temp[idx + width];
        const p7 = temp[idx + width - 1];
        const p8 = temp[idx - 1];

        // Count transitions (0->1 in 8-neighborhood)
        let transitions = 0;
        const neighbors = [p2, p3, p4, p5, p6, p7, p8, p1];
        for (let i = 0; i < 8; i++) {
          if (neighbors[i] === 0 && neighbors[(i + 1) % 8] === 255) {
            transitions++;
          }
        }

        // Count white neighbors
        const sum = (p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8) / 255;

        // Thin if conditions met
        if (sum >= 2 && sum <= 6 && transitions === 1) {
          skeleton[idx] = 0;
          changed = true;
        }
      }
    }
  }

  // Copy skeleton to output
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = skeleton[i];
  }
}

function applyColorQuantization(data, width, height, numColors = 8) {
  // Color Quantization via K-means Clustering
  // Gonzalez & Woods Ch. 6.3.2
  // Reduce number of colors using clustering

  const totalPixels = width * height;
  const k = Math.min(numColors, 256);

  // Step 1: Extract unique colors (sample for large images)
  const sampleSize = Math.min(1000, totalPixels);
  const sampleIndices = [];
  for (let i = 0; i < sampleSize; i++) {
    sampleIndices.push(Math.floor((Math.random() * totalPixels) * 4));
  }

  // Step 2: Initialize k-means centroids
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = sampleIndices[i % sampleSize];
    centroids.push({
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      count: 0
    });
  }

  // Step 3: K-means iterations
  for (let iteration = 0; iteration < 5; iteration++) {
    // Reset counts
    for (let i = 0; i < k; i++) {
      centroids[i].count = 0;
      centroids[i].r = 0;
      centroids[i].g = 0;
      centroids[i].b = 0;
    }

    // Assign pixels to nearest centroid
    for (let i = 0; i < data.length; i += 4) {
      let minDist = Infinity;
      let closestCentroid = 0;

      for (let j = 0; j < k; j++) {
        const dr = data[i] - centroids[j].r;
        const dg = data[i + 1] - centroids[j].g;
        const db = data[i + 2] - centroids[j].b;
        const dist = dr * dr + dg * dg + db * db;

        if (dist < minDist) {
          minDist = dist;
          closestCentroid = j;
        }
      }

      centroids[closestCentroid].r += data[i];
      centroids[closestCentroid].g += data[i + 1];
      centroids[closestCentroid].b += data[i + 2];
      centroids[closestCentroid].count++;
    }

    // Update centroids
    for (let i = 0; i < k; i++) {
      if (centroids[i].count > 0) {
        centroids[i].r = Math.round(centroids[i].r / centroids[i].count);
        centroids[i].g = Math.round(centroids[i].g / centroids[i].count);
        centroids[i].b = Math.round(centroids[i].b / centroids[i].count);
      }
    }
  }

  // Step 4: Apply quantization
  for (let i = 0; i < data.length; i += 4) {
    let minDist = Infinity;
    let closestCentroid = 0;

    for (let j = 0; j < k; j++) {
      const dr = data[i] - centroids[j].r;
      const dg = data[i + 1] - centroids[j].g;
      const db = data[i + 2] - centroids[j].b;
      const dist = dr * dr + dg * dg + db * db;

      if (dist < minDist) {
        minDist = dist;
        closestCentroid = j;
      }
    }

    data[i] = centroids[closestCentroid].r;
    data[i + 1] = centroids[closestCentroid].g;
    data[i + 2] = centroids[closestCentroid].b;
  }
}

// ============================================================
// PHASE 4: ADVANCED SEGMENTATION FILTERS (G&W Ch. 10.4)
// ============================================================

function applyRegionGrowing(data, width, height, similarityThreshold = 30) {
  // Region Growing Segmentation
  // Gonzalez & Woods Ch. 10.4.1
  // Seed-based region expansion with similarity criteria

  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const regions = new Int32Array(width * height);
  regions.fill(-1);
  let regionCount = 0;

  // Find seeds (local minima)
  const seeds = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val = lum[idx];

      let isLocalMin = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (lum[(y + dy) * width + (x + dx)] < val) {
            isLocalMin = false;
            break;
          }
        }
        if (!isLocalMin) break;
      }

      if (isLocalMin) {
        seeds.push({ x, y, val });
      }
    }
  }

  // Grow regions from seeds
  for (const seed of seeds) {
    if (regions[seed.y * width + seed.x] !== -1) continue;

    const queue = [{ x: seed.x, y: seed.y }];
    regions[seed.y * width + seed.x] = regionCount;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const centerVal = lum[y * width + x];

      // Check 4-neighborhood
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (regions[ny * width + nx] !== -1) continue;

        const neighborVal = lum[ny * width + nx];
        if (Math.abs(neighborVal - centerVal) <= similarityThreshold) {
          regions[ny * width + nx] = regionCount;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    regionCount++;
  }

  // Color regions
  const colorMap = [];
  for (let i = 0; i < regionCount; i++) {
    colorMap.push({
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256)
    });
  }

  for (let i = 0; i < width * height; i++) {
    const region = Math.max(0, regions[i]);
    const color = colorMap[region % colorMap.length];
    const idx = i * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
  }
}

function applyWatershedSegmentation(data, width, height, markerCount = 5) {
  // Watershed Segmentation (Simplified)
  // Gonzalez & Woods Ch. 10.4.3
  // Simulate flooding from regional minima to separate objects

  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Find regional minima (markers)
  const markers = [];
  const minDistance = Math.max(width, height) / (markerCount + 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Check if local minimum
      let isLocalMin = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          if (lum[ny * width + nx] < lum[idx]) {
            isLocalMin = false;
            break;
          }
        }
        if (!isLocalMin) break;
      }

      if (isLocalMin) {
        let tooClose = false;
        for (const marker of markers) {
          const dist = Math.sqrt((marker.x - x) ** 2 + (marker.y - y) ** 2);
          if (dist < minDistance) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose && markers.length < markerCount) {
          markers.push({ x, y, val: lum[idx] });
        }
      }
    }
  }

  // Flooding (watershed)
  const watershed = new Int32Array(width * height);
  watershed.fill(-1);

  // Sort pixels by intensity
  const pixels = [];
  for (let i = 0; i < width * height; i++) {
    pixels.push({ idx: i, val: lum[i] });
  }
  pixels.sort((a, b) => a.val - b.val);

  // Assign markers
  for (let m = 0; m < markers.length; m++) {
    watershed[markers[m].y * width + markers[m].x] = m;
  }

  // Flood
  for (const { idx } of pixels) {
    if (watershed[idx] !== -1) continue;

    const x = idx % width;
    const y = Math.floor(idx / width);

    // Check 4-neighborhood
    const neighbors = [];
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (watershed[nidx] !== -1) {
          neighbors.push(watershed[nidx]);
        }
      }
    }

    if (neighbors.length > 0) {
      watershed[idx] = neighbors[0];
    }
  }

  // Color watersheds
  const colorMap = [];
  for (let i = 0; i <= markerCount; i++) {
    colorMap.push({
      r: Math.floor(Math.random() * 200),
      g: Math.floor(Math.random() * 200),
      b: Math.floor(Math.random() * 200)
    });
  }

  for (let i = 0; i < width * height; i++) {
    const region = Math.max(0, watershed[i]);
    const color = colorMap[region % colorMap.length];
    const idx = i * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
  }
}

function applyWhiteBalance(data, width, height) {
  // Automatic White Balance (Gray World Assumption)
  // Gonzalez & Woods Ch. 6.2
  // Corrects color casts by scaling R, G, B channels

  let sumR = 0, sumG = 0, sumB = 0;
  const pixelCount = width * height;

  // Calculate average color
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }

  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;

  // Calculate scaling factors
  const avgGray = (avgR + avgG + avgB) / 3;
  const scaleR = avgGray / Math.max(1, avgR);
  const scaleG = avgGray / Math.max(1, avgG);
  const scaleB = avgGray / Math.max(1, avgB);

  // Apply white balance
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * scaleR);
    data[i + 1] = Math.min(255, data[i + 1] * scaleG);
    data[i + 2] = Math.min(255, data[i + 2] * scaleB);
  }
}

function gaussianBlur(data, width, height, radius) {
  // Tính toán sẵn (Pre-compute) mảng hệ số Gaussian 1D
  const sigma = radius / 2;
  const kernelSize = radius * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  // Sử dụng Uint8ClampedArray đệm nhằm tối ưu bộ nhớ (Memory Management)
  const tempData = new Uint8ClampedArray(width * height * 4);

  // Quét theo chiều ngang (Horizontal pass)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const cx = Math.min(Math.max(x + k, 0), width - 1);
        const idx = (y * width + cx) * 4;
        const weight = kernel[k + radius];
        r += data[idx] * weight;
        g += data[idx + 1] * weight;
        b += data[idx + 2] * weight;
        a += data[idx + 3] * weight;
      }
      const dstIdx = (y * width + x) * 4;
      // Trực tiếp gán vì Uint8ClampedArray đã tự động ép kiểu và giới hạn biên (Clamp)
      tempData[dstIdx] = r;
      tempData[dstIdx + 1] = g;
      tempData[dstIdx + 2] = b;
      tempData[dstIdx + 3] = a;
    }
  }

  // Quét theo chiều dọc (Vertical pass)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const cy = Math.min(Math.max(y + k, 0), height - 1);
        const idx = (cy * width + x) * 4;
        const weight = kernel[k + radius];
        r += tempData[idx] * weight;
        g += tempData[idx + 1] * weight;
        b += tempData[idx + 2] * weight;
        a += tempData[idx + 3] * weight;
      }
      const dstIdx = (y * width + x) * 4;
      data[dstIdx] = r;
      data[dstIdx + 1] = g;
      data[dstIdx + 2] = b;
      data[dstIdx + 3] = a;
    }
  }
}

function applyUnsharpMask(data, width, height, amount, radius) {
  const original = new Uint8ClampedArray(data);
  gaussianBlur(data, width, height, radius);

  for (let i = 0; i < data.length; i += 4) {
    // Không cần Math.min/Math.max vì data là Uint8ClampedArray (sẽ tự động giới hạn 0-255)
    data[i] = original[i] + amount * (original[i] - data[i]);
    data[i + 1] = original[i + 1] + amount * (original[i + 1] - data[i + 1]);
    data[i + 2] = original[i + 2] + amount * (original[i + 2] - data[i + 2]);
    data[i + 3] = original[i + 3];
  }
}
// ============================================================
// PHASE 5: COLOR MASTERY (G&W Ch. 6)
// ============================================================

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, v * 255];
}

function hsvToRgb(h, s, v) {
  h /= 360; v /= 255;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

function applyColorAdjustments(data, width, height, hueShift, saturationMult, vibrance) {
  for (let i = 0; i < data.length; i += 4) {
    let [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);

    // Apply Hue
    h = (h + hueShift) % 360;
    if (h < 0) h += 360;

    // Apply Vibrance (Saturation boost for less saturated pixels)
    if (vibrance !== 0) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const amt = (Math.abs(data[i] - avg) + Math.abs(data[i + 1] - avg) + Math.abs(data[i + 2] - avg)) / 3;
      const vMult = (1 - amt / 255) * (vibrance / 100);
      s = Math.min(1, Math.max(0, s + vMult));
    }

    // Apply Saturation
    s = Math.min(1, Math.max(0, s * saturationMult));

    const [r, g, b] = hsvToRgb(h, s, v);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function applyHSVView(data, width, height) {
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    // Visualize Hue as color, S as intensity, V as brightness
    // Or just show Hue mapped to 0-255
    data[i] = (h / 360) * 255;
    data[i + 1] = s * 255;
    data[i + 2] = v;
  }
}

function applyColorSlicing(data, width, height, targetHue, range) {
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    
    // Check if hue is within range (handle wrap around at 360)
    let diff = Math.abs(h - targetHue);
    if (diff > 180) diff = 360 - diff;

    if (diff > range) {
      // Outside range: Desaturate
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  }
}

// Reset Image
document.getElementById('btnReset').addEventListener('click', () => {
  if (!pristineImageData) return;
  // Restore original image data from pristine
  originalImageData = new ImageData(new Uint8ClampedArray(pristineImageData.data), pristineImageData.width, pristineImageData.height);

  state.activeFilter = null;
  state.gamma = 1.0;
  state.sharpness = 1.0;
  state.thresholdBlockSize = 7;
  state.unsharpAmount = 1.0;
  state.unsharpRadius = 2;
  state.cannyLowThresh = 50;
  state.cannyHighThresh = 150;
  state.claheClipLimit = 2.0;
  state.claheTileSize = 16;
  state.bilateralSigmaColor = 25;
  state.bilateralSigmaSpace = 1.5;
  state.retinexScales = 3;

  sliders.gamma.value = 1.0;
  values.gamma.innerText = '1.0';
  sliders.sharpness.value = 1.0;
  values.sharpness.innerText = '1.0';
  sliders.thresholdBlock.value = 7;
  values.thresholdBlock.innerText = '7';
  sliders.unsharpAmount.value = 1.0;
  values.unsharpAmount.innerText = '1.0';
  sliders.unsharpRadius.value = 2;
  values.unsharpRadius.innerText = '2';

  // Reset new sliders
  const slidersCanny = {
    low: document.getElementById('cannyLowSlider'),
    high: document.getElementById('cannyHighSlider')
  };
  const slidersAdaptive = {
    claheClip: document.getElementById('claheClipSlider'),
    retinex: document.getElementById('retinexScalesSlider'),
    bilateralColor: document.getElementById('bilateralSigmaSlider')
  };

  if (slidersAdaptive.bilateralColor) slidersAdaptive.bilateralColor.value = 25;
  if (slidersAdaptive.retinex) slidersAdaptive.retinex.value = 3;

  // Phase 5 reset
  state.hue = 0;
  state.saturation = 1.0;
  state.vibrance = 0;
  state.colorSlicingHue = 0;
  state.colorSlicingRange = 30;

  if (slidersColor.hue) {
    slidersColor.hue.value = 0;
    valuesColor.hue.innerText = '0';
  }
  if (slidersColor.saturation) {
    slidersColor.saturation.value = 1.0;
    valuesColor.saturation.innerText = '1.0';
  }
  if (slidersColor.vibrance) {
    slidersColor.vibrance.value = 0;
    valuesColor.vibrance.innerText = '0';
  }
  if (slidersColor.sliceHue) {
    slidersColor.sliceHue.value = 0;
    valuesColor.sliceHue.innerText = '0';
  }
  if (slidersColor.sliceRange) {
    slidersColor.sliceRange.value = 30;
    valuesColor.sliceRange.innerText = '30';
  }

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
  canvasProc.style.cursor = 'default';

  showProcessingAndUpdate();
});

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggle');
let isLightMode = false;
themeToggleBtn.addEventListener('click', () => {
  isLightMode = !isLightMode;
  if (isLightMode) {
    document.body.classList.add('light-mode');
    themeToggleBtn.innerText = '🌙 Dark Mode';
  } else {
    document.body.classList.remove('light-mode');
    themeToggleBtn.innerText = '☀️ Light Mode';
  }
});