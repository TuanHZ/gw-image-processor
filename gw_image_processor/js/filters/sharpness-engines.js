/**
 * Sharpness Engines
 * Pure client-side implementation of Denoise+Sharpen combo.
 * Designed with asynchronous chunk yielding to maintain 60FPS UI responsiveness.
 */

import { gaussianBlur2DAsync } from './blur-kernels.js';

// Helper to yield control to browser event loop
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Denoise + Sharpen Combo
// ============================================================

/**
 * Denoise + Sharpen combo:
 * 1. Bilateral Filter (khử nhiễu)
 * 2. Unsharp Mask (làm nét)
 * 
 * @param {ImageData} srcImageData
 * @param {number} strength - 0-100 (%)
 * @param {number} radius - 1-5 (px)
 * @param {Function} onProgress - callback (percent, text)
 * @return {Promise<ImageData>}
 */
export async function denoiseAndSharpenAsync(srcImageData, strength, radius, onProgress) {
  const denoiseStrength = strength / 100;      // Convert 0-100 to 0-1
  const intensity = strength * 2;               // Convert to 0-200 range for unsharp
  
  onProgress(5, 'Đang khử nhiễu ảnh...');
  
  // Bilateral filter (denoise)
  const spatialSigma = 1.0;
  const colorSigma = 8 + 10 * denoiseStrength;
  const denoised = await bilateralFilterAsync(srcImageData, spatialSigma, colorSigma, onProgress, 10, 50);
  
  onProgress(55, 'Đang làm nét ảnh...');
  
  // Unsharp mask (sharpen)
  const sharpened = await unsharpMaskAsync(denoised, intensity, radius, onProgress);
  
  onProgress(100, 'Hoàn tất! ✨');
  return sharpened;
}

// ============================================================
// Helper: Unsharp Mask
// ============================================================

/**
 * Unsharp Mask Helper:
 * 1. Gaussian Blur
 * 2. Original + (Original - Blur) * intensity
 */
async function unsharpMaskAsync(
  srcImageData,
  intensity,
  radius,
  onProgress,
  startProg = 55,
  endProg = 100
) {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const data = srcImageData.data;
  
  const blurred = await gaussianBlur2DAsync(srcImageData, radius, onProgress, startProg, endProg - 10);
  const blurData = blurred.data;
  
  const outData = new Uint8ClampedArray(data.length);
  const intensityFactor = intensity / 100;
  const chunkRows = 40;
  
  for (let y = 0; y < height; y++) {
    if (y % chunkRows === 0) {
      const progress = (startProg + 35) + (y / height) * (endProg - (startProg + 35));
      onProgress(Math.round(progress), `Áp dụng Unsharp Mask... ${Math.round((y / height) * 100)}%`);
      await sleep(0);
    }
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const original = data[idx + c];
        const blurVal = blurData[idx + c];
        const mask = original - blurVal;
        const sharpened = original + mask * intensityFactor;
        outData[idx + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
      }
      outData[idx + 3] = data[idx + 3]; // Alpha
    }
  }
  
  return new ImageData(outData, width, height);
}

// ============================================================
// Helper: Bilateral Filter (Denoise)
// ============================================================

/**
 * Bilateral Filter for denoising
 * Edge-preserving smoothing filter
 */
async function bilateralFilterAsync(srcImageData, spatialSigma, colorSigma, onProgress, startProg = 0, endProg = 100) {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const data = srcImageData.data;
  const outData = new Uint8ClampedArray(width * height * 4);
  
  const radius = Math.ceil(spatialSigma * 1.8);
  const spatialWeight = new Float32Array((2 * radius + 1) * (2 * radius + 1));
  
  // Precompute spatial Gaussian weights
  for (let j = -radius; j <= radius; j++) {
    for (let i = -radius; i <= radius; i++) {
      const idx = (j + radius) * (2 * radius + 1) + (i + radius);
      spatialWeight[idx] = Math.exp(-(i * i + j * j) / (2 * spatialSigma * spatialSigma));
    }
  }
  
  const factor = -1 / (2 * colorSigma * colorSigma);
  const chunkRows = 30;
  
  for (let y = 0; y < height; y++) {
    if (y % chunkRows === 0) {
      const progress = startProg + (y / height) * (endProg - startProg);
      onProgress(Math.round(progress), `Khử nhiễu Bilateral... ${Math.round((y / height) * 100)}%`);
      await sleep(0);
    }
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      
      for (let j = -radius; j <= radius; j++) {
        const ny = Math.min(height - 1, Math.max(0, y + j));
        for (let i = -radius; i <= radius; i++) {
          const nx = Math.min(width - 1, Math.max(0, x + i));
          const nidx = (ny * width + nx) * 4;
          
          const nr = data[nidx], ng = data[nidx + 1], nb = data[nidx + 2];
          const dR = nr - r, dG = ng - g, dB = nb - b;
          const colorDistSq = dR * dR + dG * dG + dB * dB;
          
          const sW = spatialWeight[(j + radius) * (2 * radius + 1) + (i + radius)];
          const cW = Math.exp(colorDistSq * factor);
          const w = sW * cW;
          
          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          sumW += w;
        }
      }
      
      outData[idx] = sumW > 0 ? Math.min(255, Math.max(0, sumR / sumW)) : r;
      outData[idx + 1] = sumW > 0 ? Math.min(255, Math.max(0, sumG / sumW)) : g;
      outData[idx + 2] = sumW > 0 ? Math.min(255, Math.max(0, sumB / sumW)) : b;
      outData[idx + 3] = a;
    }
  }
  
  return new ImageData(outData, width, height);
}
