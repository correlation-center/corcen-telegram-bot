import fs from 'fs';
import Storage from './storage.js';
import PublicLog from './publicLog.js';
import _ from 'lodash';

/**
 * StorageWithLog wraps Storage and uses the public log as the backbone
 * of all operations. The flow is:
 *
 * 1. Detect changes between previous and current state
 * 2. Write changes to public log (Telegram channel) first
 * 3. Once confirmed, save transactions locally as links notation text
 * 4. Mirror changes to local database (lowdb cache)
 *
 * Local storage has two forms (both derived from the public log):
 * - transactions.lino: Text-based log of all transactions in links notation
 * - db.json: Fast cache for reads (lowdb, to be replaced by link-cli)
 */
class StorageWithLog {
  constructor({ telegram, logChannel, tracing = false, transactionLogPath = 'transactions.lino' }) {
    this.storage = new Storage();
    this.publicLog = new PublicLog({ telegram, logChannel, tracing });
    this.tracing = tracing;
    this.transactionLogPath = transactionLogPath;
    this.previousState = null;
  }

  async initDB() {
    await this.storage.initDB();
    await this.captureState();
  }

  async getUserData(userId) {
    return await this.storage.getUserData(userId);
  }

  async readDB() {
    await this.storage.readDB();
    await this.captureState();
  }

  async captureState() {
    await this.storage.readDB();
    this.previousState = _.cloneDeep(this.storage.db.data);
  }

  /**
   * Write to database with public log as backbone.
   * Changes are logged to the public channel first, then mirrored locally.
   */
  async writeDB() {
    const changes = this.detectChanges();

    if (changes.length === 0) {
      if (this.tracing) {
        console.log('StorageWithLog: no changes detected, writing local state');
      }
      await this.storage.writeDB();
      await this.captureState();
      return;
    }

    if (this.tracing) {
      console.log(`StorageWithLog: detected ${changes.length} changes, writing to public log first`);
    }

    // Step 1: Write to public log first (backbone of all operations)
    let transaction;
    try {
      if (changes.length === 1) {
        transaction = await this.publicLog.logChange(changes[0]);
      } else {
        transaction = await this.publicLog.logBatchChanges(changes);
      }
    } catch (error) {
      console.error('StorageWithLog: failed to write to public log', error);
      // Still write locally but mark as unconfirmed
      transaction = { confirmed: false, error: error.message };
    }

    // Step 2: Save transaction locally as links notation text
    if (transaction && transaction.txId) {
      this.appendTransactionLog(transaction);
    }

    // Step 3: Mirror changes to local database cache
    await this.storage.writeDB();
    await this.captureState();

    return transaction;
  }

  /**
   * Append a transaction record to the local links notation log file.
   * Uses the same indented format as the public log (Telegram) so the
   * local file and public log are consistent and human-readable.
   * @param {Object} transaction
   */
  appendTransactionLog(transaction) {
    try {
      let logEntry;
      if (transaction.change) {
        logEntry = this.publicLog.formatTransaction({
          txId: transaction.txId,
          timestamp: transaction.timestamp,
          change: transaction.change,
        });
      } else if (transaction.changes) {
        logEntry = transaction.changes.length === 1
          ? this.publicLog.formatTransaction({
              txId: transaction.txId,
              timestamp: transaction.timestamp,
              change: transaction.changes[0],
            })
          : this.publicLog.formatBatchTransaction({
              txId: transaction.txId,
              timestamp: transaction.timestamp,
              changes: transaction.changes,
            });
      } else {
        logEntry = this.publicLog.formatTransaction({
          txId: transaction.txId,
          timestamp: transaction.timestamp,
          change: { operation: 'create', entity: 'status', data: { confirmed: String(transaction.confirmed) } },
        });
      }
      fs.appendFileSync(this.transactionLogPath, logEntry + '\n');
      if (this.tracing) {
        console.log('StorageWithLog: appended transaction to local log', transaction.txId);
      }
    } catch (error) {
      console.error('StorageWithLog: failed to append to transaction log', error);
    }
  }

  /**
   * Detect changes between previous state and current state.
   * @returns {Array<Object>} Array of change objects
   */
  detectChanges() {
    const changes = [];
    const currentState = this.storage.db.data;

    if (!this.previousState || !this.previousState.users) {
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
          data: {
            userId,
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
          previousData: {
            userId,
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
    const currentMap = new Map(currentItems.map(item => [item.guid, item]));
    const previousMap = new Map(previousItems.map(item => [item.guid, item]));

    // New items
    for (const [guid, item] of currentMap) {
      if (!previousMap.has(guid)) {
        changes.push({
          operation: 'create',
          entity,
          data: {
            guid: item.guid,
            userId,
            description: item.description,
            createdAt: item.createdAt
          }
        });
      }
    }

    // Updated items
    for (const [guid, currentItem] of currentMap) {
      const previousItem = previousMap.get(guid);
      if (!previousItem) continue;

      const currentClean = _.omit(currentItem, 'updatedAt');
      const previousClean = _.omit(previousItem, 'updatedAt');

      if (!_.isEqual(currentClean, previousClean)) {
        changes.push({
          operation: 'update',
          entity,
          data: {
            guid: currentItem.guid,
            userId,
            description: currentItem.description,
            updatedAt: currentItem.updatedAt
          },
          previousData: {
            guid: previousItem.guid,
            userId,
            description: previousItem.description,
            createdAt: previousItem.createdAt
          }
        });
      }
    }

    // Deleted items
    for (const [guid, item] of previousMap) {
      if (!currentMap.has(guid)) {
        changes.push({
          operation: 'delete',
          entity,
          previousData: {
            guid: item.guid,
            userId,
            description: item.description,
            createdAt: item.createdAt
          }
        });
      }
    }
  }

  get db() {
    return this.storage.db;
  }
}

export default StorageWithLog;
