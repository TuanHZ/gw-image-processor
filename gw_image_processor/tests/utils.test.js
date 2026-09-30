import { applyConvolution } from '../js/core/utils.js';

describe('Utility Convolution Logic', () => {
  test('applyConvolution applies a 3x3 identity kernel correctly', () => {
    // 2x2 image represented in 1D array, 4 channels per pixel (RGBA)
    // Pixel 1: [100, 100, 100, 255]
    // Pixel 2: [50, 50, 50, 255]
    // Pixel 3: [200, 200, 200, 255]
    // Pixel 4: [0, 0, 0, 255]
    const srcData = new Uint8ClampedArray([
      100, 100, 100, 255,  50, 50, 50, 255,
      200, 200, 200, 255,   0,  0,  0, 255
    ]);
    const width = 2;
    const height = 2;

    // 3x3 Identity Kernel
    const identityKernel = [
      0, 0, 0,
      0, 1, 0,
      0, 0, 0
    ];

    const result = applyConvolution(srcData, width, height, identityKernel);

    // Should be exactly the same as srcData for R, G, B channels
    // Since it's a Float32Array, we check first RGB of first pixel
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(100);

    // Check RGB of last pixel
    expect(result[12]).toBe(0);
    expect(result[13]).toBe(0);
    expect(result[14]).toBe(0);
  });
});