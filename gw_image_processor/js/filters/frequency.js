/**
 * Frequency Domain Filters - Phase 7
 */

export function applyIdealFilter(complexArray, width, height, cutoff, isHighpass) {
  const cx = width / 2;
  const cy = height / 2;
  const d0_2 = cutoff * cutoff;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      let mask = d2 <= d0_2 ? 1 : 0;
      if (isHighpass) mask = 1 - mask;

      const idx = y * width + x;
      complexArray.real[idx] *= mask;
      complexArray.imag[idx] *= mask;
    }
  }
}

export function applyButterworthFilter(complexArray, width, height, cutoff, order, isHighpass) {
  const cx = width / 2;
  const cy = height / 2;
  const n2 = 2 * order;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      let h = 1 / (1 + Math.pow(d / cutoff, n2));
      if (isHighpass) h = 1 - h;

      const idx = y * width + x;
      complexArray.real[idx] *= h;
      complexArray.imag[idx] *= h;
    }
  }
}

export function applyGaussianFilter(complexArray, width, height, cutoff, isHighpass) {
  const cx = width / 2;
  const cy = height / 2;
  const d0_2 = 2 * (cutoff ** 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      let h = Math.exp(-d2 / d0_2);
      if (isHighpass) h = 1 - h;

      const idx = y * width + x;
      complexArray.real[idx] *= h;
      complexArray.imag[idx] *= h;
    }
  }
}

export function applyNotchFilter(complexArray, width, height, u0, v0, cutoff, order) {
  const cx = width / 2;
  const cy = height / 2;
  const n2 = 2 * order;

  // Symmetric points
  const p1 = { u: cx + u0, v: cy + v0 };
  const p2 = { u: cx - u0, v: cy - v0 };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d1 = Math.sqrt((x - p1.u)**2 + (y - p1.v)**2);
      const d2 = Math.sqrt((x - p2.u)**2 + (y - p2.v)**2);
      
      const h1 = 1 / (1 + Math.pow(cutoff / d1, n2));
      const h2 = 1 / (1 + Math.pow(cutoff / d2, n2));
      const h = h1 * h2;

      const idx = y * width + x;
      complexArray.real[idx] *= h;
      complexArray.imag[idx] *= h;
    }
  }
}
