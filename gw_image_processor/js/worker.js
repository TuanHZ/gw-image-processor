import * as Intensity from './filters/intensity.js';
import * as Edge from './filters/edge.js';
import * as Morphology from './filters/morphology.js';
import * as Segmentation from './filters/segmentation.js';
import * as Color from './filters/color.js';
import * as Enhancement from './filters/enhancement.js';
import * as FFT from './core/fft.js';
import * as Frequency from './filters/frequency.js';
import * as Restoration from './filters/restoration.js';
import * as FrequencyRestoration from './filters/frequency_restoration.js';
import * as Scaling from './filters/scaling.js';

let cachedComplex = null;
let cachedWidth = 0;
let cachedHeight = 0;

self.onmessage = function(e) {
  const { imageData, state, width, height, isNewImage, isPreview, requestId } = e.data;
  const data = imageData.data;

  // Clone original data before applying filters
  const originalData = new Uint8ClampedArray(data);

  // Cache Management for FFT
  if (isNewImage) {
    cachedComplex = null;
  }

  // For scaling filters that produce a new ImageData of different size
  let scaledResult = null;

  switch (state.activeFilter) {
    case 'fftView':
      handleFFTView(imageData, width, height);
      break;
    case 'freqLowpass':
    case 'freqHighpass':
      handleFrequencyFilter(imageData, width, height, state);
      break;
    // ... existing filters ...
    case 'grayscale': Intensity.applyGrayscale(data); break;
    case 'negative': Intensity.applyNegative(data); break;
    case 'log': Intensity.applyLog(data); break;
    case 'gamma': Intensity.applyGamma(data, state.gamma); break;
    case 'histEq': Intensity.applyHistogram(data, width * height); break;
    case 'median': Enhancement.applyMedian(data, width, height); break;
    case 'unsharpMask': Enhancement.applyUnsharpMask(data, width, height, state.unsharpAmount, state.unsharpRadius); break; // Deprecated
    case 'denoiseSharpen': Enhancement.applyDenoiseSharpen(data, width, height, state.sharpnessStrength); break;
    case 'adaptiveThresh': Intensity.applyAdaptiveThreshold(data, width, height, state.thresholdBlockSize); break;
    case 'sobel': Edge.applySobel(data, width, height); break;
    case 'prewittEdge': Edge.applyPrewittEdge(data, width, height); break;
    case 'cannyEdge': Edge.applyCannyEdgeDetection(data, width, height, state.cannyLowThresh, state.cannyHighThresh); break;
    case 'robertsEdge': Edge.applyRobertsEdge(data, width, height); break;
    case 'laplacian': Edge.applyLaplacian(data, width, height, state.sharpness); break; // Deprecated
    case 'erosion': Morphology.applyMorphology(data, width, height, false); break;
    case 'dilation': Morphology.applyMorphology(data, width, height, true); break;
    case 'opening': Morphology.applyOpening(data, width, height); break;
    case 'closing': Morphology.applyClosing(data, width, height); break;
    case 'skeletonization': Morphology.applySkeletonization(data, width, height); break;
    case 'hitOrMiss': Morphology.applyHitOrMiss(data, width, height); break;
    case 'boundaryExtraction': Morphology.applyBoundaryExtraction(data, width, height); break;
    case 'thinning': Morphology.applyThinningZhangSuen(data, width, height); break;
    case 'thickening': Morphology.applyThickening(data, width, height); break;
    case 'pruning': Morphology.applyPruning(data, width, height); break;
    case 'morphRecon': Morphology.applyMorphologicalReconstruction(data, width, height); break;
    case 'otsuThresh':
    case 'otsuThreshold': Segmentation.applyOtsuThreshold(data, width, height); break;
    case 'otsuColor': Segmentation.applyOtsuColor(data, width, height); break;
    case 'regionGrow':
    case 'regionGrowing': Segmentation.applyRegionGrowing(data, width, height, state.regionSimilarity); break;
    case 'kmeansSeg': Segmentation.applyKMeansSegmentation(data, width, height, state.kmeansK); break;
    case 'watershed': Segmentation.applyWatershedSegmentation(data, width, height, state.watershedMarkers); break;
    case 'colorAdjust': Color.applyColorAdjustments(data, state.hue, state.saturation, state.vibrance); break;
    case 'hsvView': Color.applyHSVView(data); break;
    case 'colorSlicing': Color.applyColorSlicing(data, state.colorSlicingHue, state.colorSlicingRange); break;
    case 'whiteBalance': Color.applyWhiteBalance(data, state.wbStrength); break;
    case 'whiteBalanceMax': Color.applyWhiteBalanceMax(data, state.wbStrength); break;
    case 'colorQuantization': Color.applyColorQuantization(data, state.quantizationColors); break;
    case 'clahe': Intensity.applyCLAHE(data, width, height, state.claheClipLimit, state.claheTileSize); break;
    case 'bilateral': Enhancement.applyBilateralFilter(data, width, height, state.bilateralSigmaColor, state.bilateralSigmaSpace); break;
    case 'retinex': Enhancement.applyRetinex(data, width, height, state.retinexScales); break;
    
    // Phase 8: Restoration
    case 'arithmeticMean': Restoration.applyArithmeticMean(data, width, height, state.meanSize); break;
    case 'geometricMean': Restoration.applyGeometricMean(data, width, height, state.meanSize); break;
    case 'contraHarmonic': Restoration.applyContraHarmonicMean(data, width, height, state.meanSize, state.contraQ); break;
    case 'adaptiveMedian': Restoration.applyAdaptiveMedian(data, width, height, state.adaptiveMedianMax); break;
    case 'wienerFilter': handleWienerRestoration(imageData, width, height, state); break;
    case 'inverseFilter': handleInverseRestoration(imageData, width, height, state); break;
    
    // Phase 10: Advanced G&W Algorithms
    case 'houghLines': applyHoughLines(data, width, height, state.houghLinesCount); break;
    case 'homomorphic': handleHomomorphicFilter(imageData, width, height, state); break;
    case 'distanceTransform': applyDistanceTransform(data, width, height); break;
    
    // Resampling & Scaling — produce new-sized ImageData
    case 'scale2x': scaledResult = Scaling.applyScale2x(data, width, height); break;
    case 'hq2x': scaledResult = Scaling.applyHQ2xSimplified(data, width, height); break;
    case 'nn2x': scaledResult = Scaling.applyNearestNeighbor2x(data, width, height); break;
    case 'scale4x': scaledResult = Scaling.applyScale4x(data, width, height); break;
    case 'hq4x': scaledResult = Scaling.applyHQ4x(data, width, height); break;

    default: break;
  }

  // Handle scaled results (different output dimensions)
  if (scaledResult) {
    const newImgData = new ImageData(scaledResult.data, scaledResult.width, scaledResult.height);
    const histogram = calculateHistogram(newImgData.data);
    const metrics = calculateMetrics(originalData, newImgData.data, width, height, newImgData.width, newImgData.height);
    self.postMessage({ imageData: newImgData, histogram, metrics }, [newImgData.data.buffer]);
    return;
  }

  // Calculate histogram for all other filters
  const histogram = calculateHistogram(imageData.data);
  const metrics = isPreview ? null : calculateMetrics(originalData, imageData.data, width, height, width, height);
  self.postMessage({ imageData, histogram, metrics, isPreview, requestId }, [imageData.data.buffer]);
};

