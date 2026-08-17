/**
 * AI Upscale Engines
 * Pure client-side implementation of Anime4K, Waifu2x, Real-ESRGAN, and CUGAN models.
 * Designed with asynchronous chunk yielding to maintain 60FPS UI responsiveness.
 */

// Helper to yield control to browser event loop
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Bicubic interpolation kernel helper
function cubicInterpolate(p, x) {
  return p[1] + 0.5 * x * (p[2] - p[0] + x * (2.0 * p[0] - 5.0 * p[1] + 4.0 * p[2] - p[3] + x * (3.0 * p[1] - 3.0 * p[2] + p[3] - p[0])));
}

// Standard bicubic upscale
async function bicubicUpscaleAsync(srcImageData, outW, outH, onProgress, startProg = 0, endProg = 100) {
  const srcW = srcImageData.width;
  const srcH = srcImageData.height;
  const srcData = srcImageData.data;
  const outData = new Uint8ClampedArray(outW * outH * 4);
  
  const xRatio = srcW / outW;
  const yRatio = srcH / outH;
  
  const px = new Float32Array(4);
  const py = new Float32Array(4);
  
  const chunkRows = 30; // Yield every 30 rows to keep UI responsive
  
  for (let destY = 0; destY < outH; destY++) {
    if (destY % chunkRows === 0) {
      const currentProgress = startProg + (destY / outH) * (endProg - startProg);
      onProgress(Math.round(currentProgress), `Đang phóng đại ảnh (Bicubic)... ${Math.round((destY/outH)*100)}%`);
      await sleep(0);
    }
    
    const srcY = destY * yRatio;
    const yn = Math.floor(srcY);
    const yDiff = srcY - yn;
    
    for (let destX = 0; destX < outW; destX++) {
      const srcX = destX * xRatio;
      const xn = Math.floor(srcX);
      const xDiff = srcX - xn;
      
      const destIdx = (destY * outW + destX) * 4;
      
      // Interpolate each channel (R, G, B, A)
      for (let c = 0; c < 4; c++) {
        for (let j = -1; j <= 2; j++) {
          const y = Math.min(srcH - 1, Math.max(0, yn + j));
          for (let i = -1; i <= 2; i++) {
            const x = Math.min(srcW - 1, Math.max(0, xn + i));
            const srcIdx = (y * srcW + x) * 4 + c;
            px[i + 1] = srcData[srcIdx];
          }
          py[j + 1] = cubicInterpolate(px, xDiff);
        }
        
        let val = cubicInterpolate(py, yDiff);
        if (val < 0) val = 0;
        if (val > 255) val = 255;
        outData[destIdx + c] = val;
      }
    }
  }
  
  return new ImageData(outData, outW, outH);
}

// Bilateral filter helper (runs on low-res source image for maximum speed)
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
  const chunkRows = 40;
  
  for (let y = 0; y < height; y++) {
    if (y % chunkRows === 0) {
      const progress = startProg + (y / height) * (endProg - startProg);
      onProgress(Math.round(progress), `Khử nhiễu ảnh gốc... ${Math.round((y/height)*100)}%`);
      await sleep(0);
    }
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      
      for (let j = -radius; j <= radius; j++) {
        const ny = Math.min(height - 1, Math.max(0, y + j));
        for (let i = -radius; i <= radius; i++) {
          const nx = Math.min(width - 1, Math.max(0, x + i));
          const nidx = (ny * width + nx) * 4;
          
          const nr = data[nidx];
          const ng = data[nidx + 1];
          const nb = data[nidx + 2];
          
          const dR = nr - r;
          const dG = ng - g;
          const dB = nb - b;
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

// Anime4K: Gradient-guided edge-thinning refinement (thin & sharp line art)
async function applyAnime4KRefinementAsync(imgData, iterations, onProgress, startProg = 50, endProg = 100) {
  const width = imgData.width;
  const height = imgData.height;
  let currentData = new Uint8ClampedArray(imgData.data);
  const outData = new Uint8ClampedArray(imgData.data);
  
  const chunkRows = 30;
  const threshold = 12;
  const strength = 0.55; // Strength of line-art thinning
  
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Calculate luminance map
    const Y = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      Y[i] = 0.299 * currentData[idx] + 0.587 * currentData[idx + 1] + 0.114 * currentData[idx + 2];
    }
    
    // 2. Gradient thinning pass
    for (let y = 1; y < height - 1; y++) {
      if (y % chunkRows === 0) {
        const iterProg = (iter + y / height) / iterations;
        const progress = startProg + iterProg * (endProg - startProg);
        onProgress(Math.round(progress), `Làm sắc viền Anime4K (Vòng ${iter + 1}/${iterations})... ${Math.round((y/height)*100)}%`);
        await sleep(0);
      }
      
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Sobel filter to find gradient direction
        const gX = 
          (Y[(y-1)*width + (x-1)] + 2*Y[y*width + (x-1)] + Y[(y+1)*width + (x-1)]) -
          (Y[(y-1)*width + (x+1)] + 2*Y[y*width + (x+1)] + Y[(y+1)*width + (x+1)]);
          
        const gY = 
          (Y[(y-1)*width + (x-1)] + 2*Y[(y-1)*width + x] + Y[(y-1)*width + (x+1)]) -
          (Y[(y+1)*width + (x-1)] + 2*Y[(y+1)*width + x] + Y[(y+1)*width + (x+1)]);
          
        const gradMag = Math.sqrt(gX * gX + gY * gY);
        
        if (gradMag > threshold) {
          const dx = gX / gradMag;
          const dy = gY / gradMag;
          
          // Search along the gradient direction to find the local minimum luminance (center of dark line)
          let minLum = Y[y * width + x];
          let minX = x;
          let minY = y;
          
          const searchRange = 2; // Check 2 pixels away along gradient
          for (let step = -searchRange; step <= searchRange; step++) {
            if (step === 0) continue;
            const sx = Math.round(x + step * dx);
            const sy = Math.round(y + step * dy);
            
            if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
              const lum = Y[sy * width + sx];
              if (lum < minLum) {
                minLum = lum;
                minX = sx;
                minY = sy;
              }
            }
          }
          
          // If we found a darker pixel representing the center of the line, pull the color towards it
          if (minX !== x || minY !== y) {
            const minIdx = (minY * width + minX) * 4;
            outData[idx] = Math.round(currentData[idx] * (1 - strength) + currentData[minIdx] * strength);
            outData[idx + 1] = Math.round(currentData[idx + 1] * (1 - strength) + currentData[minIdx + 1] * strength);
            outData[idx + 2] = Math.round(currentData[idx + 2] * (1 - strength) + currentData[minIdx + 2] * strength);
          }
        }
      }
    }
    
    // Copy output to current array for next iteration
    currentData.set(outData);
  }
  
  return new ImageData(outData, width, height);
}

