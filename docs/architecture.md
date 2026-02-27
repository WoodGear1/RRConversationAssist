# Архитектура RRConversationAssist

## Обзор системы

RRConversationAssist - это распределенная система для записи, обработки и анализа голосовых разговоров в Discord.

## Компоненты

### 1. Web Application (Next.js)

**Технологии:**
- Next.js 14+ (App Router)
- NextAuth.js для аутентификации
- Tailwind CSS + shadcn/ui для UI
- PostgreSQL для данных
- Redis для кеширования

**Основные функции:**
- Аутентификация (Discord OAuth, Credentials)
- Управление workspace и гильдиями
- Просмотр и управление записями
- Поиск по записям (семантический + полнотекстовый)
- RAG чат с записями
- Управление шаблонами саммари
- Экспорт записей

### 2. Discord Bot

**Технологии:**
- Discord.js
- @discordjs/voice для записи
- PostgreSQL для метаданных
- MinIO/S3 для хранения аудио
- BullMQ для очередей

**Основные функции:**
- Подключение к голосовым каналам
- Запись аудио по участникам
- Отслеживание интервалов участия
- Отправка consent сообщений
- HTTP API для управления записью

### 3. Worker Service

**Технологии:**
- BullMQ для обработки очередей
- OpenAI API (Whisper, GPT-4o-mini, embeddings)
- PostgreSQL для результатов
- MinIO/S3 для аудио

**Очереди обработки:**
1. **VAD** - Voice Activity Detection (пока placeholder)
2. **Transcription** - Транскрипция через OpenAI Whisper
3. **Indexing** - Создание chunks и embeddings для поиска
4. **Summarization** - Генерация саммари по шаблонам
5. **Chapters** - Генерация глав из транскрипта
6. **Export** - Экспорт в различные форматы
7. **Webhook** - Отправка webhooks при готовности
8. **WEEEK** - Интеграция с WEEEK для создания задач

### 4. База данных (PostgreSQL)

**Расширения:**
- `pgvector` - Векторный поиск
- `tsvector` - Полнотекстовый поиск

**Основные таблицы:**
- `users`, `user_discord_links` - Пользователи
- `workspaces`, `workspace_members`, `workspace_guilds` - Workspace
- `guilds`, `guild_settings`, `voice_channels` - Discord гильдии
- `recordings`, `recording_participants`, `participant_intervals` - Записи
- `audio_tracks` - Аудио файлы
- `transcripts`, `transcript_segments` - Транскрипты
- `search_chunks` - Chunks для поиска (с embeddings и tsvector)
- `summary_runs`, `summary_templates` - Саммари
- `chapters` - Главы записей
- `recording_events` - События записей
- `redactions` - Цензура
- `projects`, `tags`, `recording_tags`, `recording_project` - Организация
- `shares` - Шаринг записей
- `integrations`, `integration_mappings` - Интеграции

### 5. Хранилище (MinIO/S3)

Хранит аудиофайлы в формате:
- `recordings/{recordingId}/user/{discordUserId}.opus` - Индивидуальные треки
- `recordings/{recordingId}/upload/{filename}` - Загруженные файлы

### 6. Очереди (Redis + BullMQ)

Обработка задач асинхронно через очереди:
- `vad` - VAD обработка
- `transcription` - Транскрипция
- `indexing` - Индексация
- `summarization` - Саммари
- `chapters` - Главы
- `export` - Экспорт
- `webhook` - Webhooks
- `weeek` - WEEEK интеграция

## Поток данных

### Запись через Discord бота

1. Пользователь инициирует запись через web UI
2. Web отправляет запрос боту через HTTP API
3. Бот подключается к голосовому каналу
4. Бот подписывается на аудио потоки участников
5. Аудио сохраняется в буферы
6. При отключении участника, аудио загружается в MinIO
7. Бот обновляет `participant_intervals` в БД
8. При остановке записи, бот обновляет статус на `audio_ready`
9. Бот добавляет задачу VAD в очередь
10. Worker обрабатывает VAD → Transcription → Indexing → Summarization
11. Статус записи обновляется через state machine
12. При готовности (`ready`), отправляются webhooks

### Загрузка записи

1. Пользователь загружает файл через web UI
2. Файл валидируется (тип, размер)
3. Файл загружается в MinIO
4. Создается запись в БД со статусом `uploaded`
5. Статус обновляется на `audio_ready`
6. Запускается тот же pipeline обработки

### Поиск

1. Пользователь вводит запрос
2. Запрос отправляется в OpenAI для получения embedding
3. Выполняется гибридный поиск:
   - Семантический (pgvector cosine similarity)
   - Полнотекстовый (tsvector)
4. Результаты комбинируются через RRF (Reciprocal Rank Fusion)
5. Результаты фильтруются по ACL (allowed_ranges)
6. Возвращаются результаты с ссылками на записи

### ACL (Access Control List)

Контроль доступа основан на `participant_intervals`:
- Пользователь видит только те части записей, где он участвовал
- Администраторы видят все записи полностью
- Для upload записей доступ настраивается отдельно
- ACL применяется к:
  - Транскриптам
  - Медиа (pre-signed URLs)
  - Саммари (evidence timestamps)
  - Поиску

## State Machine записей

Статусы записи:
- `created` → `recording` / `uploaded` → `audio_ready` → `vad_done` → `transcribing` → `transcript_ready` → `indexing_ready` → `indexed` → `summaries_ready` → `ready`
- Любой статус может перейти в `failed` при ошибке

Переходы валидируются через централизованную функцию `updateRecordingStatus`.

## Безопасность

- Аутентификация через NextAuth.js
- ACL на основе участия в разговоре
- Pre-signed URLs для медиа с TTL
- Валидация всех входных данных
- Rate limiting (планируется)
- HTTPS в production

## Масштабирование

- Worker может масштабироваться горизонтально (несколько инстансов)
- Redis и PostgreSQL поддерживают репликацию
- MinIO поддерживает распределенное хранение
- Web приложение может масштабироваться через load balancer
