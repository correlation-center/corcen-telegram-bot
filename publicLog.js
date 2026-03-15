import { Link } from '@linksplatform/protocols-lino';
import { v7 as uuidv7 } from 'uuid';

/**
 * PublicLog manages a public audit log of all database changes.
 * Changes are posted to a Telegram channel in LiNo (Links Notation) format
 * using link substitution operations:
 *   - Creation: (() (...)) - replace nothing with a new link
 *   - Update: ((...) (...)) - replace old link with new link
 *   - Deletion: ((...) ()) - replace link with nothing
 *
 * This creates a transparent, immutable history that can be used to reconstruct
 * the current database state using link-cli.
 */
class PublicLog {
  constructor({ telegram, logChannel, tracing = false }) {
    this.telegram = telegram;
    this.logChannel = logChannel;
    this.tracing = tracing;
  }

  /**
   * Log a database change to the public channel as a link substitution operation.
   * @param {Object} change - The change object
   * @param {string} change.operation - Operation type: 'create', 'update', 'delete'
   * @param {string} change.entity - Entity type: 'need', 'resource', 'user'
   * @param {Object} change.data - The new data (for create/update)
   * @param {Object} [change.previousData] - Previous data (for update/delete)
   * @returns {Promise<Object>} Transaction object with txId and messageId
   */
  async logChange(change) {
    const txId = uuidv7();
    const timestamp = new Date().toISOString();

    if (!this.logChannel) {
      if (this.tracing) {
        console.log('PublicLog: no log channel configured, skipping public logging');
      }
      return { txId, messageId: null, timestamp, change, confirmed: true };
    }

    const subString = this.buildSubstitutionString(change);
    const messageText = this.buildTransactionString({
      txId, timestamp, substitutionStrings: [subString]
    });

    if (this.tracing) {
      console.log('PublicLog: logging change', JSON.stringify({ txId, change }, null, 2));
      console.log('PublicLog: LiNo message:', messageText);
    }

    try {
      const message = await this.telegram.sendMessage(
        this.logChannel,
        messageText
      );

      if (this.tracing) {
        console.log('PublicLog: change logged successfully', {
          txId,
          messageId: message.message_id
        });
      }

      return {
        txId,
        messageId: message.message_id,
        timestamp,
        change,
        confirmed: true
      };
    } catch (error) {
      console.error('PublicLog: failed to log change', error);
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
   * Build a link representing the entity data.
   * Structure: (entity guid userId description channelMessageId timestamp)
   * @param {string} entity - Entity type
   * @param {Object} data - Entity data
   * @returns {Link}
   */
  buildEntityLink(entity, data) {
    const values = [new Link(entity)];

    if (data.guid) values.push(new Link(String(data.guid)));
    if (data.userId) values.push(new Link(String(data.userId)));
    if (data.description !== undefined) values.push(new Link(String(data.description)));
    if (data.channelMessageId !== undefined && data.channelMessageId !== null) {
      values.push(new Link(String(data.channelMessageId)));
    }
    if (data.createdAt) values.push(new Link(String(data.createdAt)));
    if (data.updatedAt) values.push(new Link(String(data.updatedAt)));

    return new Link(null, values);
  }

  /**
   * Build a link substitution string for a change.
   * Uses the link-cli single substitution format:
   * - Creation: (() (entity ...))
   * - Update: ((entity ...old) (entity ...new))
   * - Deletion: ((entity ...old) ())
   *
   * Note: We build the string manually because the LiNo Link API
   * drops empty links () when used as values in formatValue().
   * @param {Object} change
   * @returns {string} LiNo substitution string
   */
  buildSubstitutionString(change) {
    const { operation, entity, data, previousData } = change;

    if (operation === 'create') {
      const newLink = this.buildEntityLink(entity, data);
      return `(() ${newLink.toString()})`;
    }

    if (operation === 'update') {
      const oldLink = this.buildEntityLink(entity, previousData);
      const newLink = this.buildEntityLink(entity, data);
      return `(${oldLink.toString()} ${newLink.toString()})`;
    }

    if (operation === 'delete') {
      const oldLink = this.buildEntityLink(entity, previousData);
      return `(${oldLink.toString()} ())`;
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  /**
   * Build a transaction string wrapping substitution operation(s).
   * Structure: (transaction txId timestamp substitution...)
   * @param {Object} params
   * @returns {string} Full LiNo transaction string
   */
  buildTransactionString({ txId, timestamp, substitutionStrings }) {
    const subs = substitutionStrings.join(' ');
    return `(transaction ${txId} ${Link.escapeReference(timestamp)} ${subs})`;
  }

  /**
   * Batch log multiple changes in a single transaction.
   * @param {Array<Object>} changes - Array of change objects
   * @returns {Promise<Object>} Transaction object
   */
  async logBatchChanges(changes) {
    const txId = uuidv7();
    const timestamp = new Date().toISOString();

    if (!this.logChannel) {
      if (this.tracing) {
        console.log('PublicLog: no log channel configured, skipping batch logging');
      }
      return { txId, messageId: null, timestamp, changes, confirmed: true };
    }

    const subStrings = changes.map(change => this.buildSubstitutionString(change));
    const messageText = this.buildTransactionString({
      txId, timestamp, substitutionStrings: subStrings
    });

    if (this.tracing) {
      console.log('PublicLog: logging batch', JSON.stringify({ txId, count: changes.length }, null, 2));
      console.log('PublicLog: LiNo message:', messageText);
    }

    try {
      const message = await this.telegram.sendMessage(
        this.logChannel,
        messageText
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
}

export default PublicLog;