function prepareFFT(imageData, width, height) {
  const paddedW = FFT.nextPowerOfTwo(width);
  const paddedH = FFT.nextPowerOfTwo(height);
  
  if (cachedComplex && cachedWidth === paddedW && cachedHeight === paddedH) {
    return { paddedW, paddedH };
  }

  const complex = new FFT.ComplexArray(paddedW * paddedH);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
      complex.real[y * paddedW + x] = gray;
    }
  }

  FFT.shiftFFT(complex, paddedW, paddedH);
  FFT.fft2d(complex, paddedW, paddedH);
  
  cachedComplex = complex;
  cachedWidth = paddedW;
  cachedHeight = paddedH;
  
  return { paddedW, paddedH };
}

function handleFFTView(imageData, width, height) {
  const { paddedW, paddedH } = prepareFFT(imageData, width, height);
  const spectrum = FFT.getMagnitudeSpectrum(cachedComplex, paddedW, paddedH);
  
  // Crop spectrum back to original size
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * paddedW + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = spectrum[srcIdx];
      imageData.data[dstIdx + 1] = spectrum[srcIdx + 1];
      imageData.data[dstIdx + 2] = spectrum[srcIdx + 2];
      imageData.data[dstIdx + 3] = 255;
    }
  }
}

function handleFrequencyFilter(imageData, width, height, state) {
  const { paddedW, paddedH } = prepareFFT(imageData, width, height);
  
  // Copy cached complex to avoid modifying the original spectrum
  const complex = new FFT.ComplexArray(paddedW * paddedH);
  complex.real.set(cachedComplex.real);
  complex.imag.set(cachedComplex.imag);

  const isHighpass = state.activeFilter === 'freqHighpass';
  const cutoff = state.freqCutoff;
  const type = state.freqFilterType; // 'ideal', 'butterworth', 'gaussian'

  if (type === 'ideal') {
    Frequency.applyIdealFilter(complex, paddedW, paddedH, cutoff, isHighpass);
  } else if (type === 'butterworth') {
    Frequency.applyButterworthFilter(complex, paddedW, paddedH, cutoff, state.freqOrder, isHighpass);
  } else {
    Frequency.applyGaussianFilter(complex, paddedW, paddedH, cutoff, isHighpass);
  }

  FFT.ifft2d(complex, paddedW, paddedH);
  FFT.shiftFFT(complex, paddedW, paddedH);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * paddedW + x;
      const dstIdx = (y * width + x) * 4;
      const val = Math.min(255, Math.max(0, complex.real[srcIdx]));
      imageData.data[dstIdx] = imageData.data[dstIdx + 1] = imageData.data[dstIdx + 2] = val;
      imageData.data[dstIdx + 3] = 255;
    }
  }
}

