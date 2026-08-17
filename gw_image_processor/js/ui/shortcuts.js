import { performUndo, performRedo } from './canvas.js';
import { globals } from '../core/constants.js';
import { aiState, setAIDisplayMode } from './ai-upscale.js';

export function initShortcuts() {
  const modal = document.getElementById('shortcutsModal');
  const btnClose = document.getElementById('btnCloseShortcuts');

  const toggleModal = () => {
    if (modal) {
      modal.classList.toggle('show');
    }
  };

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    // 1. Skip shortcut processing if user is actively typing in form inputs, select boxes, or textareas
    if (document.activeElement && (
      document.activeElement.tagName === 'INPUT' || 
      document.activeElement.tagName === 'SELECT' || 
      document.activeElement.tagName === 'TEXTAREA'
    )) {
      if (e.key === 'Escape' && document.activeElement.className === 'zoom-input') {
        return; // Allow the zoom input inline listener to clean itself up
      }
      if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
        e.preventDefault();
      }
      return;
    }

    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    const noImageMsg = isEn ? 'Please upload an image first!' : 'Vui lòng tải ảnh lên trước!';

    // 2. Control Key combinations
    if (e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (!globals.originalImageData) {
          alert(noImageMsg);
          return;
        }
        performUndo();
      } else if (key === 'y') {
        e.preventDefault();
        if (!globals.originalImageData) {
          alert(noImageMsg);
          return;
        }
        performRedo();
      } else if (key === 's') {
        e.preventDefault();
        if (!globals.originalImageData) {
          alert(noImageMsg);
          return;
        }
        const btnDownload = document.getElementById('btnDownloadTopbar');
        if (btnDownload) btnDownload.click();
      } else if (key === 'r') {
        e.preventDefault();
        if (!globals.originalImageData) {
          alert(noImageMsg);
          return;
        }
        const btnReset = document.getElementById('btnReset');
        if (btnReset) btnReset.click();
      }
    } else {
      // 3. Regular keys (without Ctrl)
      if (e.key === ' ') {
        e.preventDefault();
        
        // If AI mode is active, toggle its display mode
        if (aiState && aiState.isActive) {
          const currentAIMode = aiState.displayMode || 'side';
          const nextAIMode = currentAIMode === 'split' ? 'side' : 'split';
          setAIDisplayMode(nextAIMode);
          return;
        }

        if (!globals.originalImageData) {
          alert(noImageMsg);
          return;
        }
        const btnModeSplit = document.getElementById('btnModeSplit');
        const btnModeSide = document.getElementById('btnModeSide');
        if (btnModeSplit && btnModeSide) {
          const currentMode = btnModeSplit.classList.contains('active') ? 'split' : 'side';
          if (currentMode === 'split') {
            btnModeSide.click();
          } else {
            btnModeSplit.click();
          }
        }
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        toggleModal();
      } else if (e.key === 'Escape') {
        if (modal && modal.classList.contains('show')) {
          modal.classList.remove('show');
          e.preventDefault();
        }
      }
    }
  });
}
