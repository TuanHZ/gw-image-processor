import { state } from './state.js';
import { ctxProc, globals, canvasProc } from './constants.js';

let worker = null;
let isProcessing = false;
let pendingRequest = null;
let currentRequestId = 0;
let lastProcessedRequestId = 0;
let loadingTimeout = null;

function initWorker() {
  if (worker) return;
  worker = new Worker(new URL('../worker.js?v=' + Date.now(), import.meta.url), { type: 'module' });
  
  worker.onmessage = function(e) {
    const { imageData, histogram, metrics, isPreview, requestId } = e.data;
    
    // Discard outdated request results
    if (requestId !== undefined && requestId < lastProcessedRequestId) {
      return;
    }
    if (requestId !== undefined) {
      lastProcessedRequestId = requestId;
    }
    
    if (!isPreview) {
      // Hide loading overlay
      if (loadingTimeout) clearTimeout(loadingTimeout);
      const overlay = document.getElementById('canvasLoadingOverlay');
      if (overlay) overlay.style.display = 'none';
      
      // Full resolution result: update canvas width/height if it changed
      if (canvasProc.width !== imageData.width || canvasProc.height !== imageData.height) {
          canvasProc.width = imageData.width;
          canvasProc.height = imageData.height;
          window.dispatchEvent(new Event('canvasResized'));
      }
      ctxProc.putImageData(imageData, 0, 0);
      window.dispatchEvent(new CustomEvent('filter-updated'));
    } else {
      // Preview result: render stretched onto canvasProc (do not resize canvasProc)
      if (globals.originalImageData) {
        const offscreen = document.createElement('canvas');
        offscreen.width = imageData.width;
        offscreen.height = imageData.height;
        offscreen.getContext('2d').putImageData(imageData, 0, 0);
        
        ctxProc.clearRect(0, 0, canvasProc.width, canvasProc.height);
        ctxProc.drawImage(offscreen, 0, 0, canvasProc.width, canvasProc.height);
      }
    }

    // Dispatch histogram data for UI rendering
    if (histogram) {
      window.dispatchEvent(new CustomEvent('histogramUpdate', { detail: histogram }));
    }

    // Dispatch metrics data for UI rendering (only for full resolution results)
    if (metrics) {
      window.dispatchEvent(new CustomEvent('metricsUpdate', { detail: metrics }));
    }
    
    // UI Feedback: Restore opacity
    canvasProc.style.transition = 'opacity 0.2s';
    canvasProc.style.opacity = '1.0';
    
    isProcessing = false;
    if (pendingRequest) {
      const { imageData: nextData, isNewImage: nextNewImage, isPreview: nextPreview, requestId: nextReqId } = pendingRequest;
      pendingRequest = null;
      sendToWorker(nextData, nextNewImage, nextPreview, nextReqId);
    }
  };

  worker.onerror = function(err) {
    console.error("Web Worker error:", err);
    canvasProc.style.transition = 'opacity 0.2s';
    canvasProc.style.opacity = '1.0';
    if (loadingTimeout) clearTimeout(loadingTimeout);
    const overlay = document.getElementById('canvasLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
    isProcessing = false;
    pendingRequest = null;
  };
}

function downscaleImageData(srcImageData, maxDim = 256) {
  const width = srcImageData.width;
  const height = srcImageData.height;
  if (width <= maxDim && height <= maxDim) {
    return srcImageData;
  }
  
  let targetW, targetH;
  if (width > height) {
    targetW = maxDim;
    targetH = Math.round((height * maxDim) / width);
  } else {
    targetH = maxDim;
    targetW = Math.round((width * maxDim) / height);
  }
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(srcImageData, 0, 0);
  
  const scaleCanvas = document.createElement('canvas');
  scaleCanvas.width = targetW;
  scaleCanvas.height = targetH;
  const scaleCtx = scaleCanvas.getContext('2d');
  scaleCtx.drawImage(tempCanvas, 0, 0, targetW, targetH);
  
  return scaleCtx.getImageData(0, 0, targetW, targetH);
}

function sendToWorker(imageData, isNewImage = false, isPreview = false, requestId = 0) {
  isProcessing = true;
  
  // UI Feedback: Dim canvas
  canvasProc.style.transition = 'none';
  canvasProc.style.opacity = '0.5';

  if (!isPreview) {
    // Show loading overlay after 300ms delay to prevent flickering
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      const overlay = document.getElementById('canvasLoadingOverlay');
      if (overlay) overlay.style.display = 'flex';
    }, 300);
  }

  worker.postMessage({
    imageData,
    state: { ...state }, // Clone state
    width: imageData.width,
    height: imageData.height,
    isNewImage,
    isPreview,
    requestId
  }, [imageData.data.buffer]);
}

export function updateImage(isNewImage = false, isPreview = false) {
  if (!globals.originalImageData) return;
  initWorker();

  const reqId = ++currentRequestId;

  let imageData;
  if (isPreview) {
    const active = state.activeFilter;
    const sharpFilters = ['unsharpMask', 'laplacian', 'denoiseSharpen', 'sobel', 'prewittEdge', 'cannyEdge', 'robertsEdge', 'houghLines'];
    const maxDim = sharpFilters.includes(active) ? 512 : 256;
    
    const rawData = new ImageData(
      new Uint8ClampedArray(globals.originalImageData.data),
      globals.originalImageData.width,
      globals.originalImageData.height
    );
    imageData = downscaleImageData(rawData, maxDim);
  } else {
    imageData = new ImageData(
      new Uint8ClampedArray(globals.originalImageData.data),
      globals.originalImageData.width,
      globals.originalImageData.height
    );
  }

  if (isProcessing) {
    pendingRequest = { imageData, isNewImage, isPreview, requestId: reqId };
  } else {
    sendToWorker(imageData, isNewImage, isPreview, reqId);
  }
}
