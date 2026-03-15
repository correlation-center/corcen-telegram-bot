import { jsonToLino, formatIndented, parseIndented } from 'lino-objects-codec';
import { v7 as uuidv7 } from 'uuid';

/**
 * PublicLog manages a public audit log of all database changes.
 * Changes are posted to a Telegram channel in LiNo (Links Notation) format
 * using link substitution operations:
 *   - Creation: (() (entity ((field value) ...))) - replace nothing with a new link
 *   - Update: ((entity (...)) (entity (...))) - replace old link with new link
 *   - Deletion: ((entity (...)) ()) - replace link with nothing
 *
 * The transaction format uses lino-objects-codec's indented format so each
 * field has its name alongside its value, making transactions human-readable.
 *
 * Example transaction (in local file and Telegram):
 *   019cf18c-351d-71ea-988b-e1ed13d52402
 *     timestamp "2026-03-15T12:50:23.645Z"
 *     change "(() (need ((guid 019cf18c-...) (userId 123456) (description 'Looking for a bicycle'))))"
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

    const substitution = this.buildSubstitutionString(change);
    const messageText = this.buildTransactionString({ txId, timestamp, substitutions: [substitution] });

    if (this.tracing) {
      console.log('PublicLog: logging change', JSON.stringify({ txId, change }, null, 2));
      console.log('PublicLog: LiNo message:\n', messageText);
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
   * Build a LiNo representation of entity data using jsonToLino for named fields.
   * Each field appears as (fieldName value) so every value has its field name.
   * Example: ((guid 019cf...) (userId 123456) (description 'A bicycle') ...)
   * @param {Object} data - Entity data (fields with undefined/null values are omitted)
   * @returns {string} LiNo named-field string
   */
  buildEntityDataLino(data) {
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        filtered[key] = String(value);
      }
    }
    return jsonToLino({ json: filtered });
  }

  /**
   * Build a link substitution string for a change.
   * Uses the link-cli single substitution format:
   * - Creation: (() (entity ((field value) ...)))
   * - Update: ((entity (...old)) (entity (...new)))
   * - Deletion: ((entity (...old)) ())
   *
   * Entity data uses named fields via jsonToLino so each value is labelled.
   * @param {Object} change
   * @returns {string} LiNo substitution string
   */
  buildSubstitutionString(change) {
    const { operation, entity, data, previousData } = change;

    if (operation === 'create') {
      const newDataLino = this.buildEntityDataLino(data);
      return `(() (${entity} ${newDataLino}))`;
    }

    if (operation === 'update') {
      const oldDataLino = this.buildEntityDataLino(previousData);
      const newDataLino = this.buildEntityDataLino(data);
      return `((${entity} ${oldDataLino}) (${entity} ${newDataLino}))`;
    }

    if (operation === 'delete') {
      const oldDataLino = this.buildEntityDataLino(previousData);
      return `((${entity} ${oldDataLino}) ())`;
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  /**
   * Build an indented transaction string using lino-objects-codec's formatIndented.
   * Each transaction is human-readable with field names and indented formatting.
   * Format:
   *   txId
   *     timestamp "..."
   *     change "substitution-string"
   *
   * @param {Object} params
   * @param {string} params.txId - Transaction ID (UUIDv7)
   * @param {string} params.timestamp - ISO 8601 timestamp
   * @param {string[]} params.substitutions - Array of LiNo substitution strings
   * @returns {string} Indented transaction string
   */
  buildTransactionString({ txId, timestamp, substitutions }) {
    const obj = { timestamp };
    if (substitutions.length === 1) {
      obj.change = substitutions[0];
    } else {
      substitutions.forEach((sub, i) => {
        obj[`change${i + 1}`] = sub;
      });
    }
    return formatIndented({ id: txId, obj });
  }

  /**
   * Parse a transaction string produced by buildTransactionString.
   * @param {string} text - Indented transaction string
   * @returns {{ id: string, obj: Object }} Parsed transaction
   */
  parseTransactionString(text) {
    return parseIndented({ text });
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

    const substitutions = changes.map(change => this.buildSubstitutionString(change));
    const messageText = this.buildTransactionString({ txId, timestamp, substitutions });

    if (this.tracing) {
      console.log('PublicLog: logging batch', JSON.stringify({ txId, count: changes.length }, null, 2));
      console.log('PublicLog: LiNo message:\n', messageText);
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
