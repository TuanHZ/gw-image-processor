import { globals } from '../core/constants.js';

export function initExportSystem() {
  const toggleBtn = document.getElementById('btnDownloadOptionsToggle');
  const panel = document.getElementById('exportOptionsPanel');
  const container = document.getElementById('downloadDropdownContainer');
  const qualityRow = document.getElementById('exportQualityRow');
  const qualitySlider = document.getElementById('exportQualitySlider');
  const qualityValue = document.getElementById('exportQualityValue');
  const sizeValue = document.getElementById('exportSizeValue');
  const btnConfirm = document.getElementById('btnConfirmExport');

  if (!toggleBtn || !panel || !container) return;

  // Toggle Panel show
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    if (!globals.originalImageData) {
      alert(isEn ? 'Please upload an image first!' : 'Vui lòng tải ảnh lên trước!');
      return;
    }
    
    panel.classList.toggle('show');
    const isShown = panel.classList.contains('show');
    toggleBtn.classList.toggle('active', isShown);
    if (isShown) {
      calculateEstimatedSize();
    }
  });

  // Click outside to close panel
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      panel.classList.remove('show');
      toggleBtn.classList.remove('active');
    }
  });

  // Format Radio Buttons Changed
  document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'png') {
        qualityRow.style.display = 'none';
      } else {
        qualityRow.style.display = 'flex';
      }
      calculateEstimatedSize();
    });
  });

  // Quality Slider Input
  if (qualitySlider && qualityValue) {
    qualitySlider.addEventListener('input', (e) => {
      qualityValue.innerText = e.target.value + '%';
      calculateEstimatedSize();
    });
  }

  // Calculate Estimated Size
  function calculateEstimatedSize() {
    const canvas = document.getElementById('canvasProcessed');
    if (!canvas || canvas.width === 0) return;

    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const quality = parseFloat(qualitySlider.value) / 100;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');

    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    sizeValue.innerText = isEn ? 'Estimated size: Estimating...' : 'Kích thước ước tính: Đang tính...';

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sizeInKB = blob.size / 1024;
      const sizeStr = sizeInKB > 1024 
        ? (sizeInKB / 1024).toFixed(2) + ' MB' 
        : sizeInKB.toFixed(1) + ' KB';
      
      sizeValue.innerText = (isEn ? 'Estimated size: ~' : 'Kích thước ước tính: ~') + sizeStr;
    }, mimeType, quality);
  }

  // Confirm Export Click
  btnConfirm.addEventListener('click', () => {
    const canvas = document.getElementById('canvasProcessed');
    const isEn = localStorage.getItem('pixel_lab_lang') === 'en';
    if (!canvas || canvas.width === 0) {
      alert(isEn ? 'No image available to export!' : 'Không có ảnh nào để xuất!');
      return;
    }

    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const quality = parseFloat(qualitySlider.value) / 100;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');
    const ext = format === 'jpeg' ? 'jpg' : format;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GW_PixelLab_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Close dropdown popup
      panel.classList.remove('show');
      toggleBtn.classList.remove('active');
    }, mimeType, quality);
  });
}
