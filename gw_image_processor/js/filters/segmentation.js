export function applyOtsuThreshold(data, width, height) {
  const histogram = new Uint32Array(256);
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[lum]++;
  }

  const probabilities = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    probabilities[i] = histogram[i] / totalPixels;
  }

  let totalMean = 0;
  for (let i = 0; i < 256; i++) {
    totalMean += i * probabilities[i];
  }

  let maxVariance = 0;
  let optimalThreshold = 0;
  let w0 = 0;
  let mu0 = 0;

  for (let t = 0; t < 256; t++) {
    w0 += probabilities[t];
    if (w0 === 0) continue;

    mu0 = (mu0 * (w0 - probabilities[t]) + t * probabilities[t]) / w0;

    const w1 = 1 - w0;
    if (w1 === 0) break;

    const mu1 = (totalMean - w0 * mu0) / w1;
    const variance = w0 * w1 * Math.pow(mu0 - mu1, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      optimalThreshold = t;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = lum >= optimalThreshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
}

export function applyOtsuColor(data, width, height) {
  const thresholdChannel = (channelOffset) => {
    const histogram = new Uint32Array(256);
    const totalPixels = width * height;
    
    for (let i = channelOffset; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    const probabilities = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      probabilities[i] = histogram[i] / totalPixels;
    }

    let totalMean = 0;
    for (let i = 0; i < 256; i++) {
      totalMean += i * probabilities[i];
    }

    let maxVariance = 0;
    let optimalThreshold = 0;
    let w0 = 0;
    let mu0 = 0;

    for (let t = 0; t < 256; t++) {
      w0 += probabilities[t];
      if (w0 === 0) continue;

      mu0 = (mu0 * (w0 - probabilities[t]) + t * probabilities[t]) / w0;

      const w1 = 1 - w0;
      if (w1 === 0) break;

      const mu1 = (totalMean - w0 * mu0) / w1;
      const variance = w0 * w1 * Math.pow(mu0 - mu1, 2);

      if (variance > maxVariance) {
        maxVariance = variance;
        optimalThreshold = t;
      }
    }
    return optimalThreshold;
  };

  const tR = thresholdChannel(0);
  const tG = thresholdChannel(1);
  const tB = thresholdChannel(2);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] >= tR ? 255 : 0;
    data[i + 1] = data[i + 1] >= tG ? 255 : 0;
    data[i + 2] = data[i + 2] >= tB ? 255 : 0;
  }
}

export function applyRegionGrowing(data, width, height, similarityThreshold = 30) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // 1. Noise Reduction: Simple Box Blur on luminance to avoid thousands of noise seeds
  const smoothed = new Uint8ClampedArray(width * height);
  const r = 2; // radius for 5x5 smoothing
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              sum += lum[ny * width + nx];
              count++;
            }
          }
        }
      }
      smoothed[y * width + x] = Math.round(sum / count);
    }
  }

  // 2. Select seeds spaced out (local minima in a larger 9x9 window)
  const seeds = [];
  const kRadius = 4; // 9x9 window
  for (let y = kRadius; y < height - kRadius; y += 4) {
    for (let x = kRadius; x < width - kRadius; x += 4) {
      const idx = y * width + x;
      const val = smoothed[idx];

      let isLocalMin = true;
      for (let dy = -kRadius; dy <= kRadius; dy++) {
        for (let dx = -kRadius; dx <= kRadius; dx++) {
          if (smoothed[(y + dy) * width + (x + dx)] < val) {
            isLocalMin = false;
            break;
          }
        }
        if (!isLocalMin) break;
      }

      if (isLocalMin) {
        seeds.push({ x, y, val: lum[idx] });
      }
    }
  }

  const regions = new Int32Array(width * height);
  regions.fill(-1);
  let regionCount = 0;

  // 3. Region Growing BFS from seeds
  for (const seed of seeds) {
    if (regions[seed.y * width + seed.x] !== -1) continue;

    const queue = [{ x: seed.x, y: seed.y }];
    regions[seed.y * width + seed.x] = regionCount;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const centerVal = lum[y * width + x];

      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (regions[ny * width + nx] !== -1) continue;

        const neighborVal = lum[ny * width + nx];
        if (Math.abs(neighborVal - centerVal) <= similarityThreshold) {
          regions[ny * width + nx] = regionCount;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    regionCount++;
  }

  // 4. Color the regions with distinct vibrant colors
  const colorMap = [];
  for (let i = 0; i < Math.max(regionCount, 1); i++) {
    colorMap.push({
      r: Math.floor(Math.random() * 200 + 30),
      g: Math.floor(Math.random() * 200 + 30),
      b: Math.floor(Math.random() * 200 + 30)
    });
  }

  for (let i = 0; i < width * height; i++) {
    const region = regions[i];
    const idx = i * 4;
    if (region === -1) {
      // Unassigned pixels: assign base dark gray/black
      data[idx] = 15;
      data[idx + 1] = 15;
      data[idx + 2] = 15;
    } else {
      const color = colorMap[region % colorMap.length];
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
    }
  }
}

