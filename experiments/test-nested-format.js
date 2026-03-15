/**
 * Experiment: Build deeply nested indented transaction format.
 *
 * Target format from @konard's feedback:
 * (
 *  transaction (
 *     guid 019cf18c-351d-71ea-988b-e1ed13d52402
 *     timestamp "2026-03-15T12:50:23.645Z"
 *     change (
 *       ()
 *       (
 *         (
 *           need (
 *             guid 019cf18c-351c-75e8-b218-b4a68582ff9e
 *             userId 123456
 *             description 'Looking for a bicycle in good condition'
 *             createdAt '2026-03-15T12:50:23.644Z'
 *          )
 *       )
 *     )
 *  )
 * )
 */

import { escapeReference, jsonToLino } from 'lino-objects-codec';
import { Parser } from 'links-notation';

const INDENT = '  ';

/**
 * Format an object as indented key-value pairs.
 * Each entry is on its own line: key value
 * If value is complex (starts with '('), it gets its own nested block.
 */
function formatObjectIndented(obj, depth = 0) {
  const pad = INDENT.repeat(depth);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    const escapedKey = escapeReference({ value: key });

    if (typeof value === 'object' && value !== null && !Array.isArray(value) && value._type === 'nested') {
      // Nested block
      lines.push(`${pad}${escapedKey} (`);
      lines.push(value.content(depth + 1));
      lines.push(`${pad})`);
    } else {
      const escapedValue = escapeReference({ value: String(value) });
      lines.push(`${pad}${escapedKey} ${escapedValue}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build entity data as indented key-value pairs.
 */
function formatEntityIndented(data, depth = 0) {
  const pad = INDENT.repeat(depth);
  const lines = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      const escapedKey = escapeReference({ value: key });
      const escapedValue = escapeReference({ value: String(value) });
      lines.push(`${pad}${escapedKey} ${escapedValue}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a substitution (change) as nested indented structure.
 * Create: (() (entity (fields...)))
 * Update: ((entity (old-fields...)) (entity (new-fields...)))
 * Delete: ((entity (old-fields...)) ())
 */
function formatSubstitutionIndented(change, depth = 0) {
  const pad = INDENT.repeat(depth);
  const { operation, entity, data, previousData } = change;

  if (operation === 'create') {
    const lines = [];
    lines.push(`${pad}()`);  // empty (from)
    lines.push(`${pad}(`);   // start of (to)
    lines.push(`${pad}${INDENT}(`);  // start of entity wrapper
    lines.push(`${pad}${INDENT}${INDENT}${escapeReference({ value: entity })} (`);
    lines.push(formatEntityIndented(data, depth + 3));
    lines.push(`${pad}${INDENT}${INDENT})`);
    lines.push(`${pad}${INDENT})`);
    lines.push(`${pad})`);
    return lines.join('\n');
  }

  if (operation === 'update') {
    const lines = [];
    // Old entity
    lines.push(`${pad}(`);
    lines.push(`${pad}${INDENT}(`);
    lines.push(`${pad}${INDENT}${INDENT}${escapeReference({ value: entity })} (`);
    lines.push(formatEntityIndented(previousData, depth + 3));
    lines.push(`${pad}${INDENT}${INDENT})`);
    lines.push(`${pad}${INDENT})`);
    lines.push(`${pad})`);
    // New entity
    lines.push(`${pad}(`);
    lines.push(`${pad}${INDENT}(`);
    lines.push(`${pad}${INDENT}${INDENT}${escapeReference({ value: entity })} (`);
    lines.push(formatEntityIndented(data, depth + 3));
    lines.push(`${pad}${INDENT}${INDENT})`);
    lines.push(`${pad}${INDENT})`);
    lines.push(`${pad})`);
    return lines.join('\n');
  }

  if (operation === 'delete') {
    const lines = [];
    // Old entity
    lines.push(`${pad}(`);
    lines.push(`${pad}${INDENT}(`);
    lines.push(`${pad}${INDENT}${INDENT}${escapeReference({ value: entity })} (`);
    lines.push(formatEntityIndented(previousData, depth + 3));
    lines.push(`${pad}${INDENT}${INDENT})`);
    lines.push(`${pad}${INDENT})`);
    lines.push(`${pad})`);
    // Empty (to)
    lines.push(`${pad}()`);
    return lines.join('\n');
  }

  throw new Error(`Unknown operation: ${operation}`);
}

/**
 * Format a full transaction.
 */
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

// Test it
const txId = '019cf18c-351d-71ea-988b-e1ed13d52402';
const timestamp = '2026-03-15T12:50:23.645Z';

console.log('=== CREATE ===');
const createResult = formatTransaction({
  txId,
  timestamp,
  change: {
    operation: 'create',
    entity: 'need',
    data: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: 123456,
      description: 'Looking for a bicycle in good condition',
      createdAt: '2026-03-15T12:50:23.644Z'
    }
  }
});
console.log(createResult);

console.log('\n=== UPDATE ===');
const updateResult = formatTransaction({
  txId,
  timestamp,
  change: {
    operation: 'update',
    entity: 'need',
    previousData: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: 123456,
      description: 'Looking for a bicycle in good condition',
      createdAt: '2026-03-15T12:50:23.644Z'
    },
    data: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: 123456,
      description: 'Looking for a RED bicycle in good condition',
      createdAt: '2026-03-15T12:50:23.644Z'
    }
  }
});
console.log(updateResult);

console.log('\n=== DELETE ===');
const deleteResult = formatTransaction({
  txId,
  timestamp,
  change: {
    operation: 'delete',
    entity: 'need',
    previousData: {
      guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
      userId: 123456,
      description: 'Looking for a bicycle in good condition',
      createdAt: '2026-03-15T12:50:23.644Z'
    }
  }
});
console.log(deleteResult);

// Now test parsing back
console.log('\n=== PARSE TEST ===');
const parser = new Parser();
const parsed = parser.parse(createResult);
console.log('Parsed:', JSON.stringify(parsed, null, 2));
