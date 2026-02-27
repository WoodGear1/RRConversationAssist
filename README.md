# RRConversationAssist

Веб-приложение для записи, обработки и анализа голосовых разговоров в Discord.

## Возможности

- 🎙️ Запись голосовых каналов Discord
- 📝 Автоматическая транскрипция с помощью OpenAI Whisper
- 🔍 Семантический и полнотекстовый поиск по записям
- 📊 Генерация саммари с помощью LLM
- 🎯 Контроль доступа на основе участия в разговоре (ACL)
- 🔗 Интеграции с внешними сервисами (webhooks, WEEEK)
- 📤 Экспорт записей в различных форматах
- 🔐 Безопасное хранение и управление доступом

## Архитектура

Приложение построено на монorepo структуре:

```
├── apps/
│   ├── web/          # Next.js веб-приложение
│   ├── bot/          # Discord бот для записи
│   └── worker/        # Обработчики очередей (VAD, транскрипция, индексация)
├── packages/
│   ├── db/           # База данных и миграции
│   ├── jobs/         # Определения задач для очередей
│   └── logger/       # Структурированное логирование
```

### Компоненты

- **Web App (Next.js)**: Пользовательский интерфейс, API endpoints, аутентификация
- **Discord Bot**: Подключение к голосовым каналам, запись аудио, отправка уведомлений
- **Worker**: Асинхронная обработка аудио (VAD, транскрипция, индексация, саммари)
- **PostgreSQL + pgvector**: Хранение данных и векторный поиск
- **Redis + BullMQ**: Очереди задач
- **MinIO**: Хранение аудиофайлов

## Быстрый старт

### Требования

- Docker и Docker Compose
- Node.js 20+
- Discord Bot Token
- OpenAI API Key

### 1. Клонирование репозитория

```bash
git clone https://github.com/WoodGear1/RRConversationAssist.git
cd RRConversationAssist
```

### 2. Настройка Discord приложения

