export function applyFastBoxBlurRegion(data, width, height, rect, radius) {
  const { x, y, w, h } = rect;
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(width - 1, x + w);
  const endY = Math.min(height - 1, y + h);
  if (startX >= endX || startY >= endY) return;

  const temp = new Uint8ClampedArray(data);

  // Horizontal pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let kx = -radius; kx <= radius; kx++) {
        const px = cx + kx;
        if (px >= startX && px <= endX) {
          const idx = (cy * width + px) * 4;
          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          count++;
        }
      }
      const dstIdx = (cy * width + cx) * 4;
      data[dstIdx] = r / count;
      data[dstIdx + 1] = g / count;
      data[dstIdx + 2] = b / count;
    }
  }

  // Copy back for vertical pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      const idx = (cy * width + cx) * 4;
      temp[idx] = data[idx];
      temp[idx + 1] = data[idx + 1];
      temp[idx + 2] = data[idx + 2];
    }
  }

  // Vertical pass
  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const py = cy + ky;
        if (py >= startY && py <= endY) {
          const idx = (py * width + cx) * 4;
          r += temp[idx];
          g += temp[idx + 1];
          b += temp[idx + 2];
          count++;
        }
      }
      const dstIdx = (cy * width + cx) * 4;
      data[dstIdx] = r / count;
      data[dstIdx + 1] = g / count;
      data[dstIdx + 2] = b / count;
    }
  }
}
