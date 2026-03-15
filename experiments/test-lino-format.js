import { Link } from '@linksplatform/protocols-lino';

// Test with format(true) for less parentheses
const empty = new Link(null, []);
const needData = new Link(null, [
  new Link('need'),
  new Link('guid-here'),
  new Link('123456'),
  new Link('Looking for a bicycle'),
  new Link('42'),
  new Link('2025-10-12T02:18:28.022Z')
]);

const creation = new Link(null, [empty, needData]);
console.log("Creation toString():", creation.toString());
console.log("Creation format(true):", creation.format(true));
console.log("Creation format(false):", creation.format(false));

// Test the transaction approach
const tx = new Link(null, [
  new Link('transaction'),
  new Link('0199d636-512d-755d-bb81-b4f6f02f9aac'),
  new Link('2025-10-12T02:18:28.014Z'),
  creation
]);
console.log("\nTransaction toString():", tx.toString());
console.log("Transaction format(true):", tx.format(true));

// What about using (() (need ...)) directly?
console.log("\n=== Correct substitution form ===");

// Per link-cli: () ((1 1)) for creation
// That would be: (empty) ((data))
// Actually from link-cli docs: the outer parens wrap the pair
// (() (...)) means the substitution itself

const creationAlt = new Link(null, [
  new Link(null, []),  // () - empty/nothing
  new Link(null, [needData])  // ((need ...)) - wrapped link
]);
console.log("Alt creation:", creationAlt.toString());

// Actually looking at link-cli examples:
// () ((1 1)) means replace nothing with (1 1)  
// The outer level is just two items side by side
// Let's try: the substitution is a pair: [pattern, replacement]

console.log("\n=== Flat substitution ===");
// Just two links at top level for the substitution
const sub = new Link(null, [empty, needData]);
console.log("Substitution:", sub.toString());

// For the full transaction message:
const fullMsg = new Link(null, [
  new Link('transaction'),
  new Link('tx-id-here'),
  new Link('2025-10-12T02:18:28.014Z'),
  new Link(null, [empty, needData])  // the substitution operation
]);
console.log("Full msg:", fullMsg.toString());

// Alternative: use lessParentheses for cleaner output
console.log("Full msg (less parens):", fullMsg.format(true));
