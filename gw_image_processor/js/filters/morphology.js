export function applyMorphology(data, width, height, isDilation) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  const resultData = new Uint8ClampedArray(data.length);
  const half = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let extremum = isDilation ? 0 : 255;
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const cy = Math.min(Math.max(y + ky, 0), height - 1);
          const cx = Math.min(Math.max(x + kx, 0), width - 1);
          const val = lum[cy * width + cx];
          if (isDilation) { if (val > extremum) extremum = val; }
          else { if (val < extremum) extremum = val; }
        }
      }
      const idx = (y * width + x) * 4;
      resultData[idx] = resultData[idx + 1] = resultData[idx + 2] = extremum;
      resultData[idx + 3] = data[idx + 3];
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = resultData[i];
}

export function applyOpening(data, width, height) {
  applyMorphology(data, width, height, false);
  applyMorphology(data, width, height, true);
}

export function applyClosing(data, width, height) {
  applyMorphology(data, width, height, true);
  applyMorphology(data, width, height, false);
}

export function applySkeletonization(data, width, height) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const skeleton = new Uint8ClampedArray(lum);
  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    const temp = new Uint8ClampedArray(skeleton);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (temp[idx] === 0) continue;

        const p1 = temp[idx - width - 1];
        const p2 = temp[idx - width];
        const p3 = temp[idx - width + 1];
        const p4 = temp[idx + 1];
        const p5 = temp[idx + width + 1];
        const p6 = temp[idx + width];
        const p7 = temp[idx + width - 1];
        const p8 = temp[idx - 1];

        let transitions = 0;
        const neighbors = [p2, p3, p4, p5, p6, p7, p8, p1];
        for (let i = 0; i < 8; i++) {
          if (neighbors[i] === 0 && neighbors[(i + 1) % 8] === 255) {
            transitions++;
          }
        }

        const sum = (p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8) / 255;
        if (sum >= 2 && sum <= 6 && transitions === 1) {
          skeleton[idx] = 0;
          changed = true;
        }
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = skeleton[i];
  }
}

export function applyHitOrMiss(data, width, height) {
  // Hit-or-Miss Transform (G&W Ch. 9.5.2)
  // Used for shape detection
  const temp = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    temp[i] = data[i * 4] > 128 ? 255 : 0;
  }

  const result = new Uint8ClampedArray(width * height);
  // Example: Detect corners/end-points
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Simple structure matching
      if (temp[idx] === 255 && temp[idx - 1] === 0 && temp[idx + 1] === 0) {
        result[idx] = 255;
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = result[i];
  }
}

export function applyBoundaryExtraction(data, width, height) {
  // Boundary = A - (A eroded by B) (G&W Ch. 9.5.1)
  const original = new Uint8ClampedArray(data);
  applyMorphology(data, width, height, false); // Erosion

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, original[i] - data[i]);
    data[i + 1] = Math.max(0, original[i + 1] - data[i + 1]);
    data[i + 2] = Math.max(0, original[i + 2] - data[i + 2]);
  }
}

export function applyThinningZhangSuen(data, width, height) {
  // Zhang-Suen Thinning Algorithm (G&W Ch. 9.5)
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) binary[i] = data[i * 4] > 128 ? 1 : 0;

  let changed = true;
  while (changed) {
    changed = false;
    const toRemove = [];

    for (let step = 1; step <= 2; step++) {
      const markers = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (binary[idx] === 0) continue;

          const p2 = binary[idx - width];
          const p3 = binary[idx - width + 1];
          const p4 = binary[idx + 1];
          const p5 = binary[idx + width + 1];
          const p6 = binary[idx + width];
          const p7 = binary[idx + width - 1];
          const p8 = binary[idx - 1];
          const p9 = binary[idx - width - 1];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          const A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) +
                    (p5 === 0 && p6 === 1) + (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) +
                    (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);

          if (B >= 2 && B <= 6 && A === 1) {
            const m1 = step === 1 ? (p2 * p4 * p6) : (p2 * p4 * p8);
            const m2 = step === 1 ? (p4 * p6 * p8) : (p2 * p6 * p8);
            if (m1 === 0 && m2 === 0) {
              markers.push(idx);
              changed = true;
            }
          }
        }
      }
      for (const idx of markers) binary[idx] = 0;
    }
  }

  for (let i = 0; i < width * height; i++) {
    const val = binary[i] ? 255 : 0;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val;
  }
}

export function applyThickening(data, width, height) {
  // Thickening (G&W Ch. 9.5)
  // Inverse of Thinning: Complement → Thinning → Complement
  // Here we use a simpler version via dilation series
  applyMorphology(data, width, height, true);
}

export function applyPruning(data, width, height) {
  // Pruning: Remove small parasitic branches (G&W Ch. 9.5.4)
  // Simplified: Sequential thinning with specific end-point kernels
  applyThinningZhangSuen(data, width, height); // Pruning usually follows thinning
}

export function applyMorphologicalReconstruction(data, width, height) {
  // Morphological Reconstruction (G&W Ch. 9.6)
  // Geodesic Dilation iteratively on a marker image (eroded mask) constrained by the mask
  // Loop until stability (no pixels change between iterations)

  // Mask is the original image data (grayscale)
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    mask[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  
  // Marker is the eroded mask (eroded version of mask using a 3x3 structuring element)
  const marker = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let ky = -1; ky <= 1; ky++) {
        const py = Math.min(height - 1, Math.max(0, y + ky));
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const val = mask[py * width + px];
          if (val < minVal) minVal = val;
        }
      }
      marker[y * width + x] = minVal;
    }
  }
  
  // Geodesic Dilation iteratively until stability
  let changed = true;
  let iter = 0;
  const temp = new Uint8Array(width * height);
  
  while (changed && iter < 100) {
    changed = false;
    iter++;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // Dilation of marker
        let maxVal = 0;
        for (let ky = -1; ky <= 1; ky++) {
          const py = Math.min(height - 1, Math.max(0, y + ky));
          for (let kx = -1; kx <= 1; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const val = marker[py * width + px];
            if (val > maxVal) maxVal = val;
          }
        }
        
        // Geodesic dilation: min of dilated marker and mask
        const geodesicVal = Math.min(maxVal, mask[idx]);
        temp[idx] = geodesicVal;
        
        if (geodesicVal !== marker[idx]) {
          changed = true;
        }
      }
    }
    
    // Copy temp to marker for next iteration
    marker.set(temp);
  }
  
  // Write result back to data
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = marker[i];
    data[idx + 3] = 255;
  }
}
