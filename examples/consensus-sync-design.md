# Consensus Sync Architecture Design

## Overview
This document outlines the proposed architecture for implementing consensus sync between VK and Telegram platforms for the Correlation Center bot.

## Current Architecture Analysis

### Existing Components
- **Telegram Bot**: Uses Telegraf library for Telegram API
- **Storage**: JSON-based storage using LowDB
- **Channel Integration**: Posts to `@CorrelationCenter` Telegram channel
- **Data Structure**: Users with needs/resources arrays

### Current Data Model
```javascript
{
  users: {
    "userId": {
      needs: [
        {
          guid: "uuid",
          description: "text",
          createdAt: "timestamp",
          updatedAt: "timestamp",
          channelMessageId: "messageId",
          fileId: "optional",
          user: { id, username, first_name, last_name },
          requestor: "username"
        }
      ],
      resources: [/* similar structure */]
    }
  }
}
```

## Proposed Consensus Sync Architecture

### 1. Platform Abstraction Layer
```javascript
// Abstract platform interface
class PlatformAdapter {
  async postMessage(content, options) {}
  async editMessage(messageId, content, options) {}
  async deleteMessage(messageId) {}
  async getUserInfo(userId) {}
  async getChannelHistory(channelId, options) {}
}

class TelegramAdapter extends PlatformAdapter {
  // Current implementation
}

class VKAdapter extends PlatformAdapter {
  // VK API implementation using vk-io
}
```

### 2. Enhanced Data Model
```javascript
{
  users: {
    "userId": {
      platforms: {
        telegram: { id, username, first_name, last_name },
        vk: { id, username, first_name, last_name }
      },
      needs: [
        {
          guid: "uuid", // Cross-platform identifier
          description: "text",
          createdAt: "timestamp",
          updatedAt: "timestamp",
          platforms: {
            telegram: {
              channelMessageId: "messageId",
              userId: "telegramUserId"
            },
            vk: {
              channelMessageId: "messageId", 
              userId: "vkUserId"
            }
          },
          fileId: "optional",
          originPlatform: "telegram|vk",
          syncStatus: "synced|pending|failed"
        }
      ],
      resources: [/* similar structure */]
    }
  },
  consensus: {
    lastSync: "timestamp",
    conflicts: [
      {
        guid: "conflictId",
        type: "duplicate|conflict",
        platforms: ["telegram", "vk"],
        resolution: "pending|resolved",
        data: {}
      }
    ]
  }
}
```

### 3. Consensus Sync Service
```javascript
class ConsensusSyncService {
  constructor(adapters, storage) {
    this.adapters = adapters; // { telegram: TelegramAdapter, vk: VKAdapter }
    this.storage = storage;
  }

  async syncPlatforms() {
    // 1. Fetch recent changes from each platform
    // 2. Identify conflicts and duplicates
    // 3. Apply consensus rules
    // 4. Sync changes across platforms
    // 5. Update storage with sync status
  }

  async handleConflict(conflict) {
    // Conflict resolution logic:
    // - Timestamp-based resolution
    // - User preference
    // - Platform priority
  }

  async crossPostContent(content, excludePlatform) {
    // Post content to all platforms except the origin
  }
}
```

### 4. Configuration Options
```javascript
// Environment variables to add:
VK_API_TOKEN=your-vk-api-token
VK_GROUP_ID=your-vk-group-id
SYNC_ENABLED=true
SYNC_INTERVAL_MS=300000  // 5 minutes
CONFLICT_RESOLUTION=timestamp|manual|platform_priority
BIDIRECTIONAL_SYNC=true
```

## Implementation Phases

### Phase 1: VK Integration
- Add VK API adapter
- Implement basic VK bot functionality
- Mirror current Telegram features for VK

### Phase 2: Basic Sync
- Implement cross-platform posting
- Add platform tracking to data model
- Basic conflict detection

### Phase 3: Advanced Consensus
- Sophisticated conflict resolution
- Historical sync capability
- Real-time sync monitoring

### Phase 4: Public Channel Merging
- Unified channel management
- Cross-platform user identity mapping
- Advanced analytics and reporting

## Technical Considerations

### Challenges
1. **User Identity Mapping**: Users may have different IDs on different platforms
2. **Content Format Differences**: VK and Telegram have different formatting/features
3. **Rate Limiting**: Each platform has different API rate limits
4. **Conflict Resolution**: Handling simultaneous posts/edits
5. **Data Consistency**: Ensuring atomic operations across platforms

### Solutions
1. **Unified User Profiles**: Link accounts through verification process
2. **Content Adaptation**: Platform-specific formatting adapters
3. **Queue Management**: Implement request queuing with platform-specific limits
4. **CRDT-like Approach**: Use conflict-free replicated data types concepts
5. **Transaction Log**: Maintain operation history for rollback capability

## Future Enhancements
- Support for additional platforms (Discord, Matrix, etc.)
- Machine learning for automated conflict resolution
- Advanced analytics across platforms
- Federated identity management