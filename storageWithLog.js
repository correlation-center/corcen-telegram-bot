import Storage from './storage.js';
import PublicLog from './publicLog.js';
import _ from 'lodash';

/**
 * StorageWithLog wraps Storage and adds public logging to all write operations.
 * This creates a transparent audit trail of all database changes in a Telegram channel.
 */
class StorageWithLog {
  constructor({ telegram, logChannel, tracing = false }) {
    this.storage = new Storage();
    this.publicLog = new PublicLog({ telegram, logChannel, tracing });
    this.tracing = tracing;
    // Track previous state to detect changes
    this.previousState = null;
  }

  async initDB() {
    await this.storage.initDB();
    // Capture initial state
    await this.captureState();
  }

  async getUserData(userId) {
    return await this.storage.getUserData(userId);
  }

  async readDB() {
    await this.storage.readDB();
    // Update our state snapshot
    await this.captureState();
  }

  /**
   * Capture current database state for change detection.
   */
  async captureState() {
    await this.storage.readDB();
    this.previousState = _.cloneDeep(this.storage.db.data);
  }

  /**
   * Write to database and log all changes to public log.
   */
  async writeDB() {
    // Detect what changed
    const changes = this.detectChanges();

    if (changes.length === 0) {
      if (this.tracing) {
        console.log('StorageWithLog: no changes detected, skipping write');
      }
      return;
    }

    if (this.tracing) {
      console.log(`StorageWithLog: detected ${changes.length} changes`);
    }

    // Log changes to public log
    try {
      if (changes.length === 1) {
        await this.publicLog.logChange(changes[0]);
      } else {
        await this.publicLog.logBatchChanges(changes);
      }
    } catch (error) {
      console.error('StorageWithLog: failed to log changes to public log', error);
      // Continue with local write even if public log fails
    }

    // Write to local database
    await this.storage.writeDB();

    // Update state snapshot after successful write
    await this.captureState();
  }

  /**
   * Detect changes between previous state and current state.
   * @returns {Array<Object>} Array of change objects
   */
  detectChanges() {
    const changes = [];
    const currentState = this.storage.db.data;

    if (!this.previousState || !this.previousState.users) {
      // Initial state, log all as creates
      if (this.tracing) {
        console.log('StorageWithLog: no previous state, treating all as new');
      }
      return changes;
    }

    const currentUsers = currentState.users || {};
    const previousUsers = this.previousState.users || {};

    // Check for new users
    for (const userId of Object.keys(currentUsers)) {
      if (!previousUsers[userId]) {
        changes.push({
          operation: 'create',
          entity: 'user',
          userId,
          data: {
            needs: currentUsers[userId].needs?.length || 0,
            resources: currentUsers[userId].resources?.length || 0
          }
        });
      }
    }

    // Check for changes in existing users
    for (const userId of Object.keys(currentUsers)) {
      if (!previousUsers[userId]) continue;

      const currentUser = currentUsers[userId];
      const previousUser = previousUsers[userId];

      // Check for new/updated/deleted needs
      this.detectItemChanges({
        userId,
        entity: 'need',
        currentItems: currentUser.needs || [],
        previousItems: previousUser.needs || [],
        changes
      });

      // Check for new/updated/deleted resources
      this.detectItemChanges({
        userId,
        entity: 'resource',
        currentItems: currentUser.resources || [],
        previousItems: previousUser.resources || [],
        changes
      });
    }

    // Check for deleted users
    for (const userId of Object.keys(previousUsers)) {
      if (!currentUsers[userId]) {
        changes.push({
          operation: 'delete',
          entity: 'user',
          userId,
          previousData: {
            needs: previousUsers[userId].needs?.length || 0,
            resources: previousUsers[userId].resources?.length || 0
          }
        });
      }
    }

    return changes;
  }

  /**
   * Detect changes in items (needs or resources) for a user.
   */
  detectItemChanges({ userId, entity, currentItems, previousItems, changes }) {
    // Build maps by guid for efficient comparison
    const currentMap = new Map(currentItems.map(item => [item.guid, item]));
    const previousMap = new Map(previousItems.map(item => [item.guid, item]));

    // Check for new items
    for (const [guid, item] of currentMap) {
      if (!previousMap.has(guid)) {
        changes.push({
          operation: 'create',
          entity,
          userId,
          data: {
            guid: item.guid,
            description: item.description,
            channelMessageId: item.channelMessageId,
            createdAt: item.createdAt
          }
        });
      }
    }

    // Check for updated items
    for (const [guid, currentItem] of currentMap) {
      const previousItem = previousMap.get(guid);
      if (!previousItem) continue;

      // Compare items (excluding updatedAt which changes frequently)
      const currentClean = _.omit(currentItem, 'updatedAt');
      const previousClean = _.omit(previousItem, 'updatedAt');

      if (!_.isEqual(currentClean, previousClean)) {
        changes.push({
          operation: 'update',
          entity,
          userId,
          data: {
            guid: currentItem.guid,
            description: currentItem.description,
            channelMessageId: currentItem.channelMessageId,
            updatedAt: currentItem.updatedAt
          },
          previousData: {
            description: previousItem.description,
            channelMessageId: previousItem.channelMessageId
          }
        });
      }
    }

    // Check for deleted items
    for (const [guid, item] of previousMap) {
      if (!currentMap.has(guid)) {
        changes.push({
          operation: 'delete',
          entity,
          userId,
          previousData: {
            guid: item.guid,
            description: item.description,
            channelMessageId: item.channelMessageId
          }
        });
      }
    }
  }

  /**
   * Direct access to underlying storage for read-only operations.
   */
  get db() {
    return this.storage.db;
  }
}

export default StorageWithLog;
