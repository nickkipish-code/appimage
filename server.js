import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateFittingRoomImage, generateImageFromTextPrompt, generateSceneFromTextPrompt } from './services/nanobananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload JPG, PNG or WEBP image.'));
    }
  }
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Generate image from person + clothing images
app.post('/api/generate/fitting-room', upload.fields([
  { name: 'personImage', maxCount: 1 },
  { name: 'clothingImage', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.personImage || !req.files.clothingImage) {
      return res.status(400).json({ error: 'Both person and clothing images are required' });
    }

    const personFile = req.files.personImage[0];
    const clothingFile = req.files.clothingImage[0];

    const personImageBase64 = personFile.buffer.toString('base64');
    const clothingImageBase64 = clothingFile.buffer.toString('base64');

    const resultBase64 = await generateFittingRoomImage(
      { base64: personImageBase64, mimeType: personFile.mimetype },
      { base64: clothingImageBase64, mimeType: clothingFile.mimetype }
    );

    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating fitting room image:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

// Generate image from person image + text prompt
app.post('/api/generate/text-prompt', upload.single('personImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Person image is required' });
    }

    const { textPrompt } = req.body;
    if (!textPrompt || !textPrompt.trim()) {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    const personImageBase64 = req.file.buffer.toString('base64');

    const resultBase64 = await generateImageFromTextPrompt(
      { base64: personImageBase64, mimeType: req.file.mimetype },
      textPrompt.trim()
    );

    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating image from text prompt:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

// Generate scene from person image + text prompt
app.post('/api/generate/scene', upload.single('personImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Person image is required' });
    }

    const { textPrompt } = req.body;
    if (!textPrompt || !textPrompt.trim()) {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    const personImageBase64 = req.file.buffer.toString('base64');

    const resultBase64 = await generateSceneFromTextPrompt(
      { base64: personImageBase64, mimeType: req.file.mimetype },
      textPrompt.trim()
    );

    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating scene:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

// Serve translations
app.get('/api/locales/:lang', (req, res) => {
  const lang = req.params.lang;
  const translationsPath = path.join(__dirname, 'public', 'locales', `${lang}.json`);
  res.sendFile(translationsPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Translation file not found' });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

