[![Open in Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-f29718?logo=gitpod)](https://gitpod.io/#https://github.com/correlation-center/corcen-telegram-bot)
[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=correlation-center/corcen-telegram-bot)

# correlation-center

[t.me/CorrelationCenterBot](https://t.me/CorrelationCenterBot) Telegram bot.

The Correlation Center is a system inspired by Jacque Fresco ideas. It ensures that all needs are satisfied using available resources. In short, it's a system to manage needs and resources.
## Setup

Create a `.env` file with your Telegram bot token:

```
BOT_TOKEN=your-telegram-bot-token
ENABLE_REPOSTS=true  # Optional: enable repost mode to forward user message and post metadata separately
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