function handleWienerRestoration(imageData, width, height, state) {
  const { paddedW, paddedH } = prepareFFT(imageData, width, height);
  const complex = new FFT.ComplexArray(paddedW * paddedH);
  complex.real.set(cachedComplex.real);
  complex.imag.set(cachedComplex.imag);

  FrequencyRestoration.applyWienerFilter(complex, paddedW, paddedH, state.wienerK, state.motionAngle, state.motionLen);

  FFT.ifft2d(complex, paddedW, paddedH);
  FFT.shiftFFT(complex, paddedW, paddedH);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * paddedW + x;
      const dstIdx = (y * width + x) * 4;
      const val = Math.min(255, Math.max(0, complex.real[srcIdx]));
      imageData.data[dstIdx] = imageData.data[dstIdx + 1] = imageData.data[dstIdx + 2] = val;
      imageData.data[dstIdx + 3] = 255;
    }
  }
}

function handleInverseRestoration(imageData, width, height, state) {
  const { paddedW, paddedH } = prepareFFT(imageData, width, height);
  const complex = new FFT.ComplexArray(paddedW * paddedH);
  complex.real.set(cachedComplex.real);
  complex.imag.set(cachedComplex.imag);

  FrequencyRestoration.applyInverseFilter(complex, paddedW, paddedH, state.motionAngle, state.motionLen, 0.1);

  FFT.ifft2d(complex, paddedW, paddedH);
  FFT.shiftFFT(complex, paddedW, paddedH);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * paddedW + x;
      const dstIdx = (y * width + x) * 4;
      const val = Math.min(255, Math.max(0, complex.real[srcIdx]));
      imageData.data[dstIdx] = imageData.data[dstIdx + 1] = imageData.data[dstIdx + 2] = val;
      imageData.data[dstIdx + 3] = 255;
    }
  }
}

// ============================================================
// HISTOGRAM CALCULATION (runs in Worker thread)
// ============================================================
function calculateHistogram(data) {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
  }

  return { r, g, b };
}

// ============================================================
// PHASE 9: METRICS CALCULATION (runs in Worker thread)
// ============================================================
function calculateMetrics(originalData, processedData, width, height, processedWidth, processedHeight) {
  const numPixelsOriginal = width * height;
  const numPixelsProcessed = processedWidth * processedHeight;
  
  // Calculate Entropy and Stats for Original
  const entropyOriginal = calculateEntropy(originalData, numPixelsOriginal);
  const statsOriginal = calculateStats(originalData, numPixelsOriginal);
  
  // Calculate Entropy and Stats for Processed
  const entropyProcessed = calculateEntropy(processedData, numPixelsProcessed);
  const statsProcessed = calculateStats(processedData, numPixelsProcessed);
  
  const dimensionsMatch = (width === processedWidth && height === processedHeight);
  
  let mse = null;
  let psnr = null;
  let ssim = null;
  
  if (dimensionsMatch) {
    // MSE
    let sumSqDiff = 0;
    for (let i = 0; i < originalData.length; i += 4) {
      const dr = originalData[i] - processedData[i];
      const dg = originalData[i + 1] - processedData[i + 1];
      const db = originalData[i + 2] - processedData[i + 2];
      sumSqDiff += dr * dr + dg * dg + db * db;
    }
    mse = sumSqDiff / (3 * numPixelsOriginal);
    
    // PSNR
    psnr = (mse === 0) ? Infinity : 10 * Math.log10((255 * 255) / mse);
    
    // SSIM (block-based 8x8 luminance)
    ssim = calculateSSIM(originalData, processedData, width, height);
  }
  
  return {
    mse,
    psnr,
    ssim,
    entropyOriginal,
    entropyProcessed,
    statsOriginal,
    statsProcessed
  };
}

