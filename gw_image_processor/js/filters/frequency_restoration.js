/**
 * Image Restoration - Frequency Domain (G&W Ch. 5)
 */

export function applyWienerFilter(complexArray, width, height, K, motionAngle, motionLen) {
  const cx = width / 2;
  const cy = height / 2;
  const angleRad = (motionAngle * Math.PI) / 180;
  const a = Math.cos(angleRad) * motionLen;
  const b = Math.sin(angleRad) * motionLen;
  const T = 1.0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x - cx) / width;
      const v = (y - cy) / height;
      const val = Math.PI * (u * a + v * b);
      
      // Compute H(u,v) for Motion Blur
      let hr = 1.0, hi = 0.0;
      if (Math.abs(val) > 1e-6) {
        const s = (T / val) * Math.sin(val);
        hr = s * Math.cos(-val);
        hi = s * Math.sin(-val);
      }

      // Wiener Filter Formula: H* / (|H|^2 + K)
      const hMag2 = hr * hr + hi * hi;
      const den = hMag2 + K;
      const wr = hr / den;
      const wi = -hi / den; // Conjugate H / Denominator

      const idx = y * width + x;
      const r = complexArray.real[idx];
      const i = complexArray.imag[idx];
      
      complexArray.real[idx] = r * wr - i * wi;
      complexArray.imag[idx] = r * wi + i * wr;
    }
  }
}

export function applyInverseFilter(complexArray, width, height, motionAngle, motionLen, threshold = 0.1) {
  const cx = width / 2;
  const cy = height / 2;
  const angleRad = (motionAngle * Math.PI) / 180;
  const a = Math.cos(angleRad) * motionLen;
  const b = Math.sin(angleRad) * motionLen;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x - cx) / width;
      const v = (y - cy) / height;
      const val = Math.PI * (u * a + v * b);
      
      let hr = 1.0, hi = 0.0;
      if (Math.abs(val) > 1e-6) {
        const s = Math.sin(val) / val;
        hr = s * Math.cos(-val);
        hi = s * Math.sin(-val);
      }

      const mag2 = hr * hr + hi * hi;
      if (mag2 < threshold * threshold) {
        // Skip or damp frequencies where H is too small to avoid noise explosion
        continue;
      }

      // Multiply by 1/H
      const idx = y * width + x;
      const r = complexArray.real[idx];
      const i = complexArray.imag[idx];
      
      const den = hr * hr + hi * hi;
      const invR = hr / den;
      const invI = -hi / den;

      complexArray.real[idx] = r * invR - i * invI;
      complexArray.imag[idx] = r * invI + i * invR;
    }
  }
}
