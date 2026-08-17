/**
 * FFT Core Module - Phase 7
 * Implements Iterative Cooley-Tukey Fast Fourier Transform
 */

export class ComplexArray {
  constructor(size) {
    this.real = new Float32Array(size);
    this.imag = new Float32Array(size);
    this.size = size;
  }
}

/**
 * 1D FFT Iterative Implementation (Cooley-Tukey)
 */
export function fft1d(real, imag) {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Iterative FFT
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenReal = Math.cos(angle);
    const wLenImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wReal = 1;
      let wImag = 0;
      for (let k = 0; k < len / 2; k++) {
        const uIdx = i + k;
        const vIdx = i + k + len / 2;
        const uReal = real[uIdx], uImag = imag[uIdx];
        const vReal = real[vIdx], vImag = imag[vIdx];

        // t = w * v
        const tReal = wReal * vReal - wImag * vImag;
        const tImag = wReal * vImag + wImag * vReal;

        real[uIdx] = uReal + tReal;
        imag[uIdx] = uImag + tImag;
        real[vIdx] = uReal - tReal;
        imag[vIdx] = uImag - tImag;

        // w = w * wLen
        const nextWReal = wReal * wLenReal - wImag * wLenImag;
        wImag = wReal * wLenImag + wImag * wLenReal;
        wReal = nextWReal;
      }
    }
  }
}

/**
 * Inverse 1D FFT
 */
export function ifft1d(real, imag) {
  const n = real.length;
  // Conjugate
  for (let i = 0; i < n; i++) imag[i] = -imag[i];
  
  fft1d(real, imag);
  
  // Conjugate again and divide by N
  for (let i = 0; i < n; i++) {
    real[i] /= n;
    imag[i] = -imag[i] / n;
  }
}

/**
 * 2D FFT using Row-Column Decomposition
 */
export function fft2d(complexArray, width, height) {
  // Rows
  for (let y = 0; y < height; y++) {
    const rowReal = complexArray.real.subarray(y * width, (y + 1) * width);
    const rowImag = complexArray.imag.subarray(y * width, (y + 1) * width);
    fft1d(rowReal, rowImag);
  }

  // Columns
  const colReal = new Float32Array(height);
  const colImag = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colReal[y] = complexArray.real[y * width + x];
      colImag[y] = complexArray.imag[y * width + x];
    }
    fft1d(colReal, colImag);
    for (let y = 0; y < height; y++) {
      complexArray.real[y * width + x] = colReal[y];
      complexArray.imag[y * width + x] = colImag[y];
    }
  }
}

export function ifft2d(complexArray, width, height) {
  // Columns
  const colReal = new Float32Array(height);
  const colImag = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colReal[y] = complexArray.real[y * width + x];
      colImag[y] = complexArray.imag[y * width + x];
    }
    ifft1d(colReal, colImag);
    for (let y = 0; y < height; y++) {
      complexArray.real[y * width + x] = colReal[y];
      complexArray.imag[y * width + x] = colImag[y];
    }
  }

  // Rows
  for (let y = 0; y < height; y++) {
    const rowReal = complexArray.real.subarray(y * width, (y + 1) * width);
    const rowImag = complexArray.imag.subarray(y * width, (y + 1) * width);
    ifft1d(rowReal, rowImag);
  }
}

/**
 * Centering the spectrum (Shift DC to center)
 */
export function shiftFFT(complexArray, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 !== 0) {
        const idx = y * width + x;
        complexArray.real[idx] = -complexArray.real[idx];
        complexArray.imag[idx] = -complexArray.imag[idx];
      }
    }
  }
}

/**
 * Magnitude spectrum visualization (Log Scale)
 */
export function getMagnitudeSpectrum(complexArray, width, height) {
  const spectrum = new Float32Array(width * height);
  let maxMag = 0;
  for (let i = 0; i < width * height; i++) {
    const mag = Math.sqrt(complexArray.real[i]**2 + complexArray.imag[i]**2);
    spectrum[i] = Math.log(1 + mag);
    if (spectrum[i] > maxMag) maxMag = spectrum[i];
  }
  
  const result = new Uint8ClampedArray(width * height * 4);
  const scale = 255 / maxMag;
  for (let i = 0; i < width * height; i++) {
    const val = spectrum[i] * scale;
    const idx = i * 4;
    result[idx] = result[idx + 1] = result[idx + 2] = val;
    result[idx + 3] = 255;
  }
  return result;
}

/**
 * Pad image to next power of two
 */
export function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}
