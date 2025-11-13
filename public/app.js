// Translation system
let currentLanguage = 'ru';
let translations = {};

const loadTranslations = async (lang) => {
  try {
    const response = await fetch(`/api/locales/${lang}`);
    if (!response.ok) throw new Error('Failed to load translations');
    translations = await response.json();
    updateUI();
  } catch (error) {
    console.error('Error loading translations:', error);
  }
};

const t = (key) => translations[key] || key;

const updateUI = () => {
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    if (key) {
      el.textContent = t(key);
    }
  });
  document.title = t('appTitle');
  document.documentElement.lang = currentLanguage;
};

// State
let mode = 'image';
let personImage = null;
let clothingImage = null;
let textPrompt = '';

// DOM Elements
const personInput = document.getElementById('person-input');
const clothingInput = document.getElementById('clothing-input');
const textPromptEl = document.getElementById('text-prompt');
const personPreview = document.getElementById('person-preview');
const clothingPreview = document.getElementById('clothing-preview');
const personImg = document.getElementById('person-img');
const clothingImg = document.getElementById('clothing-img');
const personUpload = document.getElementById('person-upload');
const clothingUpload = document.getElementById('clothing-upload');
const clearPersonBtn = document.getElementById('clear-person');
const clearClothingBtn = document.getElementById('clear-clothing');
const clothingContainer = document.getElementById('clothing-container');
const textContainer = document.getElementById('text-container');
const textTitle = document.getElementById('text-title');
const generateBtn = document.getElementById('generate-btn');
const generateText = document.getElementById('generate-text');
const generatingText = document.getElementById('generating-text');
const spinner = document.getElementById('spinner');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const resultPreview = document.getElementById('result-preview');
const resultPlaceholder = document.getElementById('result-placeholder');
const resultImg = document.getElementById('result-img');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const closeModalBtn = document.getElementById('close-modal');

// Mode buttons
const modeImageBtn = document.getElementById('mode-image');
const modeTextBtn = document.getElementById('mode-text');
const modeSceneBtn = document.getElementById('mode-scene');

// Language buttons
const langRuBtn = document.getElementById('lang-ru');
const langUkBtn = document.getElementById('lang-uk');

// File handling
const handleFileSelect = (file, type) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showError(t('errorInvalidFileType'));
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    if (type === 'person') {
      personImage = { file, dataUrl: e.target.result };
      personImg.src = e.target.result;
      personPreview.classList.remove('hidden');
      personUpload.classList.add('hidden');
    } else {
      clothingImage = { file, dataUrl: e.target.result };
      clothingImg.src = e.target.result;
      clothingPreview.classList.remove('hidden');
      clothingUpload.classList.add('hidden');
    }
    hideError();
  };
  reader.onerror = () => {
    showError(t('errorFileRead'));
  };
  reader.readAsDataURL(file);
};

// Event listeners
personInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelect(e.target.files[0], 'person');
  }
});

clothingInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelect(e.target.files[0], 'clothing');
  }
});

clearPersonBtn.addEventListener('click', () => {
  personImage = null;
  personInput.value = '';
  personPreview.classList.add('hidden');
  personUpload.classList.remove('hidden');
});

clearClothingBtn.addEventListener('click', () => {
  clothingImage = null;
  clothingInput.value = '';
  clothingPreview.classList.add('hidden');
  clothingUpload.classList.remove('hidden');
});

// Drag and drop
const setupDragDrop = (element, input, type) => {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.add('border-blue-500', 'bg-gray-100');
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('border-blue-500', 'bg-gray-100');
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('border-blue-500', 'bg-gray-100');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0], type);
    }
  });
};

setupDragDrop(personUpload, personInput, 'person');
setupDragDrop(clothingUpload, clothingInput, 'clothing');