export function applyKMeansSegmentation(data, width, height, k = 4) {
  const numPixels = width * height;
  const pixels = new Uint8ClampedArray(numPixels * 3);
  
  for (let i = 0; i < numPixels; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    pixels[dstIdx] = data[srcIdx];
    pixels[dstIdx + 1] = data[srcIdx + 1];
    pixels[dstIdx + 2] = data[srcIdx + 2];
  }

  // Centroid initialization: grid sample to cover different image parts
  const centroids = new Float32Array(k * 3);
  const step = Math.floor(numPixels / k);
  for (let i = 0; i < k; i++) {
    const srcIdx = Math.min(i * step + Math.floor(step / 2), numPixels - 1) * 3;
    centroids[i * 3] = pixels[srcIdx];
    centroids[i * 3 + 1] = pixels[srcIdx + 1];
    centroids[i * 3 + 2] = pixels[srcIdx + 2];
  }

  const assignments = new Int32Array(numPixels);
  let changed = true;
  let maxIterations = 10;

  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    // Assignment step
    for (let i = 0; i < numPixels; i++) {
      const pxR = pixels[i * 3];
      const pxG = pixels[i * 3 + 1];
      const pxB = pixels[i * 3 + 2];

      let minDist = Infinity;
      let closestCluster = 0;

      for (let j = 0; j < k; j++) {
        const dr = pxR - centroids[j * 3];
        const dg = pxG - centroids[j * 3 + 1];
        const db = pxB - centroids[j * 3 + 2];
        const dist = dr * dr + dg * dg + db * db;
        
        if (dist < minDist) {
          minDist = dist;
          closestCluster = j;
        }
      }

      if (assignments[i] !== closestCluster) {
        assignments[i] = closestCluster;
        changed = true;
      }
    }

    // Update step
    const centroidSums = new Float32Array(k * 3);
    const clusterCounts = new Int32Array(k);

    for (let i = 0; i < numPixels; i++) {
      const cluster = assignments[i];
      const pxR = pixels[i * 3];
      const pxG = pixels[i * 3 + 1];
      const pxB = pixels[i * 3 + 2];

      centroidSums[cluster * 3] += pxR;
      centroidSums[cluster * 3 + 1] += pxG;
      centroidSums[cluster * 3 + 2] += pxB;
      clusterCounts[cluster]++;
    }

    for (let j = 0; j < k; j++) {
      if (clusterCounts[j] > 0) {
        centroids[j * 3] = centroidSums[j * 3] / clusterCounts[j];
        centroids[j * 3 + 1] = centroidSums[j * 3 + 1] / clusterCounts[j];
        centroids[j * 3 + 2] = centroidSums[j * 3 + 2] / clusterCounts[j];
      }
    }
  }

  // Generate distinct visualization colors for each cluster
  const colorMap = [];
  for (let j = 0; j < k; j++) {
    colorMap.push({
      r: Math.floor(Math.random() * 200 + 40),
      g: Math.floor(Math.random() * 200 + 40),
      b: Math.floor(Math.random() * 200 + 40)
    });
  }

  for (let i = 0; i < numPixels; i++) {
    const cluster = assignments[i];
    const color = colorMap[cluster];
    const idx = i * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
  }
}

export function applyWatershedSegmentation(data, width, height, markerCount = 5) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // 1. Smooth luminance to avoid severe over-segmentation due to micro-noise
  const smoothed = new Uint8ClampedArray(width * height);
  const r = 2; // radius for 5x5 Box Blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              sum += lum[ny * width + nx];
              count++;
            }
          }
        }
      }
      smoothed[y * width + x] = Math.round(sum / count);
    }
  }

  // 2. Select distinct seeds as local minima
  const markers = [];
  const minDistance = Math.max(width, height) / (markerCount + 1);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      let isLocalMin = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (smoothed[(y + dy) * width + (x + dx)] < smoothed[idx]) {
            isLocalMin = false;
            break;
          }
        }
        if (!isLocalMin) break;
      }

      if (isLocalMin) {
        let tooClose = false;
        for (const marker of markers) {
          const dist = Math.sqrt((marker.x - x) ** 2 + (marker.y - y) ** 2);
          if (dist < minDistance) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose && markers.length < markerCount) {
          markers.push({ x, y, val: smoothed[idx] });
        }
      }
    }
  }

  // Fallback: If no markers found, seed grid-based markers
  if (markers.length === 0) {
    const step = Math.floor(Math.min(width, height) / (markerCount + 1));
    for (let i = 1; i <= markerCount; i++) {
      markers.push({ x: i * step, y: i * step, val: smoothed[(i * step) * width + (i * step)] });
    }
  }

  const watershed = new Int32Array(width * height);
  watershed.fill(-1);

  // 3. Populate markers in watershed map
  for (let m = 0; m < markers.length; m++) {
    watershed[markers[m].y * width + markers[m].x] = m;
  }

  // 4. Sort all pixel coordinates by their intensity value
  const pixels = [];
  for (let i = 0; i < width * height; i++) {
    pixels.push({ idx: i, val: smoothed[i] });
  }
  pixels.sort((a, b) => a.val - b.val);

  // 5. Flood fill assignment (Watershed simulation)
  for (const { idx } of pixels) {
    if (watershed[idx] !== -1) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbors = [];
    
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (watershed[nidx] !== -1) {
          neighbors.push(watershed[nidx]);
        }
      }
    }
    
    if (neighbors.length > 0) {
      watershed[idx] = neighbors[0]; // Assign to the first neighbor region
    }
  }

  // 6. Draw with random beautiful colors
  const colorMap = [];
  for (let i = 0; i <= markers.length; i++) {
    colorMap.push({
      r: Math.floor(Math.random() * 200 + 30),
      g: Math.floor(Math.random() * 200 + 30),
      b: Math.floor(Math.random() * 200 + 30)
    });
  }

  for (let i = 0; i < width * height; i++) {
    const region = Math.max(0, watershed[i]);
    const color = colorMap[region % colorMap.length];
    const idx = i * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
  }
}
