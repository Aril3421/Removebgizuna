// ==============================================================
// ELEMENT REFERENCES
// ==============================================================
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');

const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');

const previewImage = document.getElementById('previewImage');
const resultImage = document.getElementById('resultImage');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const loadingState = document.getElementById('loadingState');
const loadingText = document.getElementById('loadingText');
const progressFill = document.getElementById('progressFill');

const processBtn = document.getElementById('processBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');

const toastContainer = document.getElementById('toastContainer');

// ==============================================================
// STATE
// ==============================================================
let selectedFile = null;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB

// ==============================================================
// TOAST NOTIFICATION
// ==============================================================
function showToast(message, type = 'info') {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

// ==============================================================
// FILE VALIDATION
// ==============================================================
function validateFile(file) {
  if (!file) {
    return { valid: false, message: 'Tidak ada file yang dipilih' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, message: 'Format file tidak didukung. Gunakan PNG, JPG, JPEG, atau WEBP' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'Ukuran file terlalu besar. Maksimal 12MB' };
  }

  return { valid: true };
}

// ==============================================================
// FILE HANDLING & PREVIEW
// ==============================================================
function handleFile(file) {
  const validation = validateFile(file);

  if (!validation.valid) {
    showToast(validation.message, 'error');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    showPreviewSection();
    showToast('Gambar berhasil dimuat, klik "Hapus Background" untuk memproses', 'success');
  };
  reader.onerror = () => {
    showToast('Gagal membaca file gambar', 'error');
  };
  reader.readAsDataURL(file);
}

function showPreviewSection() {
  uploadSection.classList.add('hidden');
  previewSection.classList.remove('hidden');
  resetResultView();
}

function resetResultView() {
  resultImage.classList.add('hidden');
  resultImage.src = '';
  resultPlaceholder.classList.remove('hidden');
  loadingState.classList.add('hidden');
  downloadBtn.classList.add('hidden');
  progressFill.style.width = '0%';
  processBtn.disabled = false;
  processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Hapus Background';
}

function resetAll() {
  selectedFile = null;
  fileInput.value = '';
  previewImage.src = '';
  uploadSection.classList.remove('hidden');
  previewSection.classList.add('hidden');
  resetResultView();
}

// ==============================================================
// DRAG & DROP EVENTS
// ==============================================================
dropzone.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFile(e.target.files[0]);
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
});

// ==============================================================
// PROCESS IMAGE (UPLOAD VIA FETCH API)
// ==============================================================
processBtn.addEventListener('click', async () => {
  if (!selectedFile) {
    showToast('Silakan pilih gambar terlebih dahulu', 'error');
    return;
  }

  await uploadImage(selectedFile);
});

async function uploadImage(file) {
  // UI: mulai loading
  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  resultPlaceholder.classList.add('hidden');
  resultImage.classList.add('hidden');
  loadingState.classList.remove('hidden');
  loadingText.textContent = 'Mengunggah gambar...';
  progressFill.style.width = '15%';

  const formData = new FormData();
  formData.append('image', file);

  try {
    // Simulasi progress bertahap selagi menunggu response
    const progressInterval = simulateProgress();

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    clearInterval(progressInterval);
    progressFill.style.width = '100%';
    loadingText.textContent = 'Menyelesaikan...';

    const data = await response.json();

    if (response.ok && data.success) {
      setTimeout(() => showResult(data.result_url), 300);
    } else {
      handleUploadError(data.message || 'Terjadi kesalahan saat memproses gambar');
    }
  } catch (error) {
    handleUploadError('Gagal terhubung ke server. Periksa koneksi internet Anda');
  }
}

function simulateProgress() {
  let progress = 15;
  const messages = [
    'Mengunggah gambar...',
    'Menganalisis objek...',
    'Menghapus background...',
    'Hampir selesai...',
  ];
  let msgIndex = 0;

  return setInterval(() => {
    if (progress < 85) {
      progress += Math.random() * 12;
      progress = Math.min(progress, 85);
      progressFill.style.width = `${progress}%`;

      if (progress > (msgIndex + 1) * 20 && msgIndex < messages.length - 1) {
        msgIndex++;
        loadingText.textContent = messages[msgIndex];
      }
    }
  }, 500);
}

function showResult(resultUrl) {
  loadingState.classList.add('hidden');
  resultImage.src = resultUrl;
  resultImage.classList.remove('hidden');
  downloadBtn.href = resultUrl;
  downloadBtn.classList.remove('hidden');

  processBtn.disabled = false;
  processBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Proses Ulang';

  showToast('Background berhasil dihapus!', 'success');
}

function handleUploadError(message) {
  loadingState.classList.add('hidden');
  resultPlaceholder.classList.remove('hidden');
  processBtn.disabled = false;
  processBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Hapus Background';
  progressFill.style.width = '0%';

  showToast(message, 'error');
}

// ==============================================================
// RESET / UPLOAD LAGI
// ==============================================================
resetBtn.addEventListener('click', () => {
  resetAll();
  showToast('Siap mengunggah gambar baru', 'info');
});

// ==============================================================
// DOWNLOAD FEEDBACK
// ==============================================================
downloadBtn.addEventListener('click', () => {
  showToast('Mengunduh gambar...', 'success');
});
