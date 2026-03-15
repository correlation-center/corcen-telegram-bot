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

## Public Log Architecture

This bot implements a transparent, auditable database using **LiNo (Links Notation)** format for public logging. All database changes are recorded to a public Telegram channel as link substitution operations, creating an immutable history that can be used to reconstruct the current state.

### Architecture Overview

1. **Public Log** (Telegram Channel) - Backbone of all operations, stores all changes as link substitution operations in LiNo format
2. **Local Links Notation** - Text-based local mirror of transactions in links notation format
3. **link-cli** - Local database instance for fast indexed access (computable from the log)

### How It Works

1. User makes a change (create/update/delete a need or resource)
2. Change is first written to the **Public Log** channel as a link substitution operation
3. Once confirmed in the public log, the change is mirrored to local storage
4. Only after confirmation are public-facing operations performed (e.g., publishing to the channel)

### Link Substitution Operations

Changes use the link-cli single substitution format:

- **Creation**: `(() (...))` - replace nothing with a new link
- **Update**: `((...) (...))` - replace old link with new link
- **Deletion**: `((...) ())` - replace link with nothing

### LiNo Format Example

```
(transaction
  0199d636-512d-755d-bb81-b4f6f02f9aac
  2025-10-12T02:18:28.014Z
  (()
    (need
      0199d636-5136-73bd-9a95-51f3c702d6ce
      123456
      "Looking for a bicycle in good condition"
      42
      2025-10-12T02:18:28.022Z)))
```

## Setup

### 1. Install prerequisites

Install `curl` and `unzip` (required to install Bun):

```bash
apt install curl unzip
```

Install [Bun](https://bun.sh):

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, reload your shell or follow the instructions printed by the installer to add Bun to your PATH.

### 2. Clone the repository and install dependencies

```bash
git clone https://github.com/correlation-center/corcen-telegram-bot.git
cd corcen-telegram-bot
bun install
```

### 3. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your Telegram bot token (required) and optional settings:

```
BOT_TOKEN=your-telegram-bot-token
PUBLIC_LOG_CHANNEL=@YourPublicLogChannel  # Optional: Telegram channel for public logging (leave empty to disable)
PUBLIC_LOG_TRACING=true                    # Optional: enable detailed logging traces
ENABLE_REPOSTS=true                        # Optional: enable repost mode to forward user message and post metadata separately
```

### 4. Start the bot

```bash
bun run start
```

Start with log (tee):

```bash
bun run start 2>&1 | tee log.txt
```
