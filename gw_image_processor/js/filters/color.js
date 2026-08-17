export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, v * 255];
}

export function hsvToRgb(h, s, v) {
  h /= 360; v /= 255;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

export function applyColorAdjustments(data, hueShift, saturationMult, vibrance) {
  for (let i = 0; i < data.length; i += 4) {
    let [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    h = (h + hueShift) % 360;
    if (h < 0) h += 360;

    if (vibrance !== 0) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const amt = (Math.abs(data[i] - avg) + Math.abs(data[i + 1] - avg) + Math.abs(data[i + 2] - avg)) / 3;
      const vMult = (1 - amt / 255) * (vibrance / 100);
      s = Math.min(1, Math.max(0, s + vMult));
    }

    s = Math.min(1, Math.max(0, s * saturationMult));
    const [r, g, b] = hsvToRgb(h, s, v);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

export function applyHSVView(data) {
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    data[i] = (h / 360) * 255;
    data[i + 1] = s * 255;
    data[i + 2] = v;
  }
}

export function applyColorSlicing(data, targetHue, range) {
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    let diff = Math.abs(h - targetHue);
    if (diff > 180) diff = 360 - diff;

    if (diff > range) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  }
}

export function applyWhiteBalance(data, strength = 1.0) {
  let sumR = 0, sumG = 0, sumB = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
  }
  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;
  const avgGray = (avgR + avgG + avgB) / 3;
  const scaleR = 1.0 + (avgGray / Math.max(1, avgR) - 1.0) * strength;
  const scaleG = 1.0 + (avgGray / Math.max(1, avgG) - 1.0) * strength;
  const scaleB = 1.0 + (avgGray / Math.max(1, avgB) - 1.0) * strength;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * scaleR));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scaleG));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scaleB));
  }
}

export function applyWhiteBalanceMax(data, strength = 1.0) {
  let maxR = 0, maxG = 0, maxB = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > maxR) maxR = data[i];
    if (data[i + 1] > maxG) maxG = data[i + 1];
    if (data[i + 2] > maxB) maxB = data[i + 2];
  }
  const maxVal = Math.max(maxR, maxG, maxB);
  if (maxVal === 0) return;
  
  const scaleR = 1.0 + (maxVal / Math.max(1, maxR) - 1.0) * strength;
  const scaleG = 1.0 + (maxVal / Math.max(1, maxG) - 1.0) * strength;
  const scaleB = 1.0 + (maxVal / Math.max(1, maxB) - 1.0) * strength;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * scaleR));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scaleG));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scaleB));
  }
}

export function applyColorQuantization(data, numColors = 8) {
  const totalPixels = data.length / 4;
  const k = Math.min(numColors, 256);
  const sampleSize = Math.min(1000, totalPixels);
  const sampleIndices = [];
  for (let i = 0; i < sampleSize; i++) {
    sampleIndices.push(Math.floor((Math.random() * totalPixels) * 4));
  }
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = sampleIndices[i % sampleSize];
    centroids.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], count: 0 });
  }
  for (let iteration = 0; iteration < 5; iteration++) {
    for (let i = 0; i < k; i++) {
      centroids[i].count = 0;
      centroids[i].r = 0;
      centroids[i].g = 0;
      centroids[i].b = 0;
    }
    for (let i = 0; i < data.length; i += 4) {
      let minDist = Infinity;
      let closestCentroid = 0;
      for (let j = 0; j < k; j++) {
        const dr = data[i] - centroids[j].r;
        const dg = data[i + 1] - centroids[j].g;
        const db = data[i + 2] - centroids[j].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) { minDist = dist; closestCentroid = j; }
      }
      centroids[closestCentroid].r += data[i];
      centroids[closestCentroid].g += data[i + 1];
      centroids[closestCentroid].b += data[i + 2];
      centroids[closestCentroid].count++;
    }
    for (let i = 0; i < k; i++) {
      if (centroids[i].count > 0) {
        centroids[i].r = Math.round(centroids[i].r / centroids[i].count);
        centroids[i].g = Math.round(centroids[i].g / centroids[i].count);
        centroids[i].b = Math.round(centroids[i].b / centroids[i].count);
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    let minDist = Infinity;
    let closestCentroid = 0;
    for (let j = 0; j < k; j++) {
      const dr = data[i] - centroids[j].r;
      const dg = data[i + 1] - centroids[j].g;
      const db = data[i + 2] - centroids[j].b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) { minDist = dist; closestCentroid = j; }
    }
    data[i] = centroids[closestCentroid].r;
    data[i + 1] = centroids[closestCentroid].g;
    data[i + 2] = centroids[closestCentroid].b;
  }
}
