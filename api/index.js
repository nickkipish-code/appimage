import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateFittingRoomImage, generateImageFromTextPrompt, generateSceneFromTextPrompt } from '../services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

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
  const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
  res.json({ 
    status: 'ok',
    hasApiKey,
    message: hasApiKey ? 'API key is configured' : 'WARNING: API key is not configured'
  });
});

// Generate image from person + clothing images
app.post('/api/generate/fitting-room', upload.fields([
  { name: 'personImage', maxCount: 1 },
  { name: 'clothingImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Received fitting-room request');
    if (!req.files || !req.files.personImage || !req.files.clothingImage) {
      console.error('Missing files:', { files: req.files });
      return res.status(400).json({ error: 'Both person and clothing images are required' });
    }

    const personFile = req.files.personImage[0];
    const clothingFile = req.files.clothingImage[0];

    console.log('Files received:', {
      personSize: personFile.size,
      personType: personFile.mimetype,
      clothingSize: clothingFile.size,
      clothingType: clothingFile.mimetype
    });

    const personImageBase64 = personFile.buffer.toString('base64');
    const clothingImageBase64 = clothingFile.buffer.toString('base64');

    console.log('Calling generateFittingRoomImage...');
    const resultBase64 = await generateFittingRoomImage(
      { base64: personImageBase64, mimeType: personFile.mimetype },
      { base64: clothingImageBase64, mimeType: clothingFile.mimetype }
    );

    console.log('Image generated successfully, size:', resultBase64?.length);
    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating fitting room image:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Extract error message
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    // Determine status code
    let statusCode = 500;
    if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
      statusCode = 429;
    } else if (error?.error?.code) {
      statusCode = error.error.code;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Generate image from person image + text prompt
app.post('/api/generate/text-prompt', upload.single('personImage'), async (req, res) => {
  try {
    console.log('Received text-prompt request');
    if (!req.file) {
      console.error('Missing person image file');
      return res.status(400).json({ error: 'Person image is required' });
    }

    const { textPrompt } = req.body;
    if (!textPrompt || !textPrompt.trim()) {
      console.error('Missing text prompt');
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    console.log('Processing request:', {
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      promptLength: textPrompt.length
    });

    const personImageBase64 = req.file.buffer.toString('base64');

    console.log('Calling generateImageFromTextPrompt...');
    const resultBase64 = await generateImageFromTextPrompt(
      { base64: personImageBase64, mimeType: req.file.mimetype },
      textPrompt.trim()
    );

    console.log('Image generated successfully');
    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating image from text prompt:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    let statusCode = 500;
    if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
      statusCode = 429;
    } else if (error?.error?.code) {
      statusCode = error.error.code;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Generate scene from person image + text prompt
app.post('/api/generate/scene', upload.single('personImage'), async (req, res) => {
  try {
    console.log('Received scene request');
    if (!req.file) {
      console.error('Missing person image file');
      return res.status(400).json({ error: 'Person image is required' });
    }

    const { textPrompt } = req.body;
    if (!textPrompt || !textPrompt.trim()) {
      console.error('Missing text prompt');
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    console.log('Processing scene request:', {
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      promptLength: textPrompt.length
    });

    const personImageBase64 = req.file.buffer.toString('base64');

    console.log('Calling generateSceneFromTextPrompt...');
    const resultBase64 = await generateSceneFromTextPrompt(
      { base64: personImageBase64, mimeType: req.file.mimetype },
      textPrompt.trim()
    );

    console.log('Scene generated successfully');
    res.json({ image: resultBase64 });
  } catch (error) {
    console.error('Error generating scene:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    let statusCode = 500;
    if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
      statusCode = 429;
    } else if (error?.error?.code) {
      statusCode = error.error.code;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// Serve translations
app.get('/api/locales/:lang', (req, res) => {
  const lang = req.params.lang;
  const translationsPath = path.join(__dirname, '../public', 'locales', `${lang}.json`);
  res.sendFile(translationsPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Translation file not found' });
    }
  });
});

// Fallback: serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export for Vercel serverless
export default app;

