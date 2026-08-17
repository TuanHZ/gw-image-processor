import { globals, canvasOrg, canvasProc, ctxOrg, ctxProc } from '../core/constants.js';
import { state } from '../core/state.js';
import { updateImage } from '../core/engine.js';
import { applyFastBoxBlurRegion } from '../filters/special.js';
import { downloadURI } from '../core/utils.js';

// ============================================================
// HISTOGRAM RENDERING
// ============================================================
const histogramCanvas = document.getElementById('histogramCanvas');
const histogramCtx = histogramCanvas ? histogramCanvas.getContext('2d') : null;

window.addEventListener('histogramUpdate', (e) => {
  if (histogramCtx && e.detail) {
    drawHistogram(e.detail.r, e.detail.g, e.detail.b);
  }
});

function drawHistogram(rBins, gBins, bBins) {
  if (!histogramCtx) return;
  
  const canvas = histogramCanvas;
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  histogramCtx.clearRect(0, 0, w, h);

  // Find global max for normalization
  let maxVal = 1;
  for (let i = 0; i < 256; i++) {
    if (rBins[i] > maxVal) maxVal = rBins[i];
    if (gBins[i] > maxVal) maxVal = gBins[i];
    if (bBins[i] > maxVal) maxVal = bBins[i];
  }

  // Draw each channel as filled area with additive blending
  const drawChannel = (bins, color, fillColor) => {
    histogramCtx.beginPath();
    histogramCtx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      const y = h - (bins[i] / maxVal) * (h - 4);
      histogramCtx.lineTo(x, y);
    }
    histogramCtx.lineTo(w, h);
    histogramCtx.closePath();
    histogramCtx.fillStyle = fillColor;
    histogramCtx.fill();
    
    // Draw line on top
    histogramCtx.beginPath();
    histogramCtx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      const y = h - (bins[i] / maxVal) * (h - 4);
      histogramCtx.lineTo(x, y);
    }
    histogramCtx.strokeStyle = color;
    histogramCtx.lineWidth = 1;
    histogramCtx.stroke();
  };

  // Use 'lighter' composite for additive blending (classic histogram look)
  histogramCtx.globalCompositeOperation = 'lighter';
  drawChannel(rBins, 'rgba(255, 80, 80, 0.9)', 'rgba(255, 40, 40, 0.15)');
  drawChannel(gBins, 'rgba(80, 255, 80, 0.9)', 'rgba(40, 255, 40, 0.15)');
  drawChannel(bBins, 'rgba(80, 120, 255, 0.9)', 'rgba(40, 80, 255, 0.15)');
  histogramCtx.globalCompositeOperation = 'source-over';
}

// UNDO/REDO & COMMIT STATE (HYBRID KEYFRAME STRATEGY)
// ============================================================

const friendlyNames = {
  histEq: 'Auto Brightness',
  clahe: 'CLAHE Brightness',
  unsharpMask: 'Unsharp Mask',
  laplacian: 'Laplacian Sharpness',
  median: 'Median Denoise',
  bilateral: 'Bilateral Denoise',
  grayscale: 'Grayscale',
  negative: 'Negative Color',
  gamma: 'Gamma Correction',
  log: 'Log Transform',
  sobel: 'Sobel Edges',
  prewittEdge: 'Prewitt Edges',
  cannyEdge: 'Canny Edges',
  robertsEdge: 'Roberts Edges',
  houghLines: 'Hough Lines',
  scanDocument: 'Document Scan',
  retinex: 'Retinex Restoration',
  whiteBalance: 'Gray World WB',
  whiteBalanceMax: 'Max White WB',
  hsvView: 'HSV Visualize',
  colorSlicing: 'Color Slicing',
  colorQuant: 'Color Quantization',
  erosion: 'Erosion Morph',
  dilation: 'Dilation Morph',
  opening: 'Opening Morph',
  closing: 'Closing Morph',
  adaptiveThresh: 'Adaptive Morph',
  hitOrMiss: 'Hit-or-Miss Morph',
  boundaryExtraction: 'Boundary Morph',
  thinning: 'Thinning Morph',
  thickening: 'Thickening Morph',
  pruning: 'Pruning Morph',
  morphRecon: 'Reconstruction Morph',
  distanceTransform: 'Distance Trans',
  otsuThreshold: 'Otsu Segment',
  otsuColor: 'Otsu Color Segment',
  regionGrowing: 'Region Growing',
  kmeansSeg: 'K-Means Segment',
  watershed: 'Watershed Segment',
  arithmeticMean: 'Arithmetic Mean Denoise',
  geometricMean: 'Geometric Mean Denoise',
  contraHarmonic: 'Contra-harmonic Denoise',
  adaptiveMedian: 'Adaptive Median Denoise',
  wienerFilter: 'Wiener Restoration',
  inverseFilter: 'Inverse Restoration',
  fftView: 'FFT Spectrum',
  freqLowpass: 'FFT Lowpass',
  freqHighpass: 'FFT Highpass',
  homomorphic: 'Homomorphic Filter'
};

