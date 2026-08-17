import { applyConvolution, gaussianBlur } from '../core/utils.js';

export function applySobel(data, width, height) {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gx = applyConvolution(data, width, height, sobelX);
  const gy = applyConvolution(data, width, height, sobelY);
  for (let i = 0; i < data.length; i += 4) {
    const magR = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const magG = Math.sqrt(gx[i + 1] * gx[i + 1] + gy[i + 1] * gy[i + 1]);
    const magB = Math.sqrt(gx[i + 2] * gx[i + 2] + gy[i + 2] * gy[i + 2]);
    data[i] = Math.min(255, magR);
    data[i + 1] = Math.min(255, magG);
    data[i + 2] = Math.min(255, magB);
  }
}

export function applyPrewittEdge(data, width, height) {
  const prewittX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const prewittY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
  const gx = applyConvolution(data, width, height, prewittX);
  const gy = applyConvolution(data, width, height, prewittY);
  for (let i = 0; i < data.length; i += 4) {
    const magR = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const magG = Math.sqrt(gx[i + 1] * gx[i + 1] + gy[i + 1] * gy[i + 1]);
    const magB = Math.sqrt(gx[i + 2] * gx[i + 2] + gy[i + 2] * gy[i + 2]);
    data[i] = Math.min(255, magR);
    data[i + 1] = Math.min(255, magG);
    data[i + 2] = Math.min(255, magB);
  }
}

export function applyCannyEdgeDetection(data, width, height, lowThresh = 50, highThresh = 150) {
  const blurred = new Uint8ClampedArray(data);
  gaussianBlur(blurred, width, height, 1);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gx = applyConvolution(blurred, width, height, sobelX);
  const gy = applyConvolution(blurred, width, height, sobelY);

  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const gxVal = gx[i * 4], gyVal = gy[i * 4];
    magnitude[i] = Math.sqrt(gxVal * gxVal + gyVal * gyVal);
    direction[i] = Math.atan2(gyVal, gxVal);
  }

  const suppressed = new Uint8ClampedArray(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx];
      let q = 0, r = 0;

      if ((angle > -Math.PI / 8 && angle <= Math.PI / 8) || (angle > 7 * Math.PI / 8 || angle <= -7 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + 1], magnitude[idx - 1]);
      } else if ((angle > Math.PI / 8 && angle <= 3 * Math.PI / 8) || (angle > -7 * Math.PI / 8 && angle <= -5 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + width - 1], magnitude[idx - width + 1]);
      } else if ((angle > 3 * Math.PI / 8 && angle <= 5 * Math.PI / 8) || (angle > -5 * Math.PI / 8 && angle <= -3 * Math.PI / 8)) {
        q = Math.max(magnitude[idx + width], magnitude[idx - width]);
      } else {
        q = Math.max(magnitude[idx + width + 1], magnitude[idx - width - 1]);
      }

      suppressed[idx] = magnitude[idx] >= q ? magnitude[idx] : 0;
    }
  }

  const edges = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    if (suppressed[i] > highThresh) edges[i] = 255;
    else if (suppressed[i] > lowThresh) edges[i] = 128;
    else edges[i] = 0;
  }

  for (let i = 0; i < 2; i++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] === 128) {
          if (edges[idx - 1] === 255 || edges[idx + 1] === 255 || edges[idx - width] === 255 ||
            edges[idx + width] === 255 || edges[idx - width - 1] === 255 || edges[idx - width + 1] === 255 ||
            edges[idx + width - 1] === 255 || edges[idx + width + 1] === 255) {
            edges[idx] = 255;
          }
        }
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = edges[i];
  }
}

export function applyRobertsEdge(data, width, height) {
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idx_right = (y * width + (x + 1)) * 4;
      const idx_down = ((y + 1) * width + x) * 4;
      const idx_diag = ((y + 1) * width + (x + 1)) * 4;

      const p1 = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const p2 = 0.299 * data[idx_right] + 0.587 * data[idx_right + 1] + 0.114 * data[idx_right + 2];
      const p3 = 0.299 * data[idx_down] + 0.587 * data[idx_down + 1] + 0.114 * data[idx_down + 2];
      const p4 = 0.299 * data[idx_diag] + 0.587 * data[idx_diag + 1] + 0.114 * data[idx_diag + 2];

      gx[y * width + x] = p1 - p4;
      gy[y * width + x] = p2 - p3;
    }
  }

  for (let i = 0; i < width * height; i++) {
    const mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    const idx = i * 4;
    const magnitude = Math.min(255, mag);
    data[idx] = data[idx + 1] = data[idx + 2] = magnitude;
  }
}

export function applyLaplacian(data, width, height, sharpness) {
  const kernelLaplacian = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const laplacianData = applyConvolution(data, width, height, kernelLaplacian);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] - sharpness * laplacianData[i]));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] - sharpness * laplacianData[i + 1]));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - sharpness * laplacianData[i + 2]));
  }
}
