import { ComplexArray, fft1d } from '../js/core/fft.js';

describe('Fast Fourier Transform Core Algorithms', () => {
  test('fft1d correctly transforms a simple 1D real signal', () => {
    // Basic pulse signal [1, 0, 0, 0]
    const real = new Float32Array([1, 0, 0, 0]);
    const imag = new Float32Array([0, 0, 0, 0]);

    fft1d(real, imag);

    // FFT of delta impulse [1, 0, 0, 0] should be a DC offset [1, 1, 1, 1]
    expect(real[0]).toBeCloseTo(1, 5);
    expect(real[1]).toBeCloseTo(1, 5);
    expect(real[2]).toBeCloseTo(1, 5);
    expect(real[3]).toBeCloseTo(1, 5);

    expect(imag[0]).toBeCloseTo(0, 5);
    expect(imag[1]).toBeCloseTo(0, 5);
    expect(imag[2]).toBeCloseTo(0, 5);
    expect(imag[3]).toBeCloseTo(0, 5);
  });

  test('fft1d handles flat DC signal correctly', () => {
    // Constant signal [2, 2, 2, 2]
    const real = new Float32Array([2, 2, 2, 2]);
    const imag = new Float32Array([0, 0, 0, 0]);

    fft1d(real, imag);

    // DC component (0 Hz) should be N * amplitude = 4 * 2 = 8
    expect(real[0]).toBeCloseTo(8, 5);
    // Other frequencies should be 0
    expect(real[1]).toBeCloseTo(0, 5);
    expect(real[2]).toBeCloseTo(0, 5);
    expect(real[3]).toBeCloseTo(0, 5);
  });

  test('ComplexArray initializes correctly', () => {
      const arr = new ComplexArray(4);
      expect(arr.size).toBe(4);
      expect(arr.real.length).toBe(4);
      expect(arr.imag.length).toBe(4);
  });
});