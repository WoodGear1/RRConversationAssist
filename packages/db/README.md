# Database Package

Пакет для работы с базой данных PostgreSQL + pgvector.

## Миграции

### Применение миграций

```bash
cd packages/db
npm run migrate:up
```

### Откат миграций

```bash
npm run migrate:down
```

### Создание новой миграции

```bash
npm run migrate:create migration_name
```

## Структура миграций

- **001_enable_pgvector.ts** - Включение расширения pgvector
- **002_users_workspaces_guilds.ts** - Пользователи, workspace, гильдии, каналы
- **003_recordings_audio.ts** - Записи, участники, интервалы, аудио-треки
- **004_transcripts_search_summaries_extended.ts** - Транскрипты, поиск, саммари, VAD, главы, события, redaction, проекты, теги, шары, интеграции

## Переменные окружения

Требуется `DATABASE_URL` для подключения к PostgreSQL.

Пример:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rrconversationassist
```
