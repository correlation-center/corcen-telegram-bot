import { escapeReference } from 'lino-objects-codec';
import { Parser as LinoParser } from 'links-notation';
import { v7 as uuidv7 } from 'uuid';

const INDENT = '  ';

// Shared parser instance for roundtrip parsing
const linoParser = new LinoParser();

/**
 * PublicLog manages a public audit log of all database changes.
 * Changes are posted to a Telegram channel in LiNo (Links Notation) format
 * using link substitution operations:
 *   - Creation: (() ((entity (fields...)))) - replace nothing with a new link
 *   - Update: (((entity (...old))) ((entity (...new)))) - replace old with new
 *   - Deletion: (((entity (...old))) ()) - replace link with nothing
 *
 * Each transaction is deeply indented for human readability:
 *   (
 *     transaction (
 *       guid <txId>
 *       timestamp <iso-timestamp>
 *       change (
 *         ()
 *         (
 *           (
 *             need (
 *               guid <entity-guid>
 *               userId 123456
 *               description 'Looking for a bicycle'
 *               createdAt <iso-timestamp>
 *             )
 *           )
 *         )
 *       )
 *     )
 *   )
 *
 * Note: channelMessageId is NOT included in transactions because we write
 * to the public log first, and only get the message ID after confirmation.
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

    const messageText = this.formatTransaction({ txId, timestamp, change });

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
   * Format entity data as indented key-value pairs.
   * Each field is on its own line: key value
   * @param {Object} data - Entity data (fields with undefined/null values are omitted)
   * @param {number} depth - Current indentation depth
   * @returns {string} Indented key-value lines
   */
  formatEntityIndented(data, depth = 0) {
    const pad = INDENT.repeat(depth);
    const lines = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        lines.push(`${pad}${escapeReference({ value: key })} ${escapeReference({ value: String(value) })}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Format an entity block as indented nested structure:
   *   (
   *     (
   *       entityName (
   *         field1 value1
   *         field2 value2
   *       )
   *     )
   *   )
   * @param {string} entityName - The entity type name
   * @param {Object} entityData - The entity field data
   * @param {number} depth - Current indentation depth
   * @returns {string} Indented entity block lines
   */
  formatEntityBlock(entityName, entityData, depth) {
    const pad = INDENT.repeat(depth);
    const lines = [];
    lines.push(`${pad}(`);
    lines.push(`${pad}${INDENT}(`);
    lines.push(`${pad}${INDENT}${INDENT}${escapeReference({ value: entityName })} (`);
    lines.push(this.formatEntityIndented(entityData, depth + 3));
    lines.push(`${pad}${INDENT}${INDENT})`);
    lines.push(`${pad}${INDENT})`);
    lines.push(`${pad})`);
    return lines.join('\n');
  }

  /**
   * Format a substitution (change) as nested indented structure.
   *   Create: (() ((entity (fields...))))
   *   Update: (((entity (old...))) ((entity (new...))))
   *   Delete: (((entity (old...))) ())
   * @param {Object} change - The change object
   * @param {number} depth - Current indentation depth
   * @returns {string} Indented substitution lines
   */
  formatSubstitutionIndented(change, depth = 0) {
    const pad = INDENT.repeat(depth);
    const { operation, entity, data, previousData } = change;

    if (operation === 'create') {
      return `${pad}()\n${this.formatEntityBlock(entity, data, depth)}`;
    }

    if (operation === 'update') {
      return `${this.formatEntityBlock(entity, previousData, depth)}\n${this.formatEntityBlock(entity, data, depth)}`;
    }

    if (operation === 'delete') {
      return `${this.formatEntityBlock(entity, previousData, depth)}\n${pad}()`;
    }

    throw new Error(`Unknown operation: ${operation}`);
  }

  /**
   * Format a full transaction as deeply nested indented LiNo.
   * @param {Object} params
   * @param {string} params.txId - Transaction ID (UUIDv7)
   * @param {string} params.timestamp - ISO 8601 timestamp
   * @param {Object} params.change - Single change object
   * @returns {string} Deeply nested indented transaction string
   */
  formatTransaction({ txId, timestamp, change }) {
    const lines = [];
    lines.push('(');
    lines.push(`${INDENT}transaction (`);
    lines.push(`${INDENT}${INDENT}guid ${escapeReference({ value: txId })}`);
    lines.push(`${INDENT}${INDENT}timestamp ${escapeReference({ value: timestamp })}`);
    lines.push(`${INDENT}${INDENT}change (`);
    lines.push(this.formatSubstitutionIndented(change, 3));
    lines.push(`${INDENT}${INDENT})`);
    lines.push(`${INDENT})`);
    lines.push(')');
    return lines.join('\n');
  }

  /**
   * Format a batch transaction with multiple changes.
   * Each change gets its own numbered change field.
   * @param {Object} params
   * @param {string} params.txId - Transaction ID (UUIDv7)
   * @param {string} params.timestamp - ISO 8601 timestamp
   * @param {Object[]} params.changes - Array of change objects
   * @returns {string} Deeply nested indented transaction string
   */
  formatBatchTransaction({ txId, timestamp, changes }) {
    const lines = [];
    lines.push('(');
    lines.push(`${INDENT}transaction (`);
    lines.push(`${INDENT}${INDENT}guid ${escapeReference({ value: txId })}`);
    lines.push(`${INDENT}${INDENT}timestamp ${escapeReference({ value: timestamp })}`);
    changes.forEach((change, i) => {
      const label = changes.length === 1 ? 'change' : `change${i + 1}`;
      lines.push(`${INDENT}${INDENT}${label} (`);
      lines.push(this.formatSubstitutionIndented(change, 3));
      lines.push(`${INDENT}${INDENT})`);
    });
    lines.push(`${INDENT})`);
    lines.push(')');
    return lines.join('\n');
  }

  /**
   * Parse entity data from a parsed link: (entityName (field1 val1 field2 val2 ...))
   * @param {Object} link - Parsed link with values [entityName, dataLink]
   * @returns {{ entity: string, data: Object }}
   */
  parseEntityFromLink(link) {
    if (!link.values || link.values.length < 2) return { entity: null, data: {} };
    const entity = link.values[0].id;
    const dataLink = link.values[1];
    const data = {};
    if (dataLink.values) {
      for (let i = 0; i < dataLink.values.length; i += 2) {
        data[dataLink.values[i].id] = dataLink.values[i + 1].id;
      }
    }
    return { entity, data };
  }

  /**
   * Parse a substitution from a change link.
   * The change link has exactly 2 values: (from, to).
   * @param {Object} changeLink - Parsed change link
   * @returns {Object} Parsed change with operation, entity, data, previousData
   */
  parseSubstitution(changeLink) {
    if (!changeLink.values || changeLink.values.length !== 2) {
      throw new Error('Change link must have exactly 2 values (from, to)');
    }

    const fromLink = changeLink.values[0];
    const toLink = changeLink.values[1];

    const fromEmpty = !fromLink.values || fromLink.values.length === 0;
    const toEmpty = !toLink.values || toLink.values.length === 0;

    if (fromEmpty && !toEmpty) {
      const entityWrapper = toLink.values[0];
      const { entity, data } = this.parseEntityFromLink(entityWrapper);
      return { operation: 'create', entity, data };
    }

    if (!fromEmpty && toEmpty) {
      const entityWrapper = fromLink.values[0];
      const { entity, data } = this.parseEntityFromLink(entityWrapper);
      return { operation: 'delete', entity, previousData: data };
    }

    if (!fromEmpty && !toEmpty) {
      const oldEntityWrapper = fromLink.values[0];
      const newEntityWrapper = toLink.values[0];
      const { entity, data: previousData } = this.parseEntityFromLink(oldEntityWrapper);
      const { data } = this.parseEntityFromLink(newEntityWrapper);
      return { operation: 'update', entity, data, previousData };
    }

    throw new Error('Invalid substitution: both sides empty');
  }

  /**
   * Parse a transaction string back into structured data.
   * @param {string} text - The formatted transaction string
   * @returns {Object} Parsed transaction with txId, timestamp, and change details
   */
  parseTransactionString(text) {
    const parsed = linoParser.parse(text);
    if (!parsed || parsed.length === 0) {
      throw new Error('Failed to parse transaction string');
    }

    // Outer: (transaction (...))
    const outerLink = parsed[0];
    const contentBlock = outerLink.values[1];
    const values = contentBlock.values;

    // Extract key-value pairs from flat sequence: guid val timestamp val change block
    const pairs = {};
    for (let i = 0; i < values.length; i += 2) {
      const key = values[i].id;
      const val = values[i + 1];
      if (val.values && val.values.length > 0) {
        pairs[key] = val;
      } else {
        pairs[key] = val.id;
      }
    }

    const result = {
      txId: pairs.guid,
      timestamp: pairs.timestamp,
    };

    // Parse single change or numbered changes
    if (pairs.change) {
      const sub = this.parseSubstitution(pairs.change);
      Object.assign(result, sub);
    } else {
      // Batch: change1, change2, ...
      result.changes = [];
      let idx = 1;
      while (pairs[`change${idx}`]) {
        result.changes.push(this.parseSubstitution(pairs[`change${idx}`]));
        idx++;
      }
    }

    return result;
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

    const messageText = changes.length === 1
      ? this.formatTransaction({ txId, timestamp, change: changes[0] })
      : this.formatBatchTransaction({ txId, timestamp, changes });

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
