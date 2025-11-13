# AI Виртуальная примерочная

Веб-приложение для виртуальной примерки одежды с использованием нанабанана AI.

## Возможности

- Примерка одежды с использованием изображения одежды
- Примерка одежды с использованием текстового описания
- Изменение сцены/окружения на фотографии
- Поддержка русского и украинского языков

## Требования

- Node.js 18+ 
- API ключ нанабанана

## Установка и запуск

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Создайте файл `.env` в корне проекта и добавьте ваш API ключ:
   ```
   NANOBANANA_API_KEY=909a15ea092c13dabaa121e96c0470d9
   PORT=3000
   NANOBANANA_API_URL=https://api.nanobanana.com/v1
   ```
   
   **Примечание:** API ключ по умолчанию уже настроен. Вы можете изменить его через переменную окружения `NANOBANANA_API_KEY`.

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
- `services/nanobananaService.js` - Сервис для работы с нанабанана API
- `mcp-server.js` - MCP сервер для интеграции с n8n
- `services/n8nService.js` - Сервис для работы с n8n API
- `public/` - Статические файлы (HTML, CSS, JS)
- `public/locales/` - Файлы переводов

## API Endpoints

- `POST /api/generate/fitting-room` - Генерация изображения из фото человека и одежды
- `POST /api/generate/text-prompt` - Генерация изображения из фото человека и текстового описания
- `POST /api/generate/scene` - Изменение сцены на фотографии
- `GET /api/locales/:lang` - Получение переводов (ru/uk)

## n8n MCP Integration

Этот проект включает интеграцию с n8n через Model Context Protocol (MCP) для использования с Cursor Mobile.

### Настройка n8n MCP

1. Добавьте переменные окружения в `.env`:
   ```
   N8N_API_URL=http://localhost:5678
   N8N_API_KEY=your-n8n-api-key
   ```

2. Установите зависимости (включая MCP SDK):
   ```bash
   npm install
   ```

3. Запустите MCP сервер:
   ```bash
   npm run mcp
   ```

### Доступные инструменты MCP

- `n8n_list_workflows` - Список всех доступных workflow
- `n8n_execute_workflow` - Выполнение workflow
- `n8n_get_workflow_status` - Получение статуса выполнения
- `n8n_get_workflow` - Получение деталей workflow
- `n8n_webhook_trigger` - Запуск workflow через webhook

Подробная документация доступна в файле `MCP_SETUP.md`.
