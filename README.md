# 🎨 G&W Pixel Lab v2 - Professional Image Processing Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/Language-JavaScript%20ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Workers](https://img.shields.io/badge/Multi--threading-Web%20Workers-orange)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()

> **G&W Pixel Lab v2** là ứng dụng xử lý ảnh số chuyên nghiệp (Web-based Studio) được thiết kế và triển khai bám sát chặt chẽ theo giáo trình kinh điển **Digital Image Processing (Rafael C. Gonzalez & Richard E. Woods)** từ Chương 3 đến Chương 10, kết hợp các công nghệ xử lý ảnh hiện đại và AI.

---

## 🌟 Tính Năng Nổi Bật (Key Features)

### 1. 📐 Xử Lý Không Gian & Cường Độ (Spatial Domain & Intensity Transformations - Chương 3)
- **Biến đổi cường độ sáng**: Negative (Ảnh âm bản), Logarithmic, Power-law (Gamma Correction), Piecewise Linear (Contrast Stretching, Bit-plane Slicing).
- **Lược đồ độ xám (Histogram)**:
  - Vẽ lược đồ tần số độ sáng (RGB / Grayscale Histogram) theo thời gian thực.
  - Cân bằng lược đồ độ xám (Histogram Equalization - HE).
  - Cân bằng lược đồ độ xám thích nghi cục bộ (CLAHE / Local Histogram Equalization).
  - Khớp lược đồ độ xám mục tiêu (Histogram Matching / Specification).
- **Lọc không gian tuyến tính & phi tuyến**:
  - Làm mịn ảnh (Smoothing / Blur): Box Filter, Gaussian Blur, Bilateral Filter (giữ biên cạnh).
  - Làm nét ảnh (Sharpening): Laplacian Filter, High-boost Filtering, Unsharp Masking.

---

### 2. 🌊 Miền Tần Số & Phân Tích Fourier (Frequency Domain - Chương 4)
- **Biến đổi Fourier 2D (Fast Fourier Transform - 2D FFT & Inverse 2D IFFT)**.
- **Trực quan hóa quang phổ Fourier (Fourier Magnitude Spectrum & Phase)** với hiển thị log dynamic range và dời gốc tần số về tâm (DC-centering).
- **Bộ lọc miền tần số lý tưởng & mịn**:
  - **Lowpass Filters (LPF)**: Ideal LPF, Butterworth LPF, Gaussian LPF.
  - **Highpass Filters (HPF)**: Ideal HPF, Butterworth HPF, Gaussian HPF.
  - **Bandpass & Bandreject Filters**: Lọc dải thông và triệt dải.
  - **Notch Filters (Lọc khe/Lọc khuyết)**: Triệt tiêu các vân nhiễu tuần hoàn (periodic interference / moiré patterns).
  - **High-frequency Emphasis Filtering**: Tăng cường chi tiết cao tần kết hợp biến đổi lược đồ.

---

### 3. 🛡️ Khôi Phục Ảnh & Khử Nhiễu (Image Restoration & Noise Models - Chương 5)
- **Mô hình tạo nhiễu**: Nhiễu muối tiêu (Salt & Pepper), Nhiễu Gauss (Gaussian Noise), Nhiễu đốm (Speckle), Nhiễu Poisson, Nhiễu sọc tuần hoàn.
- **Bộ lọc khôi phục không gian**:
  - Mean Filters: Arithmetic Mean, Geometric Mean, Harmonic Mean, Contraharmonic Mean.
  - Order-Statistic Filters: Median Filter, Max/Min Filter, Midpoint Filter, Alpha-Trimmed Mean.
  - Adaptive Filters: Adaptive Local Noise Reduction Filter, Adaptive Median Filter.
- **Bộ lọc khôi phục tần số**:
  - Lọc nghịch đảo (Direct Inverse Filter) kèm ngưỡng giới hạn bán kính cắt chống chia cho 0.
  - Lọc Wiener (Wiener / Minimum Mean Square Error Filter).
  - Lọc bình phương tối thiểu có ràng buộc (Constrained Least Squares - CLS Filtering).

---

