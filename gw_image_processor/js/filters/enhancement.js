import { gaussianBlur } from '../core/utils.js';

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


export function applyMedian(data, width, height) {
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

export function applyBilateralFilter(data, width, height, sigmaColor = 25, sigmaSpace = 1.5) {
  const temp = new Uint8ClampedArray(data);
  const radius = Math.ceil(sigmaSpace * 3);
  const size = radius * 2 + 1;

  const spatialWeights = new Float32Array(size * size);
  const spaceSigma2 = 2 * sigmaSpace * sigmaSpace;
  for (let ky = -radius; ky <= radius; ky++) {
    for (let kx = -radius; kx <= radius; kx++) {
      const dist = kx * kx + ky * ky;
      spatialWeights[(ky + radius) * size + (kx + radius)] = Math.exp(-dist / spaceSigma2);
    }
  }

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
      const xMax = Math.min(width - 1, x + radius);

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

export function applyRetinex(data, width, height, numScales = 3) {
  const scales = [];
  for (let i = 0; i < numScales; i++) scales.push(Math.round(16 + i * 40));

  const H = new Float32Array(width * height);
  const S = new Float32Array(width * height);
  const V = new Float32Array(width * height);
  
  // Convert entire image to HSV space
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const [h, s, v] = rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
    H[i] = h;
    S[i] = s;
    V[i] = v;
  }

  // Downsampling logic for extreme speedup (illumination channel is low-frequency)
  const ds = Math.max(1, Math.floor(Math.max(width, height) / 128));
  
  const avgBlur = new Float32Array(width * height);
  
  if (ds > 1) {
    const dsW = Math.ceil(width / ds);
    const dsH = Math.ceil(height / ds);
    
    // Downsample V channel
    const V_ds = new Float32Array(dsW * dsH);
    for (let dy = 0; dy < dsH; dy++) {
      const syStart = dy * ds;
      const syEnd = Math.min(syStart + ds, height);
      const rowOffset = dy * dsW;
      for (let dx = 0; dx < dsW; dx++) {
        const sxStart = dx * ds;
        const sxEnd = Math.min(sxStart + ds, width);
        let sum = 0, count = 0;
        for (let sy = syStart; sy < syEnd; sy++) {
          const sRowOffset = sy * width;
          for (let sx = sxStart; sx < sxEnd; sx++) {
            sum += V[sRowOffset + sx];
            count++;
          }
        }
        V_ds[rowOffset + dx] = sum / count;
      }
    }
    
    // Compute blurred V_ds for each scale, then upsample and add
    const avgBlur_ds = new Float32Array(dsW * dsH);
    for (let sigma of scales) {
      const sigma_ds = sigma / ds;
      const blur_ds = gaussianBlurChannel(V_ds, dsW, dsH, sigma_ds);
      for (let i = 0; i < dsW * dsH; i++) {
        avgBlur_ds[i] += blur_ds[i];
      }
    }
    
    // Upsample avgBlur_ds back to original resolution using bilinear interpolation
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      const srcY = y / ds;
      const y0 = Math.floor(srcY);
      const y1 = Math.min(y0 + 1, dsH - 1);
      const dy = srcY - y0;
      const y0Offset = y0 * dsW;
      const y1Offset = y1 * dsW;
      
      for (let x = 0; x < width; x++) {
        const srcX = x / ds;
        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, dsW - 1);
        const dx = srcX - x0;
        
        const val00 = avgBlur_ds[y0Offset + x0];
        const val10 = avgBlur_ds[y0Offset + x1];
        const val01 = avgBlur_ds[y1Offset + x0];
        const val11 = avgBlur_ds[y1Offset + x1];
        
        const val0 = val00 * (1 - dx) + val10 * dx;
        const val1 = val01 * (1 - dx) + val11 * dx;
        
        avgBlur[rowOffset + x] = val0 * (1 - dy) + val1 * dy;
      }
    }
  } else {
    // No downsampling needed for small images
    for (let sigma of scales) {
      const blur = gaussianBlurChannel(V, width, height, sigma);
      for (let i = 0; i < width * height; i++) {
        avgBlur[i] += blur[i];
      }
    }
  }

  const scaleInv = 1.0 / numScales;
  
  // Apply Adaptive Local Gamma Correction (Luminance-driven Retinex)
  for (let i = 0; i < width * height; i++) {
    const localLuminance = avgBlur[i] * scaleInv;
    // Compute space-varying gamma (0.5 power controls the boosting strength)
    const gamma = Math.pow((localLuminance + 1) / 256, 0.5);
    let vNew = 255 * Math.pow(V[i] / 255, gamma);
    vNew = Math.min(255, Math.max(0, vNew));
    
    const [r, g, b] = hsvToRgb(H[i], S[i], vNew);
    const idx = i * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
  }
}

function gaussianBlurChannel(channel, width, height, sigma) {
  const radius = Math.min(Math.ceil(2 * sigma), 50);
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

export function applyUnsharpMask(data, width, height, amount, radius) {
  const original = new Uint8ClampedArray(data);
  gaussianBlur(data, width, height, radius);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = original[i] + amount * (original[i] - data[i]);
    data[i + 1] = original[i + 1] + amount * (original[i + 1] - data[i + 1]);
    data[i + 2] = original[i + 2] + amount * (original[i + 2] - data[i + 2]);
    data[i + 3] = original[i + 3];
  }
}

export function applyDenoiseSharpen(data, width, height, strength) {
  const denoiseWeight = Math.max(0, 1 - strength / 60);
  const sharpenWeight = Math.max(0, (strength - 30) / 70);

  const sigmaColor = 8 + 32 * denoiseWeight;
  const sigmaSpace = 0.5 + 1.5 * denoiseWeight;
  applyBilateralFilter(data, width, height, sigmaColor, sigmaSpace);

  if (sharpenWeight > 0) {
    const amount = 3.0 * sharpenWeight;
    const radius = 1.0 + 2.0 * sharpenWeight;
    applyUnsharpMask(data, width, height, amount, radius);
  }
}
