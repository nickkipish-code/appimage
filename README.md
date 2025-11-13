# AI Виртуальная примерочная

Веб-приложение для виртуальной примерки одежды с использованием Google Gemini AI.

## Возможности

- Примерка одежды с использованием изображения одежды
- Примерка одежды с использованием текстового описания
- Изменение сцены/окружения на фотографии
- Поддержка русского и украинского языков

## Требования

- Node.js 18+ 
- API ключ Google Gemini

## Установка и запуск

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Создайте файл `.env` в корне проекта и добавьте ваш API ключ:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

3. Запустите сервер:
   ```bash
   npm start
   ```

   Или для разработки:
   ```bash
   npm run dev
   ```

4. Откройте браузер и перейдите по адресу: `http://localhost:3000`

## Структура проекта

- `server.js` - Express сервер с API endpoints
- `services/geminiService.js` - Сервис для работы с Google Gemini API
- `public/` - Статические файлы (HTML, CSS, JS)
- `public/locales/` - Файлы переводов

## API Endpoints

- `POST /api/generate/fitting-room` - Генерация изображения из фото человека и одежды
- `POST /api/generate/text-prompt` - Генерация изображения из фото человека и текстового описания
- `POST /api/generate/scene` - Изменение сцены на фотографии
- `GET /api/locales/:lang` - Получение переводов (ru/uk)