function calculateEntropy(data, totalPixels) {
  const grayHist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayHist[gray]++;
  }
  
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (grayHist[i] > 0) {
      const p = grayHist[i] / totalPixels;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function calculateStats(data, totalPixels) {
  let min = 255;
  let max = 0;
  let sum = 0;
  let sumSq = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const val = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
    sumSq += val * val;
  }
  
  const mean = sum / totalPixels;
  const variance = Math.max(0, (sumSq / totalPixels) - (mean * mean));
  const stdDev = Math.sqrt(variance);
  
  return { min, max, mean, stdDev };
}

function calculateSSIM(original, processed, width, height) {
  const c1 = 6.5025;
  const c2 = 58.5225;
  const blockSize = 8;
  const numBlocksX = Math.floor(width / blockSize);
  const numBlocksY = Math.floor(height / blockSize);
  
  if (numBlocksX === 0 || numBlocksY === 0) return 1.0;
  
  let ssimSum = 0;
  let blockCount = 0;
  
  for (let by = 0; by < numBlocksY; by++) {
    for (let bx = 0; bx < numBlocksX; bx++) {
      const startX = bx * blockSize;
      const startY = by * blockSize;
      
      let sumX = 0;
      let sumY = 0;
      let sumSqX = 0;
      let sumSqY = 0;
      let sumXY = 0;
      
      for (let y = 0; y < blockSize; y++) {
        const rowOffset = (startY + y) * width;
        for (let x = 0; x < blockSize; x++) {
          const pixelIdx = (rowOffset + (startX + x)) * 4;
          
          const valX = 0.299 * original[pixelIdx] + 0.587 * original[pixelIdx + 1] + 0.114 * original[pixelIdx + 2];
          const valY = 0.299 * processed[pixelIdx] + 0.587 * processed[pixelIdx + 1] + 0.114 * processed[pixelIdx + 2];
          
          sumX += valX;
          sumY += valY;
          sumSqX += valX * valX;
          sumSqY += valY * valY;
          sumXY += valX * valY;
        }
      }
      
      const N = blockSize * blockSize;
      const muX = sumX / N;
      const muY = sumY / N;
      
      const varX = (sumSqX / N) - (muX * muX);
      const varY = (sumSqY / N) - (muY * muY);
      const covXY = (sumXY / N) - (muX * muY);
      
      const numerator = (2 * muX * muY + c1) * (2 * covXY + c2);
      const denominator = (muX * muX + muY * muY + c1) * (varX + varY + c2);
      
      ssimSum += numerator / (denominator || 1e-10);
      blockCount++;
    }
  }
  
  return ssimSum / blockCount;
}

// ============================================================
// PHASE 10: ADVANCED GONZALEZ & WOODS ALGORITHMS
// ============================================================

function applySobelEdges(data, width, height) {
  const edges = new Uint8Array(width * height);
  const half = 1;
  const Kx = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ];
  const Ky = [
    -1, -2, -1,
     0,  0,  0,
     1,  2,  1
  ];
  
  // Compute luminance
  const lum = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      for (let ky = -half; ky <= half; ky++) {
        const row = (y + ky) * width;
        for (let kx = -half; kx <= half; kx++) {
          const val = lum[row + (x + kx)];
          const kidx = (ky + 1) * 3 + (kx + 1);
          gx += val * Kx[kidx];
          gy += val * Ky[kidx];
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = mag > 120 ? 255 : 0; // Threshold edges
    }
  }
  return edges;
}