export function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.disabled = globals.historyIndex <= 0;
  if (btnRedo) btnRedo.disabled = globals.historyIndex >= globals.stateHistory.length - 1;
}

// ============================================================
// THUMBNAIL GENERATOR (Improvement 5)
// Runs in requestIdleCallback to avoid blocking main thread
// ============================================================

const THUMB_SIZE = 96; // larger than original 64px — still lightweight (~5KB/img)

function generateThumbnail(imageData, node) {
  const generate = () => {
    try {
      const sw = imageData.width;
      const sh = imageData.height;
      const aspect = sw / sh;

      let tw, th;
      if (aspect >= 1) { tw = THUMB_SIZE; th = Math.round(THUMB_SIZE / aspect); }
      else             { th = THUMB_SIZE; tw = Math.round(THUMB_SIZE * aspect); }

      const offscreen = document.createElement('canvas');
      offscreen.width = tw;
      offscreen.height = th;
      const ctx2 = offscreen.getContext('2d');

      // Draw from an intermediate canvas that holds the imageData
      const src = document.createElement('canvas');
      src.width = sw; src.height = sh;
      src.getContext('2d').putImageData(imageData, 0, 0);
      ctx2.drawImage(src, 0, 0, tw, th);

      node.thumbnail = offscreen.toDataURL('image/jpeg', 0.65);

      // Re-render timeline so the newly created thumbnail shows up
      renderHistoryTimeline();
      renderFilterChain();
    } catch (e) {
      // Silently fail — thumbnail is optional cosmetic feature
    }
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(generate, { timeout: 1000 });
  } else {
    setTimeout(generate, 0);
  }
}

export function renderHistoryTimeline() {
  const container = document.getElementById('historyTimelineContainer');
  if (!container) return;

  container.innerHTML = '';

  globals.stateHistory.forEach((node, idx) => {
    const isCurrent = idx === globals.historyIndex;
    const isFuture  = idx > globals.historyIndex;

    const item = document.createElement('div');
    item.className = 'history-timeline-item';
    if (isCurrent) item.classList.add('active');
    if (isFuture)  item.classList.add('future');

    // -- Thumbnail section --
    if (node.thumbnail) {
      const wrap = document.createElement('div');
      wrap.className = 'history-thumb-wrap';

      const img = document.createElement('img');
      img.className = 'history-thumb';
      img.src = node.thumbnail;
      img.alt = node.name;
      wrap.appendChild(img);

      // Hover zoom tooltip
      const zoom = document.createElement('img');
      zoom.className = 'history-thumb-zoom';
      zoom.src = node.thumbnail;
      zoom.alt = node.name;
      wrap.appendChild(zoom);

      item.appendChild(wrap);
    }

    // -- Text section --
    const info = document.createElement('div');
    info.className = 'history-item-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'history-item-name';
    nameSpan.textContent = node.name;
    info.appendChild(nameSpan);

    if (node.filterType !== 'pristine') {
      const meta = document.createElement('span');
      meta.className = 'history-item-meta';
      meta.textContent = node.filterType ? node.filterType.replace('freq', '').toUpperCase() : '';
      info.appendChild(meta);
    }

    item.appendChild(info);

    if (!isFuture) {
      item.addEventListener('click', () => jumpToHistoryIndex(idx));
    }

    container.appendChild(item);
  });
}

