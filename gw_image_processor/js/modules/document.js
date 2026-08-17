/**
 * Document Text Extraction Module
 * Provides OCR text extraction from images using Tesseract.js.
 * Supports: Paste (Ctrl+V), drag-drop, or file browse.
 * Languages: English (eng) and Vietnamese (vie).
 * Export: Copy to clipboard, Save as TXT, Save as Markdown.
 */

import { globals, canvasProc } from '../core/constants.js';

// ============================================================
// Module State
// ============================================================
const docState = {
  isActive: false,
  isProcessing: false,
  ocrWorker: null,
  currentBlobUrl: null,
  pastedFile: null,
};

// ============================================================
// DOM Cache
// ============================================================
let dom = {};

function cacheDom() {
  dom = {
    // Sidebar
    btnDocMode: document.getElementById('btnDocMode'),
    // Workspace
    docWorkspace: document.getElementById('docWorkspace'),
    // Main containers
    mainContainer: document.querySelector('.app-container'),
    mainHeader: document.querySelector('.app-header'),
    // Paste Zone
    docPasteZone: document.getElementById('docPasteZone'),
    docPasteZoneEmpty: document.getElementById('docPasteZoneEmpty'),
    docPasteZonePreview: document.getElementById('docPasteZonePreview'),
    docPreviewThumbnail: document.getElementById('docPreviewThumbnail'),
    docPreviewName: document.getElementById('docPreviewName'),
    docPreviewMeta: document.getElementById('docPreviewMeta'),
    btnDocRemovePreview: document.getElementById('btnDocRemovePreview'),
    docFileInput: document.getElementById('docFileInput'),
    // Language select
    docLanguage: document.getElementById('docLanguage'),
    // Output format
    formatTxt: document.getElementById('docFormatTxt'),
    formatMd: document.getElementById('docFormatMd'),
    // Extract button
    btnExtractText: document.getElementById('btnExtractText'),
    // Progress
    docProgressContainer: document.getElementById('docProgressContainer'),
    docProgressFill: document.getElementById('docProgressFill'),
    docProgressText: document.getElementById('docProgressText'),
    // Text editor
    docTextarea: document.getElementById('docTextarea'),
    // Action buttons
    btnDocCopy: document.getElementById('btnDocCopy'),
    btnDocSaveTxt: document.getElementById('btnDocSaveTxt'),
    btnDocSaveMd: document.getElementById('btnDocSaveMd'),
    btnDocClear: document.getElementById('btnDocClear'),
    docActionButtons: document.getElementById('docActionButtons'),
    // Back button
    btnBackFromDoc: document.getElementById('btnBackFromDoc'),
    // Hint
    docHint: document.getElementById('docHint'),
  };
}

// ============================================================
// View Switching (Enter / Exit Document Mode)
// ============================================================

function enterDocMode() {
  docState.isActive = true;

  // Hide main content area (keep header visible)
  dom.mainContainer.style.display = 'none';

  // Show Document workspace
  dom.docWorkspace.style.display = 'flex';
  dom.btnDocMode.classList.add('active');
  dom.btnExtractText.disabled = false;

  // Auto-focus paste zone so Ctrl+V works immediately
  setTimeout(() => {
    if (dom.docPasteZone) {
      dom.docPasteZone.focus();
      console.log('[Document] Paste zone focused — ready for Ctrl+V');
    }
  }, 100);
}

function exitDocMode() {
  docState.isActive = false;

  // Show main content area
  dom.mainContainer.style.display = 'flex';

  // Hide Document workspace
  dom.docWorkspace.style.display = 'none';
  dom.btnDocMode.classList.remove('active');

  // Clean up blob URL if any
  cleanupBlobUrl();
}

function cleanupBlobUrl() {
  if (docState.currentBlobUrl) {
    URL.revokeObjectURL(docState.currentBlobUrl);
    docState.currentBlobUrl = null;
  }
}

// ============================================================
// File & Image Handling (Upload, Paste, Drag-Drop)
// ============================================================

function handleFileSelect(e) {
  const file = e.target.files[0];
  console.log('[Document] File selected:', file ? file.name : 'none');
  if (file) {
    docState.pastedFile = file;
    showImagePreview(file, file.name);
  }
}

