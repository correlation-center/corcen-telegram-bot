import { Parser, Link } from '@linksplatform/protocols-lino';

const parser = new Parser();

// Test what the new transaction string looks like when parsed
const txStr = `(transaction tx-id '2025-10-12T00:00:00.000Z' (() (need g1 123 'Test need' 42 '2025-10-12T00:00:00.000Z')))`;
console.log("Transaction:", txStr);

const parsed = parser.parse(txStr);
const txLink = parsed[0];
console.log("Values count:", txLink.values.length);
for (let i = 0; i < txLink.values.length; i++) {
  const v = txLink.values[i];
  console.log(`  [${i}] id=${v.id}, values.length=${v.values.length}`);
  if (v.values.length > 0) {
    for (let j = 0; j < v.values.length; j++) {
      const vv = v.values[j];
      console.log(`    [${i}][${j}] id=${vv.id}, values.length=${vv.values.length}`);
    }
  }
}