// Mode switching
const setMode = (newMode) => {
  mode = newMode;
  
  // Update button styles
  [modeImageBtn, modeTextBtn, modeSceneBtn].forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
    btn.classList.add('bg-white', 'text-gray-900', 'border-gray-200');
  });

  if (mode === 'image') {
    modeImageBtn.classList.remove('bg-white', 'text-gray-900', 'border-gray-200');
    modeImageBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
    clothingContainer.classList.remove('hidden');
    textContainer.classList.add('hidden');
  } else {
    if (mode === 'text') {
      modeTextBtn.classList.remove('bg-white', 'text-gray-900', 'border-gray-200');
      modeTextBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
      textTitle.setAttribute('data-key', 'describeClothing');
    } else {
      modeSceneBtn.classList.remove('bg-white', 'text-gray-900', 'border-gray-200');
      modeSceneBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
      textTitle.setAttribute('data-key', 'describeScene');
    }
    clothingContainer.classList.add('hidden');
    textContainer.classList.remove('hidden');
    textPromptEl.setAttribute('placeholder', t(mode === 'text' ? 'textPlaceholder' : 'scenePlaceholder'));
  }
  updateUI();
};

modeImageBtn.addEventListener('click', () => setMode('image'));
modeTextBtn.addEventListener('click', () => setMode('text'));
modeSceneBtn.addEventListener('click', () => setMode('scene'));

// Language switching
langRuBtn.addEventListener('click', () => {
  currentLanguage = 'ru';
  langRuBtn.classList.add('bg-blue-600', 'text-white');
  langRuBtn.classList.remove('bg-white', 'text-gray-700');
  langUkBtn.classList.remove('bg-blue-600', 'text-white');
  langUkBtn.classList.add('bg-white', 'text-gray-700');
  loadTranslations('ru');
});

langUkBtn.addEventListener('click', () => {
  currentLanguage = 'uk';
  langUkBtn.classList.add('bg-blue-600', 'text-white');
  langUkBtn.classList.remove('bg-white', 'text-gray-700');
  langRuBtn.classList.remove('bg-blue-600', 'text-white');
  langRuBtn.classList.add('bg-white', 'text-gray-700');
  loadTranslations('uk');
});

// Generate
const showError = (message) => {
  errorMessage.textContent = message;
  errorContainer.classList.remove('hidden');
};

const hideError = () => {
  errorContainer.classList.add('hidden');
};

const setLoading = (loading) => {
  generateBtn.disabled = loading;
  if (loading) {
    generateText.classList.add('hidden');
    generatingText.classList.remove('hidden');
    spinner.classList.remove('hidden');
  } else {
    generateText.classList.remove('hidden');
    generatingText.classList.add('hidden');
    spinner.classList.add('hidden');
  }
};

generateBtn.addEventListener('click', async () => {
  if (!personImage) {
    showError(t('errorPersonPhoto'));
    return;
  }

  if ((mode === 'text' || mode === 'scene') && !textPrompt.trim()) {
    showError(mode === 'text' ? t('errorTextPrompt') : t('errorScenePrompt'));
    return;
  }

  if (mode === 'image' && !clothingImage) {
    showError(t('errorClothingPhoto'));
    return;
  }

  setLoading(true);
  hideError();
  resultPreview.classList.add('hidden');
  resultPlaceholder.classList.remove('hidden');

  try {
    const formData = new FormData();
    formData.append('personImage', personImage.file);

    let endpoint;
    if (mode === 'image') {
      formData.append('clothingImage', clothingImage.file);
      endpoint = '/api/generate/fitting-room';
    } else if (mode === 'text') {
      formData.append('textPrompt', textPrompt.trim());
      endpoint = '/api/generate/text-prompt';
    } else {
      formData.append('textPrompt', textPrompt.trim());
      endpoint = '/api/generate/scene';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('API Error:', errorData);
      throw new Error(errorData.error || `Failed to generate image (${response.status})`);
    }

    const data = await response.json();
    
    if (!data.image) {
      throw new Error('No image data received from server');
    }
    
    resultImg.src = `data:image/png;base64,${data.image}`;
    resultPreview.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
  } catch (error) {
    console.error('Generation error:', error);
    const errorMessage = error.message || 'An unknown error occurred. Please check the console for details.';
    showError(errorMessage);
  } finally {
    setLoading(false);
  }
});

// Text prompt
textPromptEl.addEventListener('input', (e) => {
  textPrompt = e.target.value;
});

// Modal
resultImg.addEventListener('click', () => {
  modalImg.src = resultImg.src;
  modal.classList.remove('hidden');
});

resultPreview.querySelector('.group').addEventListener('click', () => {
  modalImg.src = resultImg.src;
  modal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
  }
});

// Initialize
loadTranslations('ru');

