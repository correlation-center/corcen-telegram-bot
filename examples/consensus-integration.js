// Integration example for consensus sync with existing bot

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import Storage from '../storage.js';
import { TelegramAdapter, VKAdapter } from './platform-adapter.js';
import { ConsensusSyncService } from './consensus-sync.js';
import { randomUUID } from 'crypto';
const uuidv7 = randomUUID;

/**
 * Enhanced storage class with consensus sync support
 */
class ConsensusSyncStorage extends Storage {
  constructor() {
    super();
  }

  async initDB() {
    await super.initDB();
    
    // Initialize consensus data structure
    if (!this.db.data.consensus) {
      this.db.data.consensus = {
        lastSync: null,
        conflicts: [],
        platformStates: {},
        settings: {
          enabledPlatforms: ['telegram'],
          syncInterval: 300000,
          conflictResolution: 'timestamp'
        }
      };
      await this.db.write();
    }
  }

  async getUserData(userId) {
    const userData = await super.getUserData(userId);
    
    // Ensure platform tracking exists for user items
    ['needs', 'resources'].forEach(itemType => {
      userData[itemType].forEach(item => {
        if (!item.platforms) {
          item.platforms = {};
        }
        if (!item.originPlatform) {
          item.originPlatform = 'telegram';
        }
        if (!item.syncStatus) {
          item.syncStatus = 'pending';
        }
      });
    });
    
    return userData;
  }
}

/**
 * Consensus-enabled bot wrapper
 */
class ConsensusBot {
  constructor(options = {}) {
    this.options = {
      enableVK: process.env.VK_ENABLED === 'true',
      enableSync: process.env.CONSENSUS_SYNC_ENABLED === 'true',
      syncInterval: parseInt(process.env.SYNC_INTERVAL_MS) || 300000,
      ...options
    };
    
    // Initialize storage
    this.storage = new ConsensusSyncStorage();
    
    // Initialize Telegram bot
    this.telegramBot = new Telegraf(process.env.BOT_TOKEN);
    
    // Platform adapters
    this.adapters = {};
    
    // Consensus sync service
    this.syncService = null;
  }

  async initialize() {
    console.log('Initializing Consensus Bot...');
    
    // Initialize storage
    await this.storage.initDB();
    
    // Initialize Telegram adapter
    this.adapters.telegram = new TelegramAdapter(
      this.telegramBot,
      process.env.CHANNEL_USERNAME || '@CorrelationCenter'
    );
    
    // Initialize VK adapter if enabled
    if (this.options.enableVK && process.env.VK_API_TOKEN) {
      try {
        this.adapters.vk = new VKAdapter({
          token: process.env.VK_API_TOKEN,
          groupId: process.env.VK_GROUP_ID,
          postAsGroup: true
        });
        
        const vkInitialized = await this.adapters.vk.initialize();
        if (!vkInitialized) {
          console.warn('VK adapter initialization failed, disabling VK support');
          delete this.adapters.vk;
        } else {
          console.log('VK adapter initialized successfully');
        }
      } catch (error) {
        console.error('Failed to initialize VK adapter:', error);
      }
    }
    
    // Initialize consensus sync service if enabled
    if (this.options.enableSync && Object.keys(this.adapters).length > 1) {
      const enabledPlatforms = Object.keys(this.adapters);
      
      this.syncService = new ConsensusSyncService(
        this.adapters,
        this.storage,
        {
          enabledPlatforms,
          syncIntervalMs: this.options.syncInterval,
          conflictResolution: process.env.CONFLICT_RESOLUTION || 'timestamp',
          showOriginPlatform: true
        }
      );
      
      console.log(`Consensus sync initialized for platforms: ${enabledPlatforms.join(', ')}`);
    }
    
    console.log('Consensus Bot initialization complete');
  }

  async start() {
    await this.initialize();
    
    // Start consensus sync service
    if (this.syncService) {
      await this.syncService.start();
    }
    
    // Start Telegram bot (VK would need separate polling/webhook setup)
    if (process.env.NODE_ENV !== 'test') {
      await this.telegramBot.launch();
      console.log('Consensus Bot started');
    }
  }