### 4. 🔲 Xử Lý Ảnh Hình Thái Học (Morphological Image Processing - Chương 9)
- Hỗ trợ phần tử cấu trúc (Structuring Element - SE): Square, Cross, Disk, Line với kích thước tùy biến.
- **Các phép toán cơ bản trên ảnh nhị phân & ảnh xám**:
  - Giãn ảnh (Dilation) và Co ảnh (Erosion).
  - Mở ảnh (Opening) và Đóng ảnh (Closing).
  - Biến đổi Hit-or-Miss (HMT).
- **Các thuật toán hình thái học mở rộng**:
  - Trích xuất biên hình thái (Morphological Boundary Extraction).
  - Lấp đầy vùng (Region Hole Filling), Trích xuất thành phần liên thông (Connected Components).
  - Biến đổi Top-Hat (White Top-hat) và Bottom-Hat (Black Top-hat).
  - Rút xương đối tượng (Skeletonization / Medial Axis Thinning).

---

### 5. ✂️ Phân Đoạn Ảnh (Image Segmentation - Chương 10)
- **Phát hiện điểm, đường và biên cạnh**:
  - Toán tử vi phân bậc một: Sobel Operator, Prewitt Operator, Roberts Cross.
  - Toán tử vi phân bậc hai: Laplacian of Gaussian (LoG), Marr-Hildreth.
  - **Canny Edge Detector**: Đầy đủ 5 bước chuẩn hóa (Gaussian Smoothing $\to$ Gradient $\to$ Non-maximum Suppression $\to$ Double Thresholding $\to$ Hysteresis Edge Tracking).