function showImagePreview(file, name = 'pasted_image.png') {
  // Revoke previous thumbnail blob
  if (dom.docPreviewThumbnail.src && dom.docPreviewThumbnail.src.startsWith('blob:')) {
    URL.revokeObjectURL(dom.docPreviewThumbnail.src);
  }
  const thumbnailObjectURL = URL.createObjectURL(file);
  dom.docPreviewThumbnail.src = thumbnailObjectURL;
  dom.docPreviewName.textContent = name;
  dom.docPreviewName.title = name;
  dom.docPreviewMeta.textContent = 'Loading dimensions...';

  const img = new Image();
  img.onload = () => {
    dom.docPreviewMeta.textContent = `${img.width} × ${img.height}`;
  };
  img.src = thumbnailObjectURL;

  // Switch paste zone: hide empty state, show preview
  dom.docPasteZoneEmpty.style.display = 'none';
  dom.docPasteZonePreview.style.display = 'flex';
  dom.btnExtractText.disabled = false;

  console.log('[Document] Preview shown for:', name);
}

function removePreview() {
  docState.pastedFile = null;
  cleanupBlobUrl();
  if (dom.docPreviewThumbnail.src && dom.docPreviewThumbnail.src.startsWith('blob:')) {
    URL.revokeObjectURL(dom.docPreviewThumbnail.src);
    dom.docPreviewThumbnail.src = '';
  }
  dom.docFileInput.value = '';

  // Switch paste zone: show empty state, hide preview
  dom.docPasteZoneEmpty.style.display = 'flex';
  dom.docPasteZonePreview.style.display = 'none';

  console.log('[Document] Preview removed');
}

// ============================================================
// OCR Processing
// ============================================================

async function getImageBlobUrl() {
  cleanupBlobUrl();

  // Always use the pasted/selected file
  const file = docState.pastedFile || dom.docFileInput.files[0];
  if (!file) {
    throw new Error('Vui lòng dán (Ctrl+V) hoặc chọn ảnh trước');
  }
  docState.currentBlobUrl = URL.createObjectURL(file);
  return docState.currentBlobUrl;
}

function getSelectedLanguage() {
  return dom.docLanguage.value; // 'eng' or 'vie'
}

async function startOCR() {
  if (docState.isProcessing) return;

  try {
    const blobUrl = await getImageBlobUrl();
    const lang = getSelectedLanguage();

    docState.isProcessing = true;
    setUIProcessing(true);

    // Create worker if not exists
    if (!docState.ocrWorker) {
      docState.ocrWorker = new Worker('ocr-worker.js');
      docState.ocrWorker.addEventListener('message', handleWorkerMessage);
      docState.ocrWorker.addEventListener('error', handleWorkerError);
    }

    // Send recognition request
    docState.ocrWorker.postMessage({
      action: 'recognize',
      imageBlobUrl: blobUrl,
      lang: lang,
    });
  } catch (error) {
    showError(error.message);
    docState.isProcessing = false;
    setUIProcessing(false);
  }
}

function handleWorkerMessage(e) {
  const { type, text, confidence, status, progress, message } = e.data;

  switch (type) {
    case 'progress':
      updateProgress(status, progress);
      break;

    case 'result':
      docState.isProcessing = false;
      setUIProcessing(false);
      showResult(text, confidence);
      cleanupBlobUrl();
      break;

    case 'error':
      docState.isProcessing = false;
      setUIProcessing(false);
      showError(message);
      cleanupBlobUrl();
      break;
  }
}

function handleWorkerError(e) {
  docState.isProcessing = false;
  setUIProcessing(false);
  showError('OCR Worker lỗi: ' + (e.message || 'Unknown error'));
  cleanupBlobUrl();
}