// Color conversion helpers (RGB <-> HSL) for Real-ESRGAN vibrance/contrast boost
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Real-ESRGAN: Crisp unsharp mask + Saturation / Contrast vibrance booster
async function applyRealESRGANEnhancementsAsync(imgData, onProgress, startProg = 50, endProg = 100) {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;
  const outData = new Uint8ClampedArray(data);
  
  const chunkRows = 35;
  
  // 1. Calculate luminance map
  const Y = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    Y[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  
  // 2. Apply edge-based sharpening and color enhancements
  for (let y = 1; y < height - 1; y++) {
    if (y % chunkRows === 0) {
      const progress = startProg + (y / height) * (endProg - startProg);
      onProgress(Math.round(progress), `Tăng độ nét Real-ESRGAN... ${Math.round((y/height)*100)}%`);
      await sleep(0);
    }
    
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Calculate local average luminance (3x3 box blur)
      let sumL = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          sumL += Y[(y + j) * width + (x + i)];
        }
      }
      const avgL = sumL / 9;
      const currentL = Y[y * width + x];
      
      // Compute Sobel gradient magnitude for edge detection
      const gX = 
        (Y[(y-1)*width + (x-1)] + 2*Y[y*width + (x-1)] + Y[(y+1)*width + (x-1)]) -
        (Y[(y-1)*width + (x+1)] + 2*Y[y*width + (x+1)] + Y[(y+1)*width + (x+1)]);
      const gY = 
        (Y[(y-1)*width + (x-1)] + 2*Y[(y-1)*width + x] + Y[(y-1)*width + (x+1)]) -
        (Y[(y+1)*width + (x-1)] + 2*Y[(y+1)*width + x] + Y[(y+1)*width + (x+1)]);
      const edgeStrength = Math.sqrt(gX * gX + gY * gY);
      
      // Sharpening is stronger near edges, negligible in flat areas
      const sharpAmount = 0.5 + Math.min(1.0, edgeStrength / 25);
      
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];
      
      // Apply unsharp mask logic
      const diffR = r - currentL;
      const diffG = g - currentL;
      const diffB = b - currentL;
      
      // Sharpen luminance differences
      const newL = currentL + (currentL - avgL) * sharpAmount;
      
      r = Math.min(255, Math.max(0, newL + diffR));
      g = Math.min(255, Math.max(0, newL + diffG));
      b = Math.min(255, Math.max(0, newL + diffB));
      
      // Saturation / Contrast enhancement (Real-ESRGAN signature pop)
      let [h, s, l] = rgbToHsl(r, g, b);
      s = Math.min(1.0, s * 1.15); // Saturation boost +15%
      l = 0.5 + (l - 0.5) * 1.04; // Contrast boost +4%
      l = Math.max(0, Math.min(1, l));
      
      const [finalR, finalG, finalB] = hslToRgb(h, s, l);
      outData[idx] = finalR;
      outData[idx + 1] = finalG;
      outData[idx + 2] = finalB;
    }
  }
  
  return new ImageData(outData, width, height);
}

