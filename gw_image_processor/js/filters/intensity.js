import { applyConvolution } from '../core/utils.js';

export function applyGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
}

export function applyNegative(data) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

export function applyLog(data) {
  // LUT Optimization
  const lut = new Uint8Array(256);
  const cLog = 255 / Math.log(1 + 255);
  for (let i = 0; i < 256; i++) {
    lut[i] = cLog * Math.log(1 + i);
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

export function applyGamma(data, gamma) {
  // LUT Optimization
  const lut = new Uint8Array(256);
  const cGamma = 255 / Math.pow(255, gamma);
  for (let i = 0; i < 256; i++) {
    lut[i] = cGamma * Math.pow(i, gamma);
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

export function applyHistogram(data, totalPixels) {
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

export function applyCLAHE(data, width, height, clipLimit = 2.0, tileSize = 16) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  const nTilesX = Math.ceil(width / tileSize);
  const nTilesY = Math.ceil(height / tileSize);
  const clipped = new Uint8ClampedArray(lum);

  for (let ty = 0; ty < nTilesY; ty++) {
    for (let tx = 0; tx < nTilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);

      const hist = new Uint32Array(256);
      const pixelCount = (x1 - x0) * (y1 - y0);
      const clipThreshold = Math.floor(clipLimit * pixelCount / 256);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[lum[y * width + x]]++;
        }
      }

      let clipped_count = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipThreshold) {
          clipped_count += hist[i] - clipThreshold;
          hist[i] = clipThreshold;
        }
      }

      const redistBins = 256;
      const redistValue = Math.floor(clipped_count / redistBins);
      for (let i = 0; i < 256; i++) hist[i] += redistValue;

      const cdf = new Uint32Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];

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

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const ratio = clipped[i] / Math.max(1, lum[i]);
    data[idx] = Math.min(255, data[idx] * ratio);
    data[idx + 1] = Math.min(255, data[idx + 1] * ratio);
    data[idx + 2] = Math.min(255, data[idx + 2] * ratio);
  }
}

export function applyAdaptiveThreshold(data, width, height, kSize) {
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