// ============================================================
// FILTER CHAIN VISUALIZER (Improvement 4)
// Shows a horizontal breadcrumb pipeline above the canvas
// ============================================================

const MAX_VISIBLE_NODES = 7; // Show at most 7 nodes; prepend "..." if more

export function renderFilterChain() {
  const bar = document.getElementById('filterChainBar');
  const container = document.getElementById('filterChainContainer');
  if (!bar || !container) return;

  const total = globals.stateHistory.length;
  if (total === 0 || !globals.originalImageData) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  container.innerHTML = '';

  const currentIdx = globals.historyIndex;

  // Build list of node indices to show
  // Strategy: always show all nodes that fit; if > MAX_VISIBLE_NODES, show
  // '...' + last MAX_VISIBLE_NODES-1 nodes (centred on currentIdx when possible)
  let startIdx = 0;
  let showEllipsis = false;

  if (total > MAX_VISIBLE_NODES) {
    // Try to keep currentIdx visible and in the middle of the window
    startIdx = Math.max(0, currentIdx - Math.floor((MAX_VISIBLE_NODES - 1) / 2));
    startIdx = Math.min(startIdx, total - MAX_VISIBLE_NODES);
    if (startIdx > 0) showEllipsis = true;
  }

  if (showEllipsis) {
    const ell = document.createElement('span');
    ell.className = 'filter-chain-node node-ellipsis';
    ell.textContent = '…';
    container.appendChild(ell);

    const arr = document.createElement('span');
    arr.className = 'filter-chain-arrow';
    arr.textContent = '→';
    container.appendChild(arr);
  }

  const endIdx = Math.min(startIdx + MAX_VISIBLE_NODES - 1, total - 1);

  for (let i = startIdx; i <= endIdx; i++) {
    const node = globals.stateHistory[i];
    const isActive = i === currentIdx;
    const isFuture = i > currentIdx;

    if (i > startIdx) {
      const arr = document.createElement('span');
      arr.className = 'filter-chain-arrow' + (isFuture ? ' arrow-future' : '');
      arr.textContent = '→';
      container.appendChild(arr);
    }

    const nodeEl = document.createElement('button');
    nodeEl.className = 'filter-chain-node';
    if (isActive) nodeEl.classList.add('node-active');
    if (isFuture) nodeEl.classList.add('node-future');
    nodeEl.textContent = node.name;
    nodeEl.title = node.name;

    if (!isFuture) {
      nodeEl.addEventListener('click', () => jumpToHistoryIndex(i));
    }

    container.appendChild(nodeEl);
  }

  // Scroll the active node into view within the bar
  const activeNode = container.querySelector('.node-active');
  if (activeNode) {
    requestAnimationFrame(() => activeNode.scrollIntoView({ inline: 'nearest', behavior: 'smooth' }));
  }
}