function setUIProcessing(processing) {
  dom.btnExtractText.disabled = processing;

  if (processing) {
    dom.btnExtractText.innerHTML = `
      <svg class="doc-spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      Đang nhận dạng...
    `;
    dom.docProgressContainer.style.display = 'block';
    dom.docTextarea.value = '';
    dom.docTextarea.placeholder = 'Đang nhận dạng... (0%)';
    dom.docActionButtons.style.display = 'none';
  } else {
    dom.btnExtractText.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      Extract Text
    `;
    dom.docProgressContainer.style.display = 'none';
  }
}

function updateProgress(status, progress) {
  dom.docProgressFill.style.width = `${progress}%`;

  // Translate common Tesseract statuses to Vietnamese
  const statusMap = {
    'loading tesseract core': 'Đang tải Tesseract core',
    'initializing tesseract': 'Đang khởi tạo',
    'loading language traineddata': 'Đang tải gói ngôn ngữ',
    'initializing api': 'Đang khởi tạo API',
    'recognizing text': 'Đang nhận dạng',
  };

  const displayStatus = statusMap[status?.toLowerCase()] || status || 'Đang xử lý';
  dom.docProgressText.textContent = `${displayStatus}... (${progress}%)`;
  dom.docTextarea.placeholder = `Đang nhận dạng... (${progress}%)`;
}

function showResult(text, confidence) {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    dom.docTextarea.value = '';
    dom.docTextarea.placeholder = 'Không tìm thấy văn bản trong ảnh.\n\nGợi ý: Dùng Tab Basic → Threshold / Denoise để cải thiện ảnh trước khi OCR.';
    dom.docActionButtons.style.display = 'none';
  } else {
    dom.docTextarea.value = trimmed;
    dom.docTextarea.placeholder = 'Extracted text will appear here';
    dom.docActionButtons.style.display = 'flex';
  }
}

function showError(message) {
  dom.docTextarea.value = '';
  dom.docTextarea.placeholder = `Lỗi: ${message}`;
  dom.docActionButtons.style.display = 'none';
}




// ============================================================
// Export Functions
// ============================================================

async function copyToClipboard() {
  const text = dom.docTextarea.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showCopyFeedback();
  } catch (err) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopyFeedback();
  }
}

function showCopyFeedback() {
  const originalText = dom.btnDocCopy.innerHTML;
  dom.btnDocCopy.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Đã copy!
  `;
  dom.btnDocCopy.classList.add('doc-btn-success');

  setTimeout(() => {
    dom.btnDocCopy.innerHTML = originalText;
    dom.btnDocCopy.classList.remove('doc-btn-success');
  }, 2000);
}

function saveTXT() {
  const text = dom.docTextarea.value;
  if (!text) return;

  downloadFile(text, 'gw-pixellab-ocr.txt', 'text/plain');
}

function saveMarkdown() {
  const text = dom.docTextarea.value;
  if (!text) return;

  const now = new Date();
  const timestamp = now.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const md = `# Extracted Text
Extracted: ${timestamp}

---

${text}

---
*Source: G&W Pixel Lab v2*
`;

  downloadFile(md, 'gw-pixellab-ocr.md', 'text/markdown');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ============================================================
// Event Handlers for Paste and Drag-Drop (on Paste Zone)
// ============================================================

/**
 * Paste handler — attached directly to the paste zone element.
 * The zone has tabindex="0" so it can receive focus and paste events.
 */
function handlePaste(e) {
  console.log('[Document] Paste event on paste zone');

  const items = e.clipboardData?.items;
  if (!items) {
    console.log('[Document] Paste: no clipboardData items');
    return;
  }

  console.log('[Document] Paste: checking', items.length, 'items');
  for (let i = 0; i < items.length; i++) {
    console.log('[Document] Paste item', i, ':', items[i].type, items[i].kind);
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        console.log('[Document] Paste: image found,', file.size, 'bytes');
        e.preventDefault();
        e.stopPropagation();
        docState.pastedFile = file;
        showImagePreview(file, 'pasted_image.png');
        return;
      }
    }
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  dom.docPasteZone.classList.add('drag-active');
  console.log('[Document] Dragover on paste zone');
}

function handleDragLeave(e) {
  // Only remove highlight if leaving the paste zone entirely
  const rect = dom.docPasteZone.getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
    dom.docPasteZone.classList.remove('drag-active');
    console.log('[Document] Dragleave: exited paste zone');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dom.docPasteZone.classList.remove('drag-active');
  console.log('[Document] Drop on paste zone');

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    console.log('[Document] Dropped file:', file.name, file.type, file.size, 'bytes');
    if (file.type.indexOf('image') !== -1) {
      docState.pastedFile = file;
      showImagePreview(file, file.name);
    } else {
      console.warn('[Document] Dropped file is not an image:', file.type);
    }
  }
}

// ============================================================
// Event Binding
// ============================================================

