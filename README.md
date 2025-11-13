[![Open in Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-f29718?logo=gitpod)](https://gitpod.io/#https://github.com/correlation-center/corcen-telegram-bot)
[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=correlation-center/corcen-telegram-bot)

# correlation-center

[t.me/CorrelationCenterBot](https://t.me/CorrelationCenterBot) Telegram bot.

The Correlation Center is a system inspired by Jacque Fresco ideas. It ensures that all needs are satisfied using available resources. In short, it's a system to manage needs and resources.

## Public Log Architecture

This bot implements a transparent, auditable database using **LiNo (Links Notation)** format for public logging. All database changes are recorded to a public Telegram channel, creating an immutable history that can be used to reconstruct the current state.

### Key Features

- **Public Transparency**: All database changes are logged to a public Telegram channel in LiNo format
- **UUIDv7 Transaction IDs**: Each change has a unique, time-sortable identifier
- **Asynchronous Transactions**: Changes are saved locally first, then logged publicly
- **Change Detection**: Automatic tracking of creates, updates, and deletes
- **Batch Operations**: Multiple changes can be logged in a single transaction
- **Local Cache**: Fast local database (lowdb) synchronized with public log

### Architecture Overview

1. **Public Log** (Telegram Channel): Stores all changes in LiNo format - the source of truth
2. **Local Database** (lowdb): Fast cache of current state, derived from public log
3. **link-cli**: Tool to calculate current state from public log history (future integration)

### LiNo Format Example

```
Transaction: 0199d636-512d-755d-bb81-b4f6f02f9aac
2025-10-12T02:18:28.014Z

(change:
  operation: create
  entity: need
  userId: 123456
  data:
    guid: "0199d636-5136-73bd-9a95-51f3c702d6ce"
    description: "Looking for a bicycle in good condition"
    channelMessageId: 42
    createdAt: "2025-10-12T02:18:28.022Z"
)
```

## Setup

Create a `.env` file with your Telegram bot token:

```
BOT_TOKEN=your-telegram-bot-token
PUBLIC_LOG_CHANNEL=@YourPublicLogChannel  # Optional: Telegram channel for public logging (leave empty to disable)
PUBLIC_LOG_TRACING=true                    # Optional: enable detailed logging traces
ENABLE_REPOSTS=true                        # Optional: enable repost mode to forward user message and post metadata separately
```

Install dependencies with Bun:

```bash
bun install
```

Start the bot with Bun:

```bash
bun run start
```

Start with log (tee):

```bash
bun run start 2>&1 | tee log.txt
```