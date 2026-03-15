/**
 * Experiment: Explore lino-objects-codec API
 * Testing formatIndented, jsonToLino, escapeReference
 */
import {
  escapeReference, unescapeReference,
  jsonToLino, linoToJson,
  formatAsLino, formatIndented, parseIndented,
} from 'lino-objects-codec';
import { v7 as uuidv7 } from 'uuid';

const guid = uuidv7();
const txId = uuidv7();
const timestamp = new Date().toISOString();

console.log('=== escapeReference examples ===');
console.log(escapeReference({ value: 'hello world' }));
console.log(escapeReference({ value: '2026-03-15T12:00:00.000Z' }));
console.log(escapeReference({ value: 'simple' }));
console.log(escapeReference({ value: 42 }));

console.log('\n=== jsonToLino examples ===');
const needData = {
  type: 'need',
  guid: guid,
  userId: '123456',
  description: 'Looking for a bicycle in good condition',
  channelMessageId: 42,
  createdAt: '2026-03-15T12:00:00.000Z'
};
console.log('Object to lino:', jsonToLino({ json: needData }));

const simpleObj = { key: 'value', num: 42 };
console.log('Simple object:', jsonToLino({ json: simpleObj }));

console.log('\n=== formatIndented examples ===');
// formatIndented takes { id, obj, indent? }
const indented = formatIndented({ id: txId, obj: {
  timestamp: timestamp,
  type: 'transaction',
  change: 'create',
  entity: 'need',
  guid: guid,
  userId: '123456',
  description: 'Looking for a bicycle in good condition',
  channelMessageId: '42',
  createdAt: '2026-03-15T12:00:00.000Z'
}});
console.log('formatIndented output:');
console.log(indented);
console.log('---');

console.log('\n=== parseIndented roundtrip ===');
const parsed = parseIndented({ text: indented });
console.log('parsed id:', parsed.id);
console.log('parsed obj:', JSON.stringify(parsed.obj, null, 2));

console.log('\n=== formatAsLino examples ===');
// formatAsLino takes { values } array
const asLino = formatAsLino({ values: ['transaction', txId, timestamp, '(() (need guid userId desc))'] });
console.log('formatAsLino:', asLino);

console.log('\n=== Testing nested structure idea ===');
// What if we put the substitution inside the transaction object?
const txObj = {
  timestamp: timestamp,
  change: `(() (need ${guid} 123456 'Looking for a bicycle' 42 '${timestamp}'))`,
};
const txIndented = formatIndented({ id: txId, obj: txObj });
console.log('Transaction with substitution:');
console.log(txIndented);

console.log('\n=== Testing named-field approach ===');
// Instead of positional (need guid userId ...) use named fields
// so we get (need ((guid g) (userId u) (description d) ...))
const needWithFields = jsonToLino({ json: {
  guid: guid,
  userId: '123456',
  description: 'Looking for a bicycle in good condition',
  channelMessageId: '42',
  createdAt: '2026-03-15T12:00:00.000Z'
}});
console.log('Need with named fields (jsonToLino):', needWithFields);

// Try creating a full transaction with named fields
const createSubstitution = `(() (need ${needWithFields}))`;
console.log('Create substitution:', createSubstitution);

// Full transaction
const txWithNamedFields = formatIndented({ id: txId, obj: {
  timestamp: timestamp,
  entity: 'need',
  operation: createSubstitution,
}});
console.log('Full transaction (indented):');
console.log(txWithNamedFields);