- **Phân ngưỡng ảnh (Image Thresholding)**:
  - Phân ngưỡng toàn cục tối ưu Otsu (Otsu's Thresholding Method).
  - Phân ngưỡng thích nghi cục bộ (Adaptive Local Thresholding: Mean & Gaussian).
  - Phân ngưỡng đa mức (Multi-level Thresholding).
- **Phân đoạn theo vùng**:
  - Phát triển vùng dựa trên hạt giống (Seed-based Region Growing).
  - Tách và hợp vùng (Split and Merge Algorithm).
  - Phân đoạn Watershed (Biến đổi lưu vực sông phân tách tế bào/vật thể chạm nhau).

---

### 6. 🤖 Phóng To Ảnh AI (Super Resolution) & Xử Lý Tài Liệu (OCR)
- **AI / Smart Upscaling**:
  - Thuật toán nội suy cao cấp: Bilinear, Bicubic (Hermite/Catmull-Rom), Lanczos-3, Pixel Art Scaler (xBRZ/EPX-inspired).
  - Mô phỏng nâng cấp chi tiết AI (Edge-directed Interpolation & Texture Synthesis).
- **Xử lý tài liệu & Quét văn bản (Document Scanner)**:
  - Tự động nắn thẳng góc xoay văn bản (Auto Deskew via Radon / Hough transform).
  - Cắt và hiệu chỉnh góc nhìn (Perspective Transform).
  - Tăng độ tương phản chữ viết, tẩy nền tài liệu (Document Binarization & Clean-up).
  - Tích hợp OCR (Tesseract.js) nhận diện chữ viết đa ngôn ngữ (Tiếng Việt, Tiếng Anh).

---

## 🏗️ Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
gw-image-processor/
│
├── index.html                      # Giao diện chính Studio (HTML5 Canvas + UI Panels)
├── style.css                       # Giao diện Modern Glassmorphism & Dark Mode
├── ocr-worker.js                   # Web Worker xử lý nhận dạng ký tự quang học (OCR)
├── manifest.json                   # Web App Manifest (hỗ trợ cài đặt PWA)
├── run_app.bat                     # File thực thi chạy nhanh ứng dụng cục bộ
│
└── js/
    ├── main.js                     # Điểm khởi động ứng dụng & Quản lý vòng đời UI
    ├── worker.js                   # Multi-thread Background Worker (xử lý FFT, Filter nặng)
    │
    ├── core/                       # Nhân xử lý cốt lõi
    │   ├── constants.js            # Hằng số, ma trận Kernel, cấu hình
    │   ├── engine.js               # Pipeline xử lý ảnh trên Pixel Buffer
    │   ├── fft.js                  # Thuật toán 2D Cooley-Tukey FFT & IFFT
    │   ├── state.js                # Quản lý State, History (Undo/Redo Stack)
    │   └── utils.js                # Hàm tiện ích hình học, ma trận, color space
    │
    ├── filters/                    # Các module thuật toán theo chuẩn G&W
    │   ├── intensity.js            # Biến đổi mức xám, Histogram & CLAHE (Chương 3)
    │   ├── blur-kernels.js         # Các bộ lọc không gian tuyến tính & phi tuyến
    │   ├── frequency.js            # Lọc miền tần số (Chương 4)
    │   ├── restoration.js          # Bộ lọc khôi phục ảnh & khử nhiễu (Chương 5)
    │   ├── morphology.js           # Xử lý hình thái học Toán học (Chương 9)
    │   ├── edge.js                 # Phát hiện biên (Sobel, Canny, LoG) (Chương 10)
    │   ├── segmentation.js         # Phân đoạn Otsu, Watershed, Region Growing (Chương 10)
    │   ├── color.js                # Biến đổi không gian màu (RGB, HSV, HSL, CMYK, YUV)
    │   ├── enhancement.js          # Tăng cường chi tiết, Retinex, HDR Tone Mapping
    │   └── ai-upscale-engines.js   # Công cụ nội suy siêu phân giải
    │
    ├── modules/
    │   └── document.js             # Xử lý quét tài liệu, nắn phối cảnh & OCR
    │
    └── ui/                         # Giao diện người dùng & Tương tác
        ├── canvas.js               # Render Canvas tương tác, Pan & Zoom viewport
        ├── analysis.js             # Phân tích biểu đồ Histogram, Profile Line, 3D Mesh
        ├── export.js               # Xuất file (PNG, WebP, JPG, PDF) kèm nén dữ liệu
        ├── presets.js              # Các cấu hình bộ lọc mẫu theo tình huống thực tế
        ├── shortcuts.js            # Hệ thống phím tắt chuyên nghiệp
        └── events.js               # Xử lý sự kiện kéo thả, thanh trượt, toggle
```

---

## ⚡ Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Getting Started)

Dự án hoạt động hoàn toàn trên trình duyệt phía Client (Pure Client-side Web App), không cần cài đặt backend phức tạp:

### Cách 1: Chạy trực tiếp bằng file `.bat` (Windows)
1. Clone dự án về máy:
   ```bash
   git clone https://github.com/TuanHZ/gw-image-processor.git
   cd gw-image-processor
   ```
2. Nhấp đúp chuột vào file `run_app.bat` (hoặc mở trong thư mục `gw_image_processor/run_app.bat`).
3. Trình duyệt mặc định sẽ tự động mở giao diện ứng dụng.

### Cách 2: Sử dụng Live Server hoặc Python Web Server
Vì ứng dụng sử dụng **Web Workers** và **ES6 Modules**, bạn nên chạy dưới một HTTP server cục bộ để tránh chính sách bảo mật CORS của trình duyệt:

- **Dùng Python**:
  ```bash
  cd gw_image_processor
  python -m http.server 8000
  ```
  Sau đó mở trình duyệt truy cập: `http://localhost:8000`

- **Dùng Node.js (npx serve)**:
  ```bash
  npx serve gw_image_processor
  ```

- **Dùng Visual Studio Code**: Cài đặt extension **Live Server** $\to$ Chuột phải vào `gw_image_processor/index.html` $\to$ Chọn **Open with Live Server**.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Frontend Core**: HTML5 Canvas API, JavaScript (Modern ES6+ Modules).
- **Architecture**: Mô hình Module hóa hướng đối tượng, tách biệt Data/Engine/UI.
- **Multithreading**: HTML5 Web Workers xử lý các tác vụ tính toán song song ma trận điểm ảnh nặng mà không gây đơ giao diện.
- **Styling**: CSS3 Custom Properties, Modern Glassmorphism UI, Responsive & Dark Theme Studio.
- **OCR Engine**: Tesseract.js (WebAssembly OCR Engine).

---

## 👨‍💻 Tác Giả (Author)

- **Nguyễn Hoàng Anh Tuấn** ([@TuanHZ](https://github.com/TuanHZ))
- **Email**: nguyentuan02092004@gmail.com

---

## 📜 Bản Quyền (License)

Dự án được phân phối dưới giấy phép **MIT License**. Bạn có thể tự do sử dụng cho mục đích học tập, nghiên cứu và phát triển thương mại.
