/**
 * OCR Web Worker for Document Text Extraction
 * Uses Tesseract.js to perform OCR in a background thread.
 * Lazy-loads Tesseract only when first OCR request is received.
 */

let tesseractWorker = null;
let currentLang = 'eng';

/**
 * Initialize Tesseract worker with the given language.
 * Downloads language pack on first call or when language changes.
 */
async function initTesseract(lang) {
  // Import Tesseract.js from CDN
  if (typeof Tesseract === 'undefined') {
    importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  }

  // If worker exists but language changed, terminate and recreate
  if (tesseractWorker && currentLang !== lang) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }

  if (!tesseractWorker) {
    currentLang = lang;
    tesseractWorker = await Tesseract.createWorker(lang, 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
      logger: (m) => {
        if (m.status && m.progress !== undefined) {
          self.postMessage({
            type: 'progress',
            status: m.status,
            progress: Math.round(m.progress * 100),
          });
        }
      },
    });
  }
}

/**
 * Perform OCR on the given image blob URL.
 */
async function performOCR(imageBlobUrl, lang) {
  try {
    self.postMessage({ type: 'progress', status: 'Đang tải Tesseract...', progress: 0 });

    await initTesseract(lang);

    self.postMessage({ type: 'progress', status: 'Đang nhận dạng văn bản...', progress: 10 });

    const result = await tesseractWorker.recognize(imageBlobUrl);

    self.postMessage({
      type: 'result',
      text: result.data.text,
      confidence: result.data.confidence,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message || 'OCR failed',
    });
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (e) => {
  const { action, imageBlobUrl, lang } = e.data;

  if (action === 'recognize') {
    await performOCR(imageBlobUrl, lang || 'eng');
  } else if (action === 'terminate') {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
    self.close();
  }
});
