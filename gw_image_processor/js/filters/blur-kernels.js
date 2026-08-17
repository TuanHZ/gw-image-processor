/**
 * Blur Kernels - Reusable Gaussian Blur (Separable 1D)
 * Designed with async chunk yielding to maintain 60FPS UI responsiveness.
 */

// Helper to yield control to browser event loop
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gaussian Blur - Separable 1D Kernel (async, chunked)
 * @param {ImageData} srcImageData
 * @param {number} radius - kernel radius (1-10)
 * @param {Function} onProgress - callback (percent, text)
 * @param {number} startProg - progress range start
 * @param {number} endProg - progress range end
 * @return {Promise<ImageData>}
 */
export async function gaussianBlur2DAsync(srcImageData, radius, onProgress, startProg = 0, endProg = 100) {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const data = srcImageData.data;
  
  // Build 1D Gaussian kernel
  const kernelSize = 2 * radius + 1;
  const kernel = new Float32Array(kernelSize);
  const sigma = Math.max(radius / 2.57, 0.5);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = val;
    sum += val;
  }
  // Normalize
  for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;
  
  const midProg = startProg + (endProg - startProg) * 0.5;
  const chunkRows = 25;
  
  // Horizontal pass
  const tempData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (y % chunkRows === 0) {
      const progress = startProg + (y / height) * (midProg - startProg);
      onProgress(Math.round(progress), `Blur ngang... ${Math.round((y / height) * 100)}%`);
      await sleep(0);
    }
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
      for (let i = -radius; i <= radius; i++) {
        const nx = Math.min(width - 1, Math.max(0, x + i));
        const srcIdx = (y * width + nx) * 4;
        const w = kernel[i + radius];
        sumR += data[srcIdx] * w;
        sumG += data[srcIdx + 1] * w;
        sumB += data[srcIdx + 2] * w;
        sumA += data[srcIdx + 3] * w;
      }
      const destIdx = (y * width + x) * 4;
      tempData[destIdx] = sumR;
      tempData[destIdx + 1] = sumG;
      tempData[destIdx + 2] = sumB;
      tempData[destIdx + 3] = sumA;
    }
  }
  
  // Vertical pass
  const outData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (y % chunkRows === 0) {
      const progress = midProg + (y / height) * (endProg - midProg);
      onProgress(Math.round(progress), `Blur dọc... ${Math.round((y / height) * 100)}%`);
      await sleep(0);
    }
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
      for (let i = -radius; i <= radius; i++) {
        const ny = Math.min(height - 1, Math.max(0, y + i));
        const srcIdx = (ny * width + x) * 4;
        const w = kernel[i + radius];
        sumR += tempData[srcIdx] * w;
        sumG += tempData[srcIdx + 1] * w;
        sumB += tempData[srcIdx + 2] * w;
        sumA += tempData[srcIdx + 3] * w;
      }
      const destIdx = (y * width + x) * 4;
      outData[destIdx] = sumR;
      outData[destIdx + 1] = sumG;
      outData[destIdx + 2] = sumB;
      outData[destIdx + 3] = sumA;
    }
  }
  
  return new ImageData(outData, width, height);
}
