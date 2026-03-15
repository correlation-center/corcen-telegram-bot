/**
 * Design experiment: figure out the ideal indented format
 * that combines lino substitution with field names.
 */
import {
  escapeReference, jsonToLino, formatIndented, parseIndented,
} from 'lino-objects-codec';
import { v7 as uuidv7 } from 'uuid';

const txId = uuidv7();
const guid = uuidv7();
const timestamp = new Date().toISOString();

// The feedback wants: "near each value we will have its field name"
// and "indented formatting by default"
//
// Best approach: use the indented format for the transaction record,
// and include the lino substitution as a "change" field.
// The entity data should use jsonToLino for named fields.

// For entity data, jsonToLino gives us: ((guid ...) (userId ...) (description ...))
// which naturally has field names near each value.

const needData = {
  guid: guid,
  userId: '123456',
  description: 'Looking for a bicycle in good condition',
  channelMessageId: '42',
  createdAt: timestamp
};

const needLino = jsonToLino({ json: needData });
console.log('Named field entity:', needLino);

// Substitution with named fields:
// Creation: (() (need ((guid ...) (userId ...) ...)))
// This is clean and self-documenting

const createSubstitution = `(() (need ${needLino}))`;
console.log('\nCreate substitution (compact):', createSubstitution);

// For the transaction record, use formatIndented so each transaction
// in the log file is human-readable with field names
const txFormatted = formatIndented({ id: txId, obj: {
  timestamp: timestamp,
  change: createSubstitution,
}});

console.log('\nTransaction (indented format):');
console.log(txFormatted);
console.log('---');

// Parse it back
const parsed = parseIndented({ text: txFormatted });
console.log('\nParsed back - id:', parsed.id);
console.log('Parsed back - change:', parsed.obj.change);

// For Telegram message (public log), we might want the same indented format
// but sent as a code block or formatted text
console.log('\n=== Telegram message format ===');
// Option 1: Same as file format (indented)
console.log('Option 1 (same as file):');
console.log(txFormatted);

// Option 2: A single compact line for Telegram
const txCompact = `(transaction ${txId} ${escapeReference({ value: timestamp })} ${createSubstitution})`;
console.log('\nOption 2 (compact):');
console.log(txCompact);

// Option 3: Indented with nested entity data expanded
// The most human-readable: transaction header + indented change
const txMultiline = `(transaction
  (id ${txId})
  (timestamp ${escapeReference({ value: timestamp })})
  (change
    ${createSubstitution}
  )
)`;
console.log('\nOption 3 (multi-line with named fields):');
console.log(txMultiline);

// Test update and delete substitutions too
const oldNeedData = { ...needData, description: 'Old description' };
const oldNeedLino = jsonToLino({ json: oldNeedData });
const updateSubstitution = `((need ${oldNeedLino}) (need ${needLino}))`;
const deleteSubstitution = `((need ${needLino}) ())`;

console.log('\n=== Update substitution ===');
console.log(updateSubstitution);
console.log('\n=== Delete substitution ===');
console.log(deleteSubstitution);

// Complete indented transactions for each operation type
console.log('\n=== All operation types (indented format) ===');
for (const [name, sub] of [['CREATE', createSubstitution], ['UPDATE', updateSubstitution], ['DELETE', deleteSubstitution]]) {
  const tx = formatIndented({ id: uuidv7(), obj: {
    timestamp: new Date().toISOString(),
    change: sub,
  }});
  console.log(`\n${name}:`);
  console.log(tx);
  console.log('---');
}