export function jumpToHistoryIndex(targetIndex) {
  if (targetIndex === globals.historyIndex || targetIndex < 0 || targetIndex >= globals.stateHistory.length) return;
  
  const node = globals.stateHistory[targetIndex];
  
  if (node.hasSnapshot && node.snapshot) {
    // Case 1: snapshot available in RAM, instant restore
    restoreSnapshot(node.snapshot);
    globals.historyIndex = targetIndex;
    updateUndoRedoButtons();
    renderHistoryTimeline();
    renderFilterChain();
  } else {
    // Trường hợp 2: Không có snapshot, tìm ngược keyframe gần nhất và Replay
    let nearestKeyframeIndex = targetIndex;
    while (nearestKeyframeIndex >= 0 && !globals.stateHistory[nearestKeyframeIndex].hasSnapshot) {
      nearestKeyframeIndex--;
    }
    
    if (nearestKeyframeIndex >= 0) {
      const keyframeNode = globals.stateHistory[nearestKeyframeIndex];
      // Khôi phục baseline từ keyframe thô
      restoreSnapshot(keyframeNode.snapshot, false);
      
      // Xây dựng chuỗi Promise Replay tuần tự
      let promise = Promise.resolve();
      
      // Hiển thị loading feedback
      canvasProc.style.transition = 'none';
      canvasProc.style.opacity = '0.4';
      
      for (let i = nearestKeyframeIndex + 1; i <= targetIndex; i++) {
        const stepNode = globals.stateHistory[i];
        promise = promise.then(() => {
          return new Promise((resolve) => {
            // Đồng bộ các thông số state của bước này
            Object.assign(state, stepNode.stateParams);
            state.activeFilter = stepNode.filterType;
            
            const onRenderComplete = () => {
              window.removeEventListener('metricsUpdate', onRenderComplete);
              
              // Bake kết quả của bước này để làm baseline cho bước tiếp theo
              const processedData = ctxProc.getImageData(0, 0, canvasProc.width, canvasProc.height);
              globals.originalImageData = new ImageData(
                new Uint8ClampedArray(processedData.data),
                processedData.width,
                processedData.height
              );
              canvasOrg.width = processedData.width;
              canvasOrg.height = processedData.height;
              ctxOrg.putImageData(processedData, 0, 0);
              
              resolve();
            };
            window.addEventListener('metricsUpdate', onRenderComplete);
            
            showProcessingAndUpdate();
          });
        });
      }
      
      promise.then(() => {
        globals.historyIndex = targetIndex;
        state.activeFilter = null;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
        
        canvasProc.style.transition = 'opacity 0.2s';
        canvasProc.style.opacity = '1.0';
        
        updateUndoRedoButtons();
        renderHistoryTimeline();
        renderFilterChain();
        if (window.fitToView) setTimeout(window.fitToView, 50);
      });
    }
  }
}

export function commitCurrentState() {
  if (!globals.originalImageData) return;

  const processedData = ctxProc.getImageData(0, 0, canvasProc.width, canvasProc.height);

  // Truncate future history — future nodes are discarded (not kept as a branch)
  // This is intentional: after undo + apply new filter, the overwritten branch is gone.
  globals.stateHistory = globals.stateHistory.slice(0, globals.historyIndex + 1);

  // Determine a friendly display name for this filter
  let filterName = state.activeFilter ? state.activeFilter.toUpperCase() : 'Filter';
  if (friendlyNames[state.activeFilter]) {
    filterName = friendlyNames[state.activeFilter];
  }

  // Create the new history node
  const newNode = {
    id: "step_" + Date.now(),
    name: filterName,
    filterType: state.activeFilter,
    stateParams: { ...state }, // Clone state parameters
    hasSnapshot: true,
    thumbnail: null, // Will be generated asynchronously
    snapshot: new ImageData(
      new Uint8ClampedArray(processedData.data),
      processedData.width,
      processedData.height
    )
  };

  globals.stateHistory.push(newNode);

  // Enforce sparse snapshot cache (keep max 3 snapshots excluding pristine)
  let snapshotNodes = globals.stateHistory.filter((node, idx) => idx > 0 && node.hasSnapshot);
  if (snapshotNodes.length > 3) {
    const oldestNode = snapshotNodes[0];
    oldestNode.hasSnapshot = false;
    oldestNode.snapshot = null;
  }

  globals.historyIndex = globals.stateHistory.length - 1;

  // "Bake" the result into originalImageData for the next filter
  globals.originalImageData = new ImageData(
    new Uint8ClampedArray(processedData.data),
    processedData.width,
    processedData.height
  );

  canvasOrg.width = processedData.width;
  canvasOrg.height = processedData.height;
  ctxOrg.putImageData(processedData, 0, 0);

  state.activeFilter = null;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));

  updateUndoRedoButtons();
  showProcessingAndUpdate();
  renderHistoryTimeline();
  renderFilterChain();

  // Generate thumbnail in idle time so it doesn't block UI
  generateThumbnail(processedData, newNode);
}

export function performUndo() {
  if (globals.historyIndex <= 0) return;
  jumpToHistoryIndex(globals.historyIndex - 1);
}

export function performRedo() {
  if (globals.historyIndex >= globals.stateHistory.length - 1) return;
  jumpToHistoryIndex(globals.historyIndex + 1);
}

