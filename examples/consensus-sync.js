// Consensus sync service for cross-platform synchronization

// Use crypto.randomUUID for testing instead of uuid package
import { randomUUID } from 'crypto';
const uuidv7 = randomUUID;

/**
 * Consensus sync service that manages data synchronization across platforms
 */
class ConsensusSyncService {
  constructor(adapters, storage, options = {}) {
    this.adapters = adapters; // { telegram: TelegramAdapter, vk: VKAdapter, ... }
    this.storage = storage;
    this.options = {
      syncIntervalMs: options.syncIntervalMs || 300000, // 5 minutes
      conflictResolution: options.conflictResolution || 'timestamp', // timestamp|manual|platform_priority
      bidirectionalSync: options.bidirectionalSync !== false,
      enabledPlatforms: options.enabledPlatforms || ['telegram'],
      ...options
    };
    
    this.syncInProgress = false;
    this.lastSyncTime = null;
  }

  /**
   * Start the consensus sync service
   */
  async start() {
    console.log('Starting consensus sync service...');
    
    // Initial sync
    await this.syncPlatforms();
    
    // Schedule periodic sync
    if (this.options.syncIntervalMs > 0) {
      this.syncInterval = setInterval(() => {
        this.syncPlatforms().catch(console.error);
      }, this.options.syncIntervalMs);
    }
    
    console.log(`Consensus sync service started with ${this.options.enabledPlatforms.length} platforms`);
  }

