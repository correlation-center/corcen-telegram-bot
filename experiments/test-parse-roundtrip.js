/**
 * Experiment: Parse deeply nested transaction back to structured data.
 */

import { escapeReference } from 'lino-objects-codec';
import { Parser, Link } from 'links-notation';

const parser = new Parser();

const INDENT = '  ';

// -- Format functions (same as test-nested-format.js) --

function formatEntityIndented(data, depth = 0) {
  const pad = INDENT.repeat(depth);
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`${pad}${escapeReference({ value: key })} ${escapeReference({ value: String(value) })}`);
    }
  }
  return lines.join('\n');
}

function formatSubstitutionIndented(change, depth = 0) {
  const pad = INDENT.repeat(depth);
  const { operation, entity, data, previousData } = change;

  const formatEntityBlock = (entityName, entityData, d) => {
    const p = INDENT.repeat(d);
    const lines = [];
    lines.push(`${p}(`);
    lines.push(`${p}${INDENT}(`);
    lines.push(`${p}${INDENT}${INDENT}${escapeReference({ value: entityName })} (`);
    lines.push(formatEntityIndented(entityData, d + 3));
    lines.push(`${p}${INDENT}${INDENT})`);
    lines.push(`${p}${INDENT})`);
    lines.push(`${p})`);
    return lines.join('\n');
  };

  if (operation === 'create') {
    return `${pad}()\n${formatEntityBlock(entity, data, depth)}`;
  }
  if (operation === 'update') {
    return `${formatEntityBlock(entity, previousData, depth)}\n${formatEntityBlock(entity, data, depth)}`;
  }
  if (operation === 'delete') {
    return `${formatEntityBlock(entity, previousData, depth)}\n${pad}()`;
  }
  throw new Error(`Unknown operation: ${operation}`);
}

function formatTransaction({ txId, timestamp, change }) {
  const lines = [];
  lines.push('(');
  lines.push(`${INDENT}transaction (`);
  lines.push(`${INDENT}${INDENT}guid ${escapeReference({ value: txId })}`);
  lines.push(`${INDENT}${INDENT}timestamp ${escapeReference({ value: timestamp })}`);
  lines.push(`${INDENT}${INDENT}change (`);
  lines.push(formatSubstitutionIndented(change, 3));
  lines.push(`${INDENT}${INDENT})`);
  lines.push(`${INDENT})`);
  lines.push(')');
  return lines.join('\n');
}

// -- Parse functions --

/**
 * Extract key-value pairs from a flat values array.
 * In our format, (guid val timestamp val change block) means
 * pairs: guid->val, timestamp->val, change->block
 */
function extractKeyValuePairs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i].id;
    const val = values[i + 1];
    if (val.values && val.values.length > 0) {
      result[key] = val; // nested link
    } else {
      result[key] = val.id; // simple value
    }
  }
  return result;
}

/**
 * Parse entity data from a link like (need (guid val userId val ...))
 */
function parseEntityFromLink(link) {
  // link.values = [need, (guid val userId val ...)]
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
 * Parse a substitution from the change link.
 * The change link values are the two sides of the substitution.
 */
function parseSubstitution(changeLink) {
  if (!changeLink.values || changeLink.values.length !== 2) {
    throw new Error('Change link must have exactly 2 values (from, to)');
  }

  const fromLink = changeLink.values[0];
  const toLink = changeLink.values[1];

  const fromEmpty = !fromLink.values || fromLink.values.length === 0;
  const toEmpty = !toLink.values || toLink.values.length === 0;

  if (fromEmpty && !toEmpty) {
    // Create: (() (entity-block))
    const entityWrapper = toLink.values[0]; // the inner (need (...))
    const { entity, data } = parseEntityFromLink(entityWrapper);
    return { operation: 'create', entity, data };
  }

  if (!fromEmpty && toEmpty) {
    // Delete: ((entity-block) ())
    const entityWrapper = fromLink.values[0];
    const { entity, data } = parseEntityFromLink(entityWrapper);
    return { operation: 'delete', entity, previousData: data };
  }

  if (!fromEmpty && !toEmpty) {
    // Update: ((entity-block) (entity-block))
    const oldEntityWrapper = fromLink.values[0];
    const newEntityWrapper = toLink.values[0];
    const { entity, data: previousData } = parseEntityFromLink(oldEntityWrapper);
    const { data } = parseEntityFromLink(newEntityWrapper);
    return { operation: 'update', entity, data, previousData };
  }

  throw new Error('Invalid substitution: both sides empty');
}

/**
 * Parse a full transaction string.
 */
function parseTransaction(text) {
  const parsed = parser.parse(text);
  if (!parsed || parsed.length === 0) throw new Error('Failed to parse');

  // Outer: (transaction (...))
  const outerLink = parsed[0];
  // outerLink.values[0] = transaction, outerLink.values[1] = content block
  const contentBlock = outerLink.values[1];
  const pairs = extractKeyValuePairs(contentBlock.values);

  const txId = pairs.guid;
  const timestamp = pairs.timestamp;
  const changeLink = pairs.change;

  const substitution = parseSubstitution(changeLink);

  return { txId, timestamp, ...substitution };
}

// Test roundtrip
const original = {
  txId: '019cf18c-351d-71ea-988b-e1ed13d52402',
  timestamp: '2026-03-15T12:50:23.645Z',
  change: {
    operation: 'create',
    entity: 'need',
    data: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: '123456',
      description: 'Looking for a bicycle in good condition',
      createdAt: '2026-03-15T12:50:23.644Z'
    }
  }
};

console.log('=== Format ===');
const formatted = formatTransaction(original);
console.log(formatted);

console.log('\n=== Parse back ===');
const parsedBack = parseTransaction(formatted);
console.log(JSON.stringify(parsedBack, null, 2));

// Verify roundtrip
console.log('\n=== Verify ===');
console.log('txId match:', parsedBack.txId === original.txId);
console.log('timestamp match:', parsedBack.timestamp === original.timestamp);
console.log('operation:', parsedBack.operation);
console.log('entity:', parsedBack.entity);
console.log('data:', JSON.stringify(parsedBack.data));
console.log('data match:', JSON.stringify(parsedBack.data) === JSON.stringify(original.change.data));

// Test update
console.log('\n=== Update roundtrip ===');
const updateOrig = {
  txId: '019cf18c-abcd-1234-5678-e1ed13d52402',
  timestamp: '2026-03-15T13:00:00.000Z',
  change: {
    operation: 'update',
    entity: 'need',
    previousData: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: '123456',
      description: 'Old description'
    },
    data: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: '123456',
      description: 'New description'
    }
  }
};
const updateFormatted = formatTransaction(updateOrig);
console.log(updateFormatted);
const updateParsed = parseTransaction(updateFormatted);
console.log('Update parsed:', JSON.stringify(updateParsed, null, 2));

// Test delete
console.log('\n=== Delete roundtrip ===');
const deleteOrig = {
  txId: '019cf18c-dead-beef-cafe-e1ed13d52402',
  timestamp: '2026-03-15T14:00:00.000Z',
  change: {
    operation: 'delete',
    entity: 'need',
    previousData: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: '123456',
      description: 'Deleted need'
    }
  }
};
const deleteFormatted = formatTransaction(deleteOrig);
console.log(deleteFormatted);
const deleteParsed = parseTransaction(deleteFormatted);
console.log('Delete parsed:', JSON.stringify(deleteParsed, null, 2));