function restoreSnapshot(snapshot, shouldReUpdate = true) {
  globals.originalImageData = new ImageData(
    new Uint8ClampedArray(snapshot.data),
    snapshot.width,
    snapshot.height
  );

  canvasOrg.width = snapshot.width;
  canvasOrg.height = snapshot.height;
  canvasProc.width = snapshot.width;
  canvasProc.height = snapshot.height;

  ctxOrg.putImageData(snapshot, 0, 0);

  state.activeFilter = null;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
  
  if (shouldReUpdate) {
    showProcessingAndUpdate();
  }

  if (window.fitToView) setTimeout(window.fitToView, 50);
}

export function initHistory() {
  globals.stateHistory = [];
  globals.historyIndex = -1;

  if (globals.pristineImageData) {
    const pristineNode = {
      id: "step_pristine_" + Date.now(),
      name: localStorage.getItem('pixel_lab_lang') === 'en' ? 'Original' : 'Ảnh gốc',
      filterType: 'pristine',
      stateParams: {},
      hasSnapshot: true,
      thumbnail: null,
      snapshot: new ImageData(
        new Uint8ClampedArray(globals.pristineImageData.data),
        globals.pristineImageData.width,
        globals.pristineImageData.height
      )
    };
    globals.stateHistory.push(pristineNode);
    globals.historyIndex = 0;

    // Generate thumbnail asynchronously for the pristine image
    generateThumbnail(globals.pristineImageData, pristineNode);
  }
  updateUndoRedoButtons();
  renderHistoryTimeline();
  renderFilterChain();
}

// Listen to language change to update pristine node name
const langSelectEl = document.getElementById('langSelect');
if (langSelectEl) {
  langSelectEl.addEventListener('change', () => {
    if (globals.stateHistory && globals.stateHistory.length > 0) {
      const pristineNode = globals.stateHistory[0];
      if (pristineNode && pristineNode.filterType === 'pristine') {
        pristineNode.name = localStorage.getItem('pixel_lab_lang') === 'en' ? 'Original' : 'Ảnh gốc';
      }
    }
    renderHistoryTimeline();
  });
}

let currentFileMetadata = {
  type: 'PNG',
  size: '0 B'
};

export function updateImageInfoUI(width, height) {
  const infoDimensions = document.getElementById('infoDimensions');
  const infoFileType = document.getElementById('infoFileType');
  const infoFileSize = document.getElementById('infoFileSize');
  const infoColorMode = document.getElementById('infoColorMode');
  
  if (infoDimensions) infoDimensions.textContent = `${width} × ${height}`;
  if (infoFileType) infoFileType.textContent = currentFileMetadata.type;
  if (infoFileSize) infoFileSize.textContent = currentFileMetadata.size;
  if (infoColorMode) infoColorMode.textContent = 'RGB';
}

window.addEventListener('canvasResized', () => {
  if (globals.originalImageData) {
    updateImageInfoUI(canvasProc.width, canvasProc.height);
  }
});

export function loadImageFromFile(file) {
  if (!file) return;
  
  // Save file metadata
  currentFileMetadata.type = file.type ? file.type.split('/')[1].toUpperCase() : file.name.split('.').pop().toUpperCase();
  if (currentFileMetadata.type === 'JPEG') currentFileMetadata.type = 'JPG';
  currentFileMetadata.size = file.size > 1024 * 1024 
    ? (file.size / 1024 / 1024).toFixed(2) + ' MB' 
    : (file.size / 1024).toFixed(1) + ' KB';

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      canvasOrg.width = img.width;
      canvasOrg.height = img.height;
      canvasProc.width = img.width;
      canvasProc.height = img.height;

      ctxOrg.drawImage(img, 0, 0);
      globals.pristineImageData = ctxOrg.getImageData(0, 0, canvasOrg.width, canvasOrg.height);
      globals.originalImageData = new ImageData(new Uint8ClampedArray(globals.pristineImageData.data), img.width, img.height);

      // Initialize undo/redo history with the pristine image
      initHistory();

      showProcessingAndUpdate(true);
      
      // Update Image Info Card UI
      updateImageInfoUI(img.width, img.height);

      if (window.fitToView) setTimeout(window.fitToView, 50);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

export function showProcessingAndUpdate(isNewImage = false, isPreview = false) {
  canvasProc.style.transition = 'none';
  canvasProc.style.opacity = '0.5';
  setTimeout(() => {
    updateImage(isNewImage, isPreview);
    canvasProc.style.transition = 'opacity 0.2s';
    canvasProc.style.opacity = '1.0';
  }, 10);
}

// Security Blur Interaction
let isDragging = false;
let startX, startY;
const selectionBox = document.getElementById('selectionBox');
const processedContainer = document.getElementById('processedContainer');

processedContainer.addEventListener('mousedown', (e) => {
  if (state.activeFilter !== 'securityBlur' || !globals.originalImageData) return;
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
    const blurRect = { x: Math.floor(boxX), y: Math.floor(boxY), w: Math.floor(boxW), h: Math.floor(boxH) };
    applyFastBoxBlurRegion(globals.originalImageData.data, globals.originalImageData.width, globals.originalImageData.height, blurRect, 10);
    applyFastBoxBlurRegion(globals.originalImageData.data, globals.originalImageData.width, globals.originalImageData.height, blurRect, 10);
    showProcessingAndUpdate();
  }
});

