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
- `public/` - Статические файлы (HTML, CSS, JS)
- `public/locales/` - Файлы переводов

## API Endpoints

- `POST /api/generate/fitting-room` - Генерация изображения из фото человека и одежды
- `POST /api/generate/text-prompt` - Генерация изображения из фото человека и текстового описания
- `POST /api/generate/scene` - Изменение сцены на фотографии
- `GET /api/locales/:lang` - Получение переводов (ru/uk)

## Интеграция n8n через Model Context Protocol

Проект содержит MCP-мост (`mcp/n8nMcpServer.js`), который позволяет использовать Cursor Mobile (и другие клиенты MCP) для вызова n8n‑воркфлоу и получения контекста.

### 1. Настройка окружения

Добавьте переменные в `.env` (или экспортируйте их перед запуском):

```
N8N_BASE_URL=https://your-n8n-instance.example.com
N8N_API_KEY=your-n8n-api-key          # необязательно, если вебхуки публичные
N8N_API_KEY_HEADER=X-N8N-API-KEY      # необязательно, по умолчанию X-N8N-API-KEY
N8N_MCP_TIMEOUT_MS=25000              # необязательно, таймаут запроса в мс
N8N_MCP_BODY_PREVIEW_LIMIT=8192       # необязательно, длина предпросмотра ответа
```

> Если у вашего вебхука нет API-ключа, пропустите `N8N_API_KEY`. Для нестандартного заголовка авторизации задайте `N8N_API_KEY_HEADER`.

### 2. Описываем доступные воркфлоу

Есть два варианта:

1. Создайте файл `mcp/workflows.json` на основе `mcp/workflows.example.json`.
2. Или задайте переменную `N8N_MCP_WORKFLOWS` со строкой JSON.

Каждый объект описывает воркфлоу:

```json
{
  "id": "support-ticket",
  "name": "Create Support Ticket",
  "description": "Создает обращение в Service Desk",
  "webhookPath": "webhook/support-ticket",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "defaultPayload": {
    "priority": "normal"
  },
  "query": {
    "source": "cursor-mobile"
  }
}
```

- `id` — идентификатор, который будет использоваться в вызовах MCP.
- `webhookPath` — путь к вебхуку (`https://.../<webhookPath>`).
- `method` — HTTP-метод (GET/POST/PUT/PATCH/DELETE).
- `headers`, `query`, `defaultPayload` — необязательные значения по умолчанию.

### 3. Запуск MCP-сервера

Установите зависимости (если ещё не делали):

```bash
npm install
```

Запустите сервер (по умолчанию WebSocket на `ws://localhost:4123`):

```bash
npm run mcp:n8n
```

Для клиентов, которым нужен STDIO-транспорт (например, локальный запуск из Cursor Desktop):

```bash
npm run mcp:n8n:stdio
```

### 4. Подключение в Cursor Mobile

1. Откройте `Settings` → `Model Context`.
2. Выберите **Add Source** → **Custom MCP**.
3. Для WebSocket укажите `ws://<ваш-хост>:4123`.
4. Для STDIO укажите команду запуска (например, `npm run mcp:n8n:stdio`) и рабочую директорию проекта.

После подключения в Cursor появятся:

- **Resources**: `n8n://workflow/<id>` с описанием настроенных воркфлоу.
- **Tools**:
  - `listWorkflows` — возвращает список доступных воркфлоу.
  - `triggerWorkflow` — вызывает вебхук выбранного воркфлоу. Поля:
    - `workflowId` (обязательное) — соответствует `id` из конфигурации.
    - `payload`, `query`, `headers`, `method`, `webhookPath` — необязательные переопределения.

Ответ `triggerWorkflow` содержит статус HTTP, заголовки и JSON/текст ответа (обрезанный предпросмотр + десериализованный JSON, если удалось распарсить).

### 5. Советы по безопасности

- Для публичных воркфлоу используйте уникальные webhook-path, которые трудно угадать.
- Предпочтительно использовать `N8N_API_KEY` и ограничивать права API-ключей.
- Ограничьте доступ по сети (например, VPN) или используйте реверс-прокси с авторизацией.

На этом интеграция готова: Cursor Mobile сможет подтягивать контекст и запускать автоматизацию в n8n прямо из чат-диалога.
