export function applyConvolution(srcData, width, height, kernel) {
  const kSize = Math.sqrt(kernel.length);
  const half = Math.floor(kSize / 2);
  const dstData = new Float32Array(srcData.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const cy = Math.min(Math.max(y + ky - half, 0), height - 1);
          const cx = Math.min(Math.max(x + kx - half, 0), width - 1);
          const srcIdx = (cy * width + cx) * 4;
          const weight = kernel[ky * kSize + kx];
          r += srcData[srcIdx] * weight;
          g += srcData[srcIdx + 1] * weight;
          b += srcData[srcIdx + 2] * weight;
        }
      }
      dstData[dstIdx] = r;
      dstData[dstIdx + 1] = g;
      dstData[dstIdx + 2] = b;
      dstData[dstIdx + 3] = srcData[dstIdx + 3];
    }
  }
  return dstData;
}

export function gaussianBlur(data, width, height, sigma) {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = new Float32Array(size * size);
  const sigma2 = sigma * sigma;
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = (x - center) ** 2 + (y - center) ** 2;
      const val = Math.exp(-dist / (2 * sigma2)) / (2 * Math.PI * sigma2);
      kernel[y * size + x] = val;
      sum += val;
    }
  }

  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const blurred = applyConvolution(data, width, height, kernel);
  for (let i = 0; i < data.length; i++) data[i] = blurred[i];
}

export function downloadURI(uri, name) {
  const link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