// History & Save
export function saveToHistory() {
  if (!globals.originalImageData) return;
  const dataURL = canvasProc.toDataURL('image/png');
  globals.processingHistory.push(dataURL);

  const imgElement = document.createElement('img');
  imgElement.src = dataURL;
  imgElement.title = "Nhấp để tải ảnh này";
  imgElement.onclick = () => downloadURI(dataURL, `GW_PixelLab_${Date.now()}.png`);
  document.getElementById('historyGallery').appendChild(imgElement);
}

// Listen to AI Upscale completion and integrate it into the main editor workspace
window.addEventListener('aiUpscaleApplied', () => {
  if (!globals.originalImageData) return;
  
  const w = globals.originalImageData.width;
  const h = globals.originalImageData.height;
  
  // Resize both canvases to fit new upscale dimensions
  canvasOrg.width = w;
  canvasOrg.height = h;
  canvasProc.width = w;
  canvasProc.height = h;
  
  // Update canvas contents
  ctxOrg.putImageData(globals.originalImageData, 0, 0);
  ctxProc.putImageData(globals.originalImageData, 0, 0);
  
  // Update file size metadata estimation based on new resolution
  const estimatedSizeBytes = w * h * 4 * 0.45; // PNG estimate (approx 0.45 bytes per pixel for typical anime)
  currentFileMetadata.size = estimatedSizeBytes > 1024 * 1024
    ? (estimatedSizeBytes / 1024 / 1024).toFixed(2) + ' MB'
    : (estimatedSizeBytes / 1024).toFixed(1) + ' KB';
    
  // Update Image Info Card UI
  updateImageInfoUI(w, h);
  
  // Get upscale model and scale for history name from UI controls
  const modelBtn = document.getElementById('aiModelSelect').querySelector('.ai-model-option.active');
  const scaleBtn = document.getElementById('aiScaleSelect').querySelector('.ai-scale-btn.active');
  
  const modelName = modelBtn ? modelBtn.dataset.aiModel.toUpperCase() : 'AI';
  const scale = scaleBtn ? scaleBtn.dataset.scale : '2';
  
  // Clear any active filter class in UI
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
  state.activeFilter = null;
  
  // Truncate history forward of historyIndex
  globals.stateHistory = globals.stateHistory.slice(0, globals.historyIndex + 1);
  
  // Create a new history node for the upscale
  const newNode = {
    id: "step_" + Date.now(),
    name: `AI Upscale (${modelName} ${scale}x)`,
    filterType: 'aiUpscale',
    stateParams: { ...state },
    hasSnapshot: true,
    thumbnail: null,
    snapshot: new ImageData(
      new Uint8ClampedArray(globals.originalImageData.data),
      w,
      h
    )
  };
  
  globals.stateHistory.push(newNode);
  globals.historyIndex = globals.stateHistory.length - 1;
  
  // Update UI, history timeline and fit view
  updateUndoRedoButtons();
  renderHistoryTimeline();
  renderFilterChain();
  showProcessingAndUpdate(true);
  generateThumbnail(globals.originalImageData, newNode);
  
  if (window.fitToView) {
    setTimeout(window.fitToView, 50);
  }
});


