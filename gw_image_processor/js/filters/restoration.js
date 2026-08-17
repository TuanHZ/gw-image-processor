/**
 * Image Restoration - Spatial Domain (G&W Ch. 5)
 * Optimizations: Integral Images for $O(1)$ Mean calculation
 */

/**
 * Computes an Integral Image (Summed Area Table)
 */
function computeIntegralImage(data, width, height) {
  const sum = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      rowSum += data[idx * 4]; // Use Red channel as representative for Gray
      sum[idx] = rowSum + (y > 0 ? sum[(y - 1) * width + x] : 0);
    }
  }
  return sum;
}

function getAreaSum(sum, x1, y1, x2, y2, width) {
  const a = (x1 > 0 && y1 > 0) ? sum[(y1 - 1) * width + (x1 - 1)] : 0;
  const b = (y1 > 0) ? sum[(y1 - 1) * width + x2] : 0;
  const c = (x1 > 0) ? sum[y2 * width + (x1 - 1)] : 0;
  const d = sum[y2 * width + x2];
  return d - b - c + a;
}

export function applyArithmeticMean(data, width, height, size = 3) {
  const sum = computeIntegralImage(data, width, height);
  const result = new Uint8ClampedArray(data.length);
  const offset = Math.floor(size / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - offset);
      const y1 = Math.max(0, y - offset);
      const x2 = Math.min(width - 1, x + offset);
      const y2 = Math.min(height - 1, y + offset);
      
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const areaSum = getAreaSum(sum, x1, y1, x2, y2, width);
      const val = areaSum / count;
      
      const idx = (y * width + x) * 4;
      result[idx] = result[idx + 1] = result[idx + 2] = val;
      result[idx + 3] = 255;
    }
  }
  data.set(result);
}

export function applyGeometricMean(data, width, height, size = 3) {
  const result = new Uint8ClampedArray(data.length);
  const offset = Math.floor(size / 2);
  const invSize = 1 / (size * size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let product = 1.0;
      let count = 0;
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const val = data[(py * width + px) * 4] || 1; // Avoid 0
          product *= Math.pow(val, invSize);
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      result[idx] = result[idx + 1] = result[idx + 2] = product;
      result[idx + 3] = 255;
    }
  }
  data.set(result);
}

export function applyContraHarmonicMean(data, width, height, size = 3, Q = 1.5) {
  const result = new Uint8ClampedArray(data.length);
  const offset = Math.floor(size / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let num = 0, den = 0;
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const val = data[(py * width + px) * 4];
          num += Math.pow(val, Q + 1);
          den += Math.pow(val, Q);
        }
      }
      const finalVal = den === 0 ? 0 : num / den;
      const idx = (y * width + x) * 4;
      result[idx] = result[idx + 1] = result[idx + 2] = finalVal;
      result[idx + 3] = 255;
    }
  }
  data.set(result);
}

export function applyAdaptiveMedian(data, width, height, maxSize = 7) {
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let size = 3;
      let finalVal = 0;
      
      while (size <= maxSize) {
        const offset = Math.floor(size / 2);
        const window = [];
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const px = Math.min(width - 1, Math.max(0, x + kx));
            window.push(data[(py * width + px) * 4]);
          }
        }
        window.sort((a, b) => a - b);
        const min = window[0];
        const max = window[window.length - 1];
        const med = window[Math.floor(window.length / 2)];
        const zxy = data[(y * width + x) * 4];

        // Level A
        const a1 = med - min;
        const a2 = med - max;
        if (a1 > 0 && a2 < 0) {
          // Level B
          const b1 = zxy - min;
          const b2 = zxy - max;
          if (b1 > 0 && b2 < 0) {
            finalVal = zxy;
          } else {
            finalVal = med;
          }
          break;
        } else {
          size += 2;
          if (size > maxSize) {
            finalVal = med;
          }
        }
      }
      const idx = (y * width + x) * 4;
      result[idx] = result[idx + 1] = result[idx + 2] = finalVal;
      result[idx + 3] = 255;
    }
  }
  data.set(result);
}