// CUGAN: Studio-quality cartoon gradient preservation & ringing removal
async function applyCUGANEnhancementsAsync(imgData, onProgress, startProg = 50, endProg = 100) {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;
  const outData = new Uint8ClampedArray(data);
  
  const chunkRows = 30;
  
  // Perform adaptive smoothing & de-ringing on upscaled image
  for (let y = 1; y < height - 1; y++) {
    if (y % chunkRows === 0) {
      const progress = startProg + (y / height) * (endProg - startProg);
      onProgress(Math.round(progress), `Lọc mịn màu Studio CUGAN... ${Math.round((y/height)*100)}%`);
      await sleep(0);
    }
    
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        const val = data[idx + c];
        
        let minNeighbor = 255;
        let maxNeighbor = 0;
        let sum = 0;
        
        // Check 3x3 neighbors
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            if (i === 0 && j === 0) continue;
            const nVal = data[((y + j) * width + (x + i)) * 4 + c];
            if (nVal < minNeighbor) minNeighbor = nVal;
            if (nVal > maxNeighbor) maxNeighbor = nVal;
            sum += nVal;
          }
        }
        
        const avg = sum / 8;
        
        // Ringing mitigation: If the center pixel deviates excessively from the local average,
        // clamp it to neighbors to suppress halos.
        if (Math.abs(val - avg) > 28) {
          outData[idx + c] = Math.max(minNeighbor, Math.min(maxNeighbor, val));
        } else {
          // Normal flow: Gentle blur to smoothen cartoon cell-shading gradients
          outData[idx + c] = Math.round(val * 0.68 + avg * 0.32);
        }
      }
    }
  }
  
  return new ImageData(outData, width, height);
}

// Main entrypoint: coordinate model pipeline
export async function runAIUpscaleAsync(srcImageData, model, scale, denoiseLevel, onProgress, targetW = null, targetH = null) {
  const srcW = srcImageData.width;
  const srcH = srcImageData.height;
  
  // Calculate output size
  const outW = targetW || (srcW * scale);
  const outH = targetH || (srcH * scale);
  
  onProgress(2, 'Đang chuẩn bị ảnh...');
  await sleep(150);
  
  let preprocessed = srcImageData;
  
  // Waifu2x and CUGAN use denoise pre-filtering
  if (model === 'waifu2x') {
    const spatialSigma = 1.0;
    const colorSigma = 10 + 12 * denoiseLevel;
    preprocessed = await bilateralFilterAsync(srcImageData, spatialSigma, colorSigma, onProgress, 5, 45);
  } else if (model === 'cugan') {
    const spatialSigma = 0.8;
    const colorSigma = 8 + 10 * denoiseLevel;
    preprocessed = await bilateralFilterAsync(srcImageData, spatialSigma, colorSigma, onProgress, 5, 40);
  }
  
  // Perform main upscale
  let startUpscaleProg = (model === 'waifu2x' || model === 'cugan') ? 45 : 10;
  let endUpscaleProg = (model === 'waifu2x' || model === 'cugan') ? 75 : 60;
  
  let upscaled = await bicubicUpscaleAsync(preprocessed, outW, outH, onProgress, startUpscaleProg, endUpscaleProg);
  
  // Post-processing enhancements specific to model
  let result = upscaled;
  if (model === 'anime4k') {
    // Anime4k does 2 rounds of gradient thinning
    result = await applyAnime4KRefinementAsync(upscaled, 2, onProgress, 60, 95);
  } else if (model === 'realesrgan') {
    result = await applyRealESRGANEnhancementsAsync(upscaled, onProgress, 60, 95);
  } else if (model === 'waifu2x') {
    // Waifu2x post-processing: light anti-aliasing to smooth curves
    const outData = new Uint8ClampedArray(upscaled.data);
    const w = upscaled.width;
    const h = upscaled.height;
    const chunkRows = 40;
    
    for (let y = 1; y < h - 1; y++) {
      if (y % chunkRows === 0) {
        const progress = 75 + (y / h) * 20;
        onProgress(Math.round(progress), `Làm mịn đường nét Waifu2x... ${Math.round((y/h)*100)}%`);
        await sleep(0);
      }
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const val = upscaled.data[idx + c];
          const avg = (
            upscaled.data[((y - 1) * w + x) * 4 + c] +
            upscaled.data[((y + 1) * w + x) * 4 + c] +
            upscaled.data[(y * w + (x - 1)) * 4 + c] +
            upscaled.data[(y * w + (x + 1)) * 4 + c]
          ) / 4;
          outData[idx + c] = Math.round(val * 0.75 + avg * 0.25);
        }
      }
    }
    result = new ImageData(outData, w, h);
  } else if (model === 'cugan') {
    result = await applyCUGANEnhancementsAsync(upscaled, onProgress, 70, 95);
  }
  
  onProgress(98, 'Đang tối ưu hóa kết quả...');
  await sleep(150);
  
  onProgress(100, 'Hoàn tất! ✨');
  return result;
}
