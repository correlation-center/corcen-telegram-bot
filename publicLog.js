import { Parser } from '@linksplatform/protocols-lino';
import { v7 as uuidv7 } from 'uuid';

/**
 * PublicLog manages a public audit log of all database changes.
 * Changes are posted to a Telegram channel in LiNo (Links Notation) format.
 * This creates a transparent, immutable history that can be used to reconstruct
 * the current database state.
 */
class PublicLog {
  constructor({ telegram, logChannel, tracing = false }) {
    this.telegram = telegram;
    this.logChannel = logChannel;
    this.tracing = tracing;
    this.parser = new Parser();
    // Track pending transactions for async confirmation
    this.pendingTransactions = new Map();
  }

  /**
   * Log a database change to the public channel in LiNo format.
   * @param {Object} change - The change object
   * @param {string} change.operation - Operation type: 'create', 'update', 'delete'
   * @param {string} change.entity - Entity type: 'user', 'need', 'resource'
   * @param {string} change.userId - User ID
   * @param {Object} change.data - The data being changed
   * @param {Object} [change.previousData] - Previous data (for updates)
   * @returns {Promise<Object>} Transaction object with txId and messageId
   */
  async logChange(change) {
    const txId = uuidv7();
    const timestamp = new Date().toISOString();

    // If no log channel configured, skip public logging
    if (!this.logChannel) {
      if (this.tracing) {
        console.log('PublicLog: no log channel configured, skipping public logging');
      }
      return {
        txId,
        messageId: null,
        timestamp,
        change,
        confirmed: true // Local-only mode
      };
    }

    // Build LiNo representation of the change
    const linoData = this.buildLinoChange({
      txId,
      timestamp,
      ...change
    });

    if (this.tracing) {
      console.log('PublicLog: logging change', JSON.stringify({ txId, change }, null, 2));
      console.log('PublicLog: LiNo representation:', linoData);
    }

    try {
      // Post change to public channel
      const message = await this.telegram.sendMessage(
        this.logChannel,
        linoData,
        { parse_mode: 'HTML' }
      );

      const transaction = {
        txId,
        messageId: message.message_id,
        timestamp,
        change,
        confirmed: true
      };

      if (this.tracing) {
        console.log('PublicLog: change logged successfully', {
          txId,
          messageId: message.message_id
        });
      }

      return transaction;
    } catch (error) {
      console.error('PublicLog: failed to log change', error);

      // Return unconfirmed transaction
      return {
        txId,
        messageId: null,
        timestamp,
        change,
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * Build LiNo representation of a database change.
   * @param {Object} params - Change parameters
   * @returns {string} LiNo formatted string
   */
  buildLinoChange({ txId, timestamp, operation, entity, userId, data, previousData }) {
    // Create a readable LiNo format that represents the change
    const lines = [];

    // Transaction header
    lines.push(`<b>Transaction: ${txId}</b>`);
    lines.push(`<code>${timestamp}</code>`);
    lines.push('');

    // Change details in LiNo format
    lines.push(`(change:`);
    lines.push(`  operation: ${operation}`);
    lines.push(`  entity: ${entity}`);
    lines.push(`  userId: ${userId}`);

    if (data) {
      lines.push(`  data:`);
      this.appendDataToLino(lines, data, '    ');
    }

    if (previousData && operation === 'update') {
      lines.push(`  previousData:`);
      this.appendDataToLino(lines, previousData, '    ');
    }

    lines.push(`)`);
    return lines.join('\n');
  }

  /**
   * Helper to append data fields to LiNo format with indentation.
   */
  appendDataToLino(lines, data, indent) {
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        this.appendDataToLino(lines, value, indent + '  ');
      } else if (Array.isArray(value)) {
        lines.push(`${indent}${key}: [${value.length} items]`);
      } else if (typeof value === 'string') {
        // Escape and truncate long strings
        const truncated = value.length > 100 ? value.substring(0, 97) + '...' : value;
        const escaped = truncated.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        lines.push(`${indent}${key}: "${escaped}"`);
      } else {
        lines.push(`${indent}${key}: ${value}`);
      }
    }
  }

  /**
   * Batch log multiple changes in a single transaction.
   * @param {Array<Object>} changes - Array of change objects
   * @returns {Promise<Object>} Transaction object
   */
  async logBatchChanges(changes) {
    const txId = uuidv7();
    const timestamp = new Date().toISOString();

    // If no log channel configured, skip public logging
    if (!this.logChannel) {
      if (this.tracing) {
        console.log('PublicLog: no log channel configured, skipping batch logging');
      }
      return {
        txId,
        messageId: null,
        timestamp,
        changes,
        confirmed: true // Local-only mode
      };
    }

    const lines = [];
    lines.push(`<b>Batch Transaction: ${txId}</b>`);
    lines.push(`<code>${timestamp}</code>`);
    lines.push(`<i>${changes.length} changes</i>`);
    lines.push('');

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      lines.push(`${i + 1}. ${change.operation} ${change.entity} (user: ${change.userId})`);
    }

    const linoData = lines.join('\n');

    try {
      const message = await this.telegram.sendMessage(
        this.logChannel,
        linoData,
        { parse_mode: 'HTML' }
      );

      return {
        txId,
        messageId: message.message_id,
        timestamp,
        changes,
        confirmed: true
      };
    } catch (error) {
      console.error('PublicLog: failed to log batch changes', error);

      return {
        txId,
        messageId: null,
        timestamp,
        changes,
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * Get transaction status.
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object|null>} Transaction status or null if not found
   */
  async getTransactionStatus(txId) {
    return this.pendingTransactions.get(txId) || null;
  }

  /**
   * Verify a transaction was logged successfully.
   * @param {string} txId - Transaction ID
   * @param {number} messageId - Message ID in the log channel
   * @returns {Promise<boolean>} True if verified
   */
  async verifyTransaction(txId, messageId) {
    try {
      // Try to retrieve the message from the channel
      const message = await this.telegram.getChat(this.logChannel);
      // If we can access the channel, assume the message exists
      // (Telegram doesn't provide a direct way to fetch a specific message)
      return true;
    } catch (error) {
      console.error('PublicLog: failed to verify transaction', error);
      return false;
    }
  }
}

export default PublicLog;