function applyHoughLines(data, width, height, linesCount = 15) {
  // 1. Convert to Grayscale + Sobel Edges
  const edges = applySobelEdges(data, width, height);
  
  // 2. Hough parameters
  const numAngles = 180;
  const maxDistance = Math.round(Math.sqrt(width * width + height * height));
  const numDistances = maxDistance * 2;
  
  // Precompute cos and sin tables for angles [-90, 89] degrees
  const cosTable = new Float32Array(numAngles);
  const sinTable = new Float32Array(numAngles);
  for (let a = 0; a < numAngles; a++) {
    const rad = ((a - 90) * Math.PI) / 180;
    cosTable[a] = Math.cos(rad);
    sinTable[a] = Math.sin(rad);
  }
  
  // 3. Accumulator array (180 x numDistances)
  const accumulator = new Uint32Array(numAngles * numDistances);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (edges[rowOffset + x] === 0) continue; // Skip non-edge pixels
      
      for (let a = 0; a < numAngles; a++) {
        // rho = x * cos(theta) + y * sin(theta)
        const rho = x * cosTable[a] + y * sinTable[a];
        const rhoIdx = Math.round(rho) + maxDistance;
        if (rhoIdx >= 0 && rhoIdx < numDistances) {
          accumulator[a * numDistances + rhoIdx]++;
        }
      }
    }
  }
  
  // 4. Find peaks in accumulator
  const peaks = [];
  const minThreshold = 30; // Min votes
  
  // Non-maximum suppression window (e.g. 9x9 in accumulator space)
  const suppressW = 4; // delta theta
  const suppressH = 15; // delta rho
  
  // Find local maxima
  for (let a = 0; a < numAngles; a++) {
    for (let r = 0; r < numDistances; r++) {
      const votes = accumulator[a * numDistances + r];
      if (votes < minThreshold) continue;
      
      let isLocalMax = true;
      for (let da = -suppressW; da <= suppressW; da++) {
        const na = (a + da + numAngles) % numAngles;
        for (let dr = -suppressH; dr <= suppressH; dr++) {
          const nr = r + dr;
          if (nr >= 0 && nr < numDistances) {
            if (accumulator[na * numDistances + nr] > votes) {
              isLocalMax = false;
              break;
            }
          }
        }
        if (!isLocalMax) break;
      }
      
      if (isLocalMax) {
        peaks.push({ thetaIdx: a, rhoIdx: r, votes });
      }
    }
  }
  
  // Sort peaks by votes descending
  peaks.sort((a, b) => b.votes - a.votes);
  
  // Select top N lines
  const selectedPeaks = peaks.slice(0, linesCount);
  
  // 5. Convert processed canvas to grayscale first so the lines stand out gorgeous
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    data[idx] = data[idx + 1] = data[idx + 2] = gray;
  }
  
  // 6. Draw lines
  // Let's use neon cyan and orange-red alternating lines
  selectedPeaks.forEach((peak, index) => {
    const a = peak.thetaIdx;
    const r = peak.rhoIdx - maxDistance;
    const cosVal = cosTable[a];
    const sinVal = sinTable[a];
    
    // Choose neon color (cyan vs orange-red)
    const rColor = index % 2 === 0 ? 0 : 255;
    const gColor = index % 2 === 0 ? 229 : 50;
    const bColor = index % 2 === 0 ? 255 : 0;
    
    // Line equation: x * cos + y * sin = r
    if (Math.abs(sinVal) > Math.abs(cosVal)) {
      for (let x = 0; x < width; x++) {
        const y = Math.round((r - x * cosVal) / sinVal);
        if (y >= 0 && y < height) {
          drawPixelThick(data, x, y, width, height, rColor, gColor, bColor);
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        const x = Math.round((r - y * sinVal) / cosVal);
        if (x >= 0 && x < width) {
          drawPixelThick(data, x, y, width, height, rColor, gColor, bColor);
        }
      }
    }
  });
}

function drawPixelThick(data, x, y, width, height, r, g, b) {
  // Draw pixel + 3x3 surrounding pixels slightly blended to make line thicker and anti-aliased
  for (let dy = -1; dy <= 1; dy++) {
    const py = y + dy;
    if (py < 0 || py >= height) continue;
    const rowOffset = py * width;
    for (let dx = -1; dx <= 1; dx++) {
      const px = x + dx;
      if (px < 0 || px >= width) continue;
      
      const idx = (rowOffset + px) * 4;
      const weight = (dy === 0 && dx === 0) ? 1.0 : 0.45;
      
      data[idx]     = Math.round(data[idx] * (1 - weight) + r * weight);
      data[idx + 1] = Math.round(data[idx + 1] * (1 - weight) + g * weight);
      data[idx + 2] = Math.round(data[idx + 2] * (1 - weight) + b * weight);
    }
  }
}