  async stop() {
    if (this.syncService) {
      this.syncService.stop();
    }
    
    if (this.telegramBot) {
      this.telegramBot.stop();
    }
    
    console.log('Consensus Bot stopped');
  }

  /**
   * Enhanced addItem with cross-platform posting
   */
  async addItem(ctx, type, content, options = {}) {
    const user = await this.storage.getUserData(ctx.from.id);
    const fieldKey = `${type}s`;
    
    // Create item with consensus tracking
    const timestamp = new Date().toISOString();
    const item = {
      user: {
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name
      },
      [type === 'need' ? 'requestor' : 'supplier']: ctx.from.username || ctx.from.first_name || 'unknown',
      guid: uuidv7(),
      description: content,
      createdAt: timestamp,
      updatedAt: timestamp,
      platforms: {},
      originPlatform: 'telegram',
      syncStatus: 'pending'
    };
    
    if (options.fileId) {
      item.fileId = options.fileId;
    }
    
    // Post to Telegram first (original platform)
    try {
      const telegramAdapter = this.adapters.telegram;
      const telegramContent = this.buildItemContent(item, type, telegramAdapter);
      
      const postResult = await telegramAdapter.postMessage(telegramContent, {
        fileId: item.fileId
      });
      
      if (postResult.success) {
        item.channelMessageId = postResult.messageId;
        item.platforms.telegram = {
          channelMessageId: postResult.messageId,
          syncedAt: timestamp
        };
      }
    } catch (error) {
      console.error('Failed to post to Telegram:', error);
      item.channelMessageId = null;
    }
    
    // Cross-post to other platforms if sync is enabled
    if (this.syncService && item.channelMessageId) {
      try {
        const crossPostResult = await this.syncService.crossPostContent(
          content,
          type,
          item.user,
          {
            fileId: item.fileId,
            excludePlatform: 'telegram',
            originMessageId: item.channelMessageId
          }
        );
        
        // Update item with cross-post results
        Object.assign(item.platforms, crossPostResult.item.platforms);
        item.syncStatus = crossPostResult.item.syncStatus;
      } catch (error) {
        console.error('Cross-post failed:', error);
      }
    }
    
    // Save to database
    user[fieldKey].push(item);
    await this.storage.writeDB();
    
    return item;
  }

  /**
   * Build item content for specific platform
   */
  buildItemContent(item, type, adapter) {
    const mention = adapter.buildUserMention(item.user);
    let content = item.description;
    
    if (type === 'need') {
      content += `\n\n<i>Need of ${mention}.</i>`;
    } else {
      content += `\n\n<i>Resource provided by ${mention}.</i>`;
    }
    
    return content;
  }

  /**
   * Get sync status for admin interface
   */
  getSyncStatus() {
    if (!this.syncService) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      ...this.syncService.getSyncStats(),
      platforms: Object.keys(this.adapters),
      conflicts: this.storage.db.data.consensus?.conflicts?.length || 0
    };
  }

  /**
   * Manually trigger sync
   */
  async triggerSync() {
    if (this.syncService) {
      return await this.syncService.syncPlatforms();
    }
    throw new Error('Sync service not available');
  }
}

/**
 * Command line interface for sync operations
 */
async function runSync() {
  const bot = new ConsensusBot();
  
  try {
    await bot.initialize();
    console.log('Running manual sync...');
    await bot.triggerSync();
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

/**
 * Example environment variables for .env
 */
const exampleEnvVars = `
# VK Integration
VK_ENABLED=true
VK_API_TOKEN=your-vk-api-token
VK_GROUP_ID=your-vk-group-id

# Consensus Sync
CONSENSUS_SYNC_ENABLED=true
SYNC_INTERVAL_MS=300000
CONFLICT_RESOLUTION=timestamp
CHANNEL_USERNAME=@CorrelationCenter
`;

export { 
  ConsensusBot, 
  ConsensusSyncStorage, 
  runSync, 
  exampleEnvVars 
};

// CLI usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const command = process.argv[2];
  
  switch (command) {
    case 'sync':
      runSync();
      break;
    case 'env':
      console.log('Example environment variables:');
      console.log(exampleEnvVars);
      break;
    default:
      console.log('Usage: node consensus-integration.js [sync|env]');
      break;
  }
}