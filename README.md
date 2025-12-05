[![Open in Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-f29718?logo=gitpod)](https://gitpod.io/#https://github.com/correlation-center/corcen-telegram-bot)
[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=correlation-center/corcen-telegram-bot)

# correlation-center

[t.me/CorrelationCenterBot](https://t.me/CorrelationCenterBot) Telegram bot.

## Philosophy

**Everything is a need. A need to give. A need to get.**

The Correlation Center is a system inspired by Jacque Fresco's resource-based economy ideas. It ensures that all needs are satisfied using available resources.

Our philosophy is inspired by the communist principle:
> "From each according to his ability, to each according to his needs."

But in a world where everything is recognized as a need, this transforms into:
> **"For each according to his needs."**
> _Russian: Каждому по потребностям._

When you have something to offer, you have a **need to give**. When you need something, you have a **need to get**. This unified perspective helps us see that both giving and receiving are fundamental human needs.

### Alternative Perspective: Everything is a Resource

The same philosophy can be expressed from the resource perspective:

- A **need to get** is a **resource request**
- A **need to give** is a **resource offer**

Both perspectives describe the same reality: a system that connects what people want to share with what people want to receive.

## Usage

Start a conversation with [@CorrelationCenterBot](https://t.me/CorrelationCenterBot) and use these commands:

- `/get` - Add a need (something you need to get)
- `/give` - Add a resource (something you need to give)
- `/needs` - List your needs
- `/resources` - List your resources
- `/help` - Show help message
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