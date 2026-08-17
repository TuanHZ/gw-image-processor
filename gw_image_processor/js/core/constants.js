export const imageInput = document.getElementById('imageInput');
export const canvasOrg = document.getElementById('canvasOriginal');
export const canvasProc = document.getElementById('canvasProcessed');
export const ctxOrg = canvasOrg.getContext('2d', { willReadFrequently: true });
export const ctxProc = canvasProc.getContext('2d', { willReadFrequently: true });

export const globals = {
  pristineImageData: null,
  originalImageData: null,
  processingHistory: [],
  // Undo/Redo History
  stateHistory: [],      // Array of ImageData snapshots
  historyIndex: -1,      // Current position in the history stack
  MAX_HISTORY_SIZE: 20   // Limit memory usage
};