1. Перейдите на [Discord Developer Portal](https://discord.com/developers/applications)
2. Создайте новое приложение
3. Перейдите в раздел "Bot" и создайте бота
4. Скопируйте Bot Token
5. Включите следующие привилегии (Privileged Gateway Intents):
   - MESSAGE CONTENT INTENT (если нужно)
6. В разделе "OAuth2" → "URL Generator":
   - Выберите scopes: `bot`, `identify`, `email`
   - Выберите permissions: `Connect`, `Speak`, `View Channels`, `Send Messages`
   - Скопируйте Client ID и Client Secret

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните все переменные:

```bash
cp .env.example .env
```

См. раздел [Переменные окружения](#переменные-окружения) для подробностей.

### 4. Запуск с Docker Compose

```bash
docker-compose up -d
```

Это запустит все сервисы:
- PostgreSQL с pgvector (порт 5432)
- Redis (порт 6379)
- MinIO (порты 9000, 9001)
- Web приложение (порт 3000)
- Discord бот (порт 3001)
- Worker для обработки задач

### 5. Выполнение миграций базы данных

```bash
docker-compose exec web npm run migrate:up --prefix packages/db
```

Или локально:

```bash
cd packages/db
npm install
npm run migrate:up
```

### 6. Доступ к приложению

- Web UI: http://localhost:3000
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin по умолчанию)

## Переменные окружения

См. `.env.example` для полного списка переменных. Основные:

### База данных
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_USER` - Пользователь PostgreSQL
- `POSTGRES_PASSWORD` - Пароль PostgreSQL
- `POSTGRES_DB` - Имя базы данных

### Redis
- `REDIS_URL` - Redis connection string

### MinIO/S3
- `S3_ENDPOINT` - MinIO endpoint (http://minio:9000 для Docker)
- `S3_ACCESS_KEY` - MinIO access key
- `S3_SECRET_KEY` - MinIO secret key
- `S3_BUCKET` - Имя bucket для хранения аудио
- `S3_REGION` - Регион S3

### Discord
- `DISCORD_BOT_TOKEN` - Токен Discord бота
- `DISCORD_CLIENT_ID` - Client ID приложения Discord
- `DISCORD_CLIENT_SECRET` - Client Secret приложения Discord

### NextAuth
- `NEXTAUTH_URL` - URL приложения (http://localhost:3000 для разработки)
- `NEXTAUTH_SECRET` - Секретный ключ для JWT (сгенерируйте случайную строку)

### OpenAI
- `OPENAI_API_KEY` - API ключ OpenAI для транскрипции и LLM

### Другие
- `WEB_BASE_URL` - Базовый URL веб-приложения для бота
- `NODE_ENV` - Окружение (development/production)
- `LOG_LEVEL` - Уровень логирования (debug/info/warn/error)

## Разработка

### Локальная разработка без Docker

1. Установите зависимости:
```bash
npm install
```

2. Запустите PostgreSQL, Redis и MinIO (через Docker или локально)

3. Настройте переменные окружения в `.env`

4. Выполните миграции:
```bash
cd packages/db
npm run migrate:up
```

5. Запустите приложения:
```bash
# Web
cd apps/web
npm run dev

# Bot (в другом терминале)
cd apps/bot
npm run dev

# Worker (в другом терминале)
cd apps/worker
npm run dev
```

### Структура проекта

- `apps/web/` - Next.js приложение с App Router
- `apps/bot/` - Discord бот на Discord.js
- `apps/worker/` - BullMQ workers для обработки задач
- `packages/db/` - Миграции и типы базы данных
- `packages/jobs/` - Определения задач для очередей
- `packages/logger/` - Структурированное логирование

### Миграции базы данных

```bash
# Создать новую миграцию
cd packages/db
npm run migrate:create migration_name

# Применить миграции
npm run migrate:up

# Откатить последнюю миграцию
npm run migrate:down
```

## Troubleshooting

### Бот не подключается к голосовому каналу

- Проверьте, что бот имеет права `Connect` и `Speak` в канале
- Убедитесь, что `DISCORD_BOT_TOKEN` установлен правильно
- Проверьте логи бота: `docker-compose logs bot`

### Ошибки при транскрипции

- Проверьте, что `OPENAI_API_KEY` установлен и валиден
- Убедитесь, что у вас есть доступ к OpenAI API
- Проверьте логи worker: `docker-compose logs worker`

### Проблемы с базой данных

- Проверьте подключение: `docker-compose exec db psql -U postgres -d rrconversationassist`
- Убедитесь, что расширение pgvector установлено: `CREATE EXTENSION IF NOT EXISTS vector;`
- Проверьте логи: `docker-compose logs db`

### Миграции не применяются

- Убедитесь, что `DATABASE_URL` указан правильно
- Проверьте права доступа к базе данных
- Выполните миграции вручную: `cd packages/db && npm run migrate:up`

### MinIO недоступен

- Проверьте, что MinIO запущен: `docker-compose ps minio`
- Проверьте логи: `docker-compose logs minio`
- Убедитесь, что bucket создан: `docker-compose exec minio-init /bin/sh`

### Healthcheck не проходит

- Проверьте health endpoints:
  - Web: `curl http://localhost:3000/api/health`
  - Bot: `curl http://localhost:3001/health`
- Проверьте логи сервисов
- Убедитесь, что все зависимости (DB, Redis, MinIO) доступны

## API Документация

### Аутентификация

Все API endpoints (кроме `/api/auth/**`) требуют аутентификации через NextAuth.js.

### Основные endpoints

- `GET /api/v1/recordings` - Список записей
- `GET /api/v1/recordings/:id` - Детали записи
- `GET /api/v1/search?q=query` - Поиск по записям
- `POST /api/v1/recordings/upload` - Загрузка записи
- `GET /api/v1/recordings/:id/transcript` - Транскрипт записи
- `POST /api/v1/recordings/:id/summaries` - Создать саммари
- `GET /api/v1/recordings/:id/chat?q=question` - RAG чат с записью

## Лицензия

[Укажите лицензию]

## Бэкапы и восстановление

### Бэкап PostgreSQL

```bash
# Использование скрипта бэкапа
./scripts/backup-postgres.sh [output_dir]

# Или вручную
pg_dump -h localhost -U postgres -d rrconversationassist \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump
```

Скрипт создает два файла:
- `.dump` (custom format, сжатый) - для быстрого восстановления
- `.sql.gz` (SQL format, сжатый) - для просмотра и портируемости

### Восстановление PostgreSQL

```bash
# Из custom format
./scripts/restore-postgres.sh ./backups/postgres/postgres_backup_20240101_120000.dump

# Или вручную
pg_restore -h localhost -U postgres -d rrconversationassist \
  --clean --if-exists \
  backup.dump
```

**Внимание:** Восстановление перезапишет существующие данные!

### Бэкап MinIO

```bash
# Использование скрипта бэкапа
./scripts/backup-minio.sh [output_dir]

# Или вручную с MinIO Client
mc alias set myminio http://localhost:9000 minioadmin minioadmin
mc mirror myminio/recordings ./backups/minio/recordings
tar -czf minio_backup.tar.gz ./backups/minio/recordings
```

### Восстановление MinIO

```bash
# Использование скрипта восстановления
./scripts/restore-minio.sh ./backups/minio/minio_backup_20240101_120000.tar.gz

# Или вручную
tar -xzf minio_backup.tar.gz
mc mirror ./backups/minio/recordings myminio/recordings
```

### Автоматизация бэкапов

Рекомендуется настроить cron для автоматических бэкапов:

```bash
# Добавить в crontab (crontab -e)
# Бэкап PostgreSQL каждый день в 2:00
0 2 * * * /path/to/scripts/backup-postgres.sh /backups/postgres

# Бэкап MinIO каждый день в 3:00
0 3 * * * /path/to/scripts/backup-minio.sh /backups/minio
```

### Рекомендации

- Храните бэкапы в отдельном месте (не на том же сервере)
- Тестируйте восстановление регулярно
- Храните несколько версий бэкапов (например, последние 30 дней)
- Используйте шифрование для бэкапов с чувствительными данными
- Мониторьте размер бэкапов и доступное место

## Поддержка

[Контактная информация для поддержки]