function bindEvents() {
  console.log('[Document] Binding events...');

  // Enter/Exit Document mode
  dom.btnDocMode.addEventListener('click', () => {
    console.log('[Document] Mode button clicked, isActive:', docState.isActive);
    if (docState.isActive) {
      exitDocMode();
    } else {
      enterDocMode();
    }
  });

  // Back button
  dom.btnBackFromDoc.addEventListener('click', () => {
    console.log('[Document] Back button clicked');
    exitDocMode();
  });

  // File input (browse)
  dom.docFileInput.addEventListener('change', handleFileSelect);

  // Extract button
  dom.btnExtractText.addEventListener('click', () => {
    console.log('[Document] Extract button clicked');
    startOCR();
  });

  // Action buttons
  dom.btnDocCopy.addEventListener('click', () => {
    console.log('[Document] Copy button clicked');
    copyToClipboard();
  });
  dom.btnDocSaveTxt.addEventListener('click', () => {
    console.log('[Document] Save TXT clicked');
    saveTXT();
  });
  dom.btnDocSaveMd.addEventListener('click', () => {
    console.log('[Document] Save MD clicked');
    saveMarkdown();
  });
  dom.btnDocClear.addEventListener('click', () => {
    console.log('[Document] Clear clicked');
    dom.docTextarea.value = '';
    dom.docTextarea.placeholder = 'Extracted text will appear here';
    dom.docActionButtons.style.display = 'none';
  });

  // Remove preview button
  dom.btnDocRemovePreview.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't trigger paste zone focus
    console.log('[Document] Remove preview clicked');
    removePreview();
  });

  // ── Paste Zone: Paste event (the key fix!) ──
  // Attached directly to the paste zone div, NOT to document/window.
  // The paste zone has tabindex="0" so it receives focus + paste events.
  dom.docPasteZone.addEventListener('paste', handlePaste);
  console.log('[Document] Paste listener attached to paste zone element');

  // Also listen on document level as fallback when doc mode is active
  document.addEventListener('paste', (e) => {
    if (!docState.isActive) return;
    // Only handle if paste zone didn't already handle it
    handlePaste(e);
  });

  // ── Paste Zone: Drag & Drop ──
  dom.docPasteZone.addEventListener('dragover', handleDragOver);
  dom.docPasteZone.addEventListener('dragenter', handleDragOver);
  dom.docPasteZone.addEventListener('dragleave', handleDragLeave);
  dom.docPasteZone.addEventListener('drop', handleDrop);
  console.log('[Document] Drag-drop listeners attached to paste zone');

  // ── Paste Zone: Click to focus ──
  dom.docPasteZone.addEventListener('click', () => {
    dom.docPasteZone.focus();
    console.log('[Document] Paste zone clicked & focused');
  });

  // Visual focus indicator
  dom.docPasteZone.addEventListener('focus', () => {
    dom.docPasteZone.classList.add('focused');
  });
  dom.docPasteZone.addEventListener('blur', () => {
    dom.docPasteZone.classList.remove('focused');
  });

  console.log('[Document] All events bound successfully');
}

// ============================================================
// Init
// ============================================================

export function initDocument() {
  console.log('[Document] Initializing module...');
  cacheDom();

  // Debug: log which DOM elements were found / missing
  const criticalElements = [
    'btnDocMode', 'docWorkspace', 'docTextarea', 'docFileInput',
    'btnExtractText', 'btnBackFromDoc', 'docPasteZone',
    'docPasteZoneEmpty', 'docPasteZonePreview',
    'btnDocCopy', 'btnDocClear', 'docPreviewThumbnail',
  ];
  const missing = criticalElements.filter(k => !dom[k]);
  if (missing.length > 0) {
    console.warn('[Document] Missing DOM elements:', missing.join(', '));
  }

  if (!dom.btnDocMode || !dom.docWorkspace) {
    console.warn('[Document] Critical DOM elements not found (btnDocMode or docWorkspace), skipping init.');
    return;
  }

  bindEvents();

  // Expose module on window for console debugging
  window.documentModule = {
    state: docState,
    dom,
    enterDocMode,
    exitDocMode,
    startOCR,
  };

  console.log('[Document] Module initialized. Type `documentModule` in console to inspect.');
}

/**
 * Check if Document mode is currently active.
 * Used by other modules (e.g., events.js) to skip their own paste handling.
 */
export function isDocumentActive() {
  return docState.isActive;
}