function applyHomomorphicFilter(complex, width, height, cutoff, gammaH, gammaL) {
  const cx = width / 2;
  const cy = height / 2;
  const c = 1.0; // Sharpness parameter
  const d0_2 = cutoff * cutoff;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      
      // H(u,v) = (gammaH - gammaL) * (1 - exp(-c * D^2 / D0^2)) + gammaL
      const h = (gammaH - gammaL) * (1 - Math.exp(-c * d2 / (d0_2 || 1e-10))) + gammaL;
      
      const idx = y * width + x;
      complex.real[idx] *= h;
      complex.imag[idx] *= h;
    }
  }
}

function handleHomomorphicFilter(imageData, width, height, state) {
  const paddedW = FFT.nextPowerOfTwo(width);
  const paddedH = FFT.nextPowerOfTwo(height);
  
  const complex = new FFT.ComplexArray(paddedW * paddedH);
  
  // 1. Natural Logarithm: ln(1 + gray)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
      complex.real[y * paddedW + x] = Math.log(1.0 + gray);
    }
  }
  
  // 2. FFT
  FFT.shiftFFT(complex, paddedW, paddedH);
  FFT.fft2d(complex, paddedW, paddedH);
  
  // 3. Filter
  applyHomomorphicFilter(complex, paddedW, paddedH, state.homomorphicCutoff, state.homomorphicHigh, state.homomorphicLow);
  
  // 4. IFFT
  FFT.ifft2d(complex, paddedW, paddedH);
  FFT.shiftFFT(complex, paddedW, paddedH);
  
  // 5. Exponential: exp(real) - 1
  let minVal = Infinity;
  let maxVal = -Infinity;
  const values = new Float32Array(height * width);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * paddedW + x;
      const val = Math.exp(complex.real[srcIdx]) - 1.0;
      values[y * width + x] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }
  
  // Normalize back to [0, 255] range
  const range = maxVal - minVal;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const dstIdx = idx * 4;
      const normalized = range === 0 ? 128 : Math.min(255, Math.max(0, ((values[idx] - minVal) / range) * 255));
      imageData.data[dstIdx] = imageData.data[dstIdx + 1] = imageData.data[dstIdx + 2] = Math.round(normalized);
      imageData.data[dstIdx + 3] = 255;
    }
  }
}

function applyDistanceTransform(data, width, height) {
  // 1. Binarize image (using threshold at 127 of luminance)
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    binary[i] = gray > 127 ? 1 : 0;
  }
  
  // 2. Chamfer 3-4 (Approximated Euclidean) Distance Transform - 2 Pass
  const dist = new Float32Array(width * height);
  const INF = 1e9;
  
  // Initialize
  for (let i = 0; i < width * height; i++) {
    dist[i] = binary[i] === 0 ? 0 : INF;
  }
  
  // Forward Pass (top-left to bottom-right)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (binary[idx] === 0) continue;
      
      let d = dist[idx];
      // Neighbor Left
      if (x > 0) d = Math.min(d, dist[idx - 1] + 1);
      // Neighbor Top
      if (y > 0) d = Math.min(d, dist[idx - width] + 1);
      // Neighbor Top-Left
      if (x > 0 && y > 0) d = Math.min(d, dist[idx - width - 1] + 1.4);
      // Neighbor Top-Right
      if (x < width - 1 && y > 0) d = Math.min(d, dist[idx - width + 1] + 1.4);
      
      dist[idx] = d;
    }
  }
  
  // Backward Pass (bottom-right to top-left)
  for (let y = height - 1; y >= 0; y--) {
    const rowOffset = y * width;
    for (let x = width - 1; x >= 0; x--) {
      const idx = rowOffset + x;
      if (binary[idx] === 0) continue;
      
      let d = dist[idx];
      // Neighbor Right
      if (x < width - 1) d = Math.min(d, dist[idx + 1] + 1);
      // Neighbor Bottom
      if (y < height - 1) d = Math.min(d, dist[idx + width] + 1);
      // Neighbor Bottom-Right
      if (x < width - 1 && y < height - 1) d = Math.min(d, dist[idx + width + 1] + 1.4);
      // Neighbor Bottom-Left
      if (x > 0 && y < height - 1) d = Math.min(d, dist[idx + width - 1] + 1.4);
      
      dist[idx] = d;
    }
  }
  
  // 3. Find max distance for rendering
  let maxDist = 0;
  for (let i = 0; i < width * height; i++) {
    if (dist[i] !== INF && dist[i] > maxDist) {
      maxDist = dist[i];
    }
  }
  
  // 4. Render as grayscale gradient
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const val = maxDist === 0 ? 0 : Math.round((dist[i] / maxDist) * 255);
    data[idx] = data[idx + 1] = data[idx + 2] = val;
    data[idx + 3] = 255;
  }
}