  /**
   * Stop the consensus sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('Consensus sync service stopped');
  }

  /**
   * Perform full synchronization across all platforms
   */
  async syncPlatforms() {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    const startTime = new Date();
    
    try {
      console.log('Starting platform synchronization...');
      
      // Load current data
      await this.storage.readDB();
      
      // Initialize consensus data if not exists
      if (!this.storage.db.data.consensus) {
        this.storage.db.data.consensus = {
          lastSync: null,
          conflicts: [],
          platformStates: {}
        };
      }
      
      const stats = {
        processed: 0,
        synced: 0,
        conflicts: 0,
        errors: 0
      };

      // Process all users and their items
      const users = this.storage.db.data.users || {};
      for (const [userId, userData] of Object.entries(users)) {
        await this.syncUserData(userId, userData, stats);
      }

      // Update sync metadata
      this.storage.db.data.consensus.lastSync = startTime.toISOString();
      this.lastSyncTime = startTime;
      
      // Save changes
      await this.storage.writeDB();
      
      const duration = Date.now() - startTime.getTime();
      console.log(`Sync completed in ${duration}ms:`, stats);
      
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync data for a specific user
   */
  async syncUserData(userId, userData, stats) {
    const itemTypes = ['needs', 'resources'];
    
    for (const itemType of itemTypes) {
      const items = userData[itemType] || [];
      
      for (const item of items) {
        stats.processed++;
        
        try {
          const syncResult = await this.syncItem(item, itemType, userId);
          
          if (syncResult.synced) {
            stats.synced++;
          }
          if (syncResult.conflict) {
            stats.conflicts++;
          }
        } catch (error) {
          console.error(`Error syncing item ${item.guid}:`, error);
          stats.errors++;
        }
      }
    }
  }

  /**
   * Sync a single item across platforms
   */
  async syncItem(item, itemType, userId) {
    // Initialize platforms tracking if not exists
    if (!item.platforms) {
      item.platforms = {};
      item.originPlatform = item.originPlatform || 'telegram'; // Default to telegram
      item.syncStatus = 'pending';
    }

    const result = { synced: false, conflict: false };
    const activePlatforms = this.options.enabledPlatforms;
    
    // Check if item needs to be synced to other platforms
    for (const platformName of activePlatforms) {
      if (platformName === item.originPlatform) {
        continue; // Skip origin platform
      }
      
      const adapter = this.adapters[platformName];
      if (!adapter) {
        console.warn(`No adapter found for platform: ${platformName}`);
        continue;
      }
      
      // Check if already synced to this platform
      if (item.platforms[platformName]?.channelMessageId) {
        continue; // Already synced
      }
      
      // Sync to this platform
      const syncSuccess = await this.syncItemToPlatform(item, itemType, adapter, platformName);
      if (syncSuccess) {
        result.synced = true;
      }
    }
    
    return result;
  }

  /**
   * Sync an item to a specific platform
   */
  async syncItemToPlatform(item, itemType, adapter, platformName) {
    try {
      // Build platform-specific content
      const content = this.buildPlatformContent(item, itemType, adapter);
      
      // Post to platform
      const postResult = await adapter.postMessage(content, {
        fileId: item.fileId
      });
      
      if (postResult.success) {
        // Update item with platform info
        item.platforms[platformName] = {
          channelMessageId: postResult.messageId,
          syncedAt: new Date().toISOString()
        };
        
        item.syncStatus = 'synced';
        console.log(`Synced item ${item.guid} to ${platformName}: ${postResult.messageId}`);
        return true;
      } else {
        console.error(`Failed to sync item ${item.guid} to ${platformName}:`, postResult.error);
        return false;
      }
    } catch (error) {
      console.error(`Error syncing item ${item.guid} to ${platformName}:`, error);
      return false;
    }
  }

  /**
   * Build platform-specific content for an item
   */
  buildPlatformContent(item, itemType, adapter) {
    const user = item.user;
    const mention = adapter.buildUserMention(user);
    
    let content = item.description;
    
    // Add platform-specific footer
    if (itemType === 'need') {
      content += `\n\n<i>Need of ${mention}.</i>`;
    } else {
      content += `\n\n<i>Resource provided by ${mention}.</i>`;
    }
    
    // Add cross-platform indicator if configured
    if (this.options.showOriginPlatform && item.originPlatform !== adapter.platformName) {
      content += `\n<i>Originally posted on ${item.originPlatform}</i>`;
    }
    
    return content;
  }

  /**
   * Cross-post new content to all enabled platforms
   */
  async crossPostContent(content, itemType, user, options = {}) {
    const guid = uuidv7();
    const timestamp = new Date().toISOString();
    const excludePlatform = options.excludePlatform;
    
    const item = {
      guid,
      description: content,
      createdAt: timestamp,
      updatedAt: timestamp,
      user: user,
      platforms: {},
      originPlatform: excludePlatform || 'telegram',
      syncStatus: 'pending'
    };
    
    if (options.fileId) {
      item.fileId = options.fileId;
    }
    
    const results = {};
    const activePlatforms = this.options.enabledPlatforms;
    
    // Post to all platforms except excluded one
    for (const platformName of activePlatforms) {
      if (platformName === excludePlatform) {
        // For origin platform, just record the existing message ID
        if (options.originMessageId) {
          item.platforms[platformName] = {
            channelMessageId: options.originMessageId,
            syncedAt: timestamp
          };
        }
        continue;
      }
      
      const adapter = this.adapters[platformName];
      if (!adapter) {
        console.warn(`No adapter found for platform: ${platformName}`);
        continue;
      }
      
      const platformContent = this.buildPlatformContent(item, itemType, adapter);
      const postResult = await adapter.postMessage(platformContent, {
        fileId: item.fileId
      });
      
      results[platformName] = postResult;
      
      if (postResult.success) {
        item.platforms[platformName] = {
          channelMessageId: postResult.messageId,
          syncedAt: timestamp
        };
      }
    }
    
    // Update sync status
    const successfulPlatforms = Object.values(results).filter(r => r.success).length;
    const totalTargetPlatforms = activePlatforms.length - (excludePlatform ? 1 : 0);
    
    if (successfulPlatforms === totalTargetPlatforms) {
      item.syncStatus = 'synced';
    } else if (successfulPlatforms > 0) {
      item.syncStatus = 'partial';
    } else {
      item.syncStatus = 'failed';
    }
    
    return {
      item,
      results,
      success: successfulPlatforms > 0
    };
  }

  /**
   * Handle conflicts between platforms
   */
  async handleConflict(conflict) {
    switch (this.options.conflictResolution) {
      case 'timestamp':
        return this.resolveByTimestamp(conflict);
      case 'platform_priority':
        return this.resolveByPlatformPriority(conflict);
      case 'manual':
        return this.recordForManualResolution(conflict);
      default:
        return this.resolveByTimestamp(conflict);
    }
  }

  /**
   * Resolve conflict by newest timestamp
   */
  resolveByTimestamp(conflict) {
    // Find the item with the latest update
    const sortedItems = conflict.items.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return sortedItems[0];
  }

  /**
   * Resolve conflict by platform priority
   */
  resolveByPlatformPriority(conflict) {
    const platformPriority = this.options.platformPriority || ['telegram', 'vk'];
    
    for (const platform of platformPriority) {
      const item = conflict.items.find(item => item.originPlatform === platform);
      if (item) {
        return item;
      }
    }
    
    // Fallback to timestamp
    return this.resolveByTimestamp(conflict);
  }

  /**
   * Record conflict for manual resolution
   */
  recordForManualResolution(conflict) {
    this.storage.db.data.consensus.conflicts.push({
      id: uuidv7(),
      type: conflict.type,
      createdAt: new Date().toISOString(),
      status: 'pending',
      data: conflict
    });
    
    return null; // No automatic resolution
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      lastSync: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      enabledPlatforms: this.options.enabledPlatforms,
      conflicts: this.storage.db.data.consensus?.conflicts?.length || 0
    };
  }
}

export { ConsensusSyncService };