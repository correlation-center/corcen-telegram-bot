import { Parser, Link } from '@linksplatform/protocols-lino';

// Test creating links programmatically
console.log("=== Link Creation Tests ===\n");

// Empty link (for substitution patterns)
const empty = new Link(null, []);
console.log("Empty link:", empty.toString());
console.log("Empty link format:", JSON.stringify(empty.toString()));

// Simple value link
const simple = new Link('hello');
console.log("Simple link:", simple.toString());

// Link with id and values
const withId = new Link('parent', [new Link('child1'), new Link('child2')]);
console.log("With ID:", withId.toString());

// === Link substitution format ===
console.log("\n=== Link Substitution Operations ===\n");

// Creation: (() (...)) - replace nothing with something
const needData = new Link(null, [
  new Link('need'),
  new Link('some-uuid-guid'),
  new Link('123456'),  // userId
  new Link('Looking for a bicycle'),
  new Link('42'),  // channelMessageId
  new Link('2025-10-12T02:18:28.022Z')
]);

const creation = new Link(null, [empty, needData]);
console.log("Creation:", creation.toString());

// Update: ((...) (...)) - replace old with new
const oldData = new Link(null, [
  new Link('need'),
  new Link('some-uuid-guid'),
  new Link('123456'),
  new Link('Old description'),
  new Link('42'),
  new Link('2025-10-12T02:18:28.022Z')
]);

const newData = new Link(null, [
  new Link('need'),
  new Link('some-uuid-guid'),
  new Link('123456'),
  new Link('New description'),
  new Link('99'),
  new Link('2025-10-13T02:18:28.022Z')
]);

const update = new Link(null, [oldData, newData]);
console.log("Update:", update.toString());

// Deletion: ((...) ()) - replace something with nothing
const deletion = new Link(null, [needData, empty]);
console.log("Deletion:", deletion.toString());

// === Transaction wrapper ===
console.log("\n=== Transaction Format ===\n");

const transaction = new Link(null, [
  new Link('transaction'),
  new Link('0199d636-512d-755d-bb81-b4f6f02f9aac'),
  new Link('2025-10-12T02:18:28.014Z'),
  creation
]);
console.log("Transaction:", transaction.toString());

// Test parsing
console.log("\n=== Parsing Test ===\n");
const parser = new Parser();
const parsed = parser.parse(transaction.toString());
console.log("Parsed back:", JSON.stringify(parsed, null, 2).slice(0, 500));

// Test with strings that need quoting (spaces, special chars)
console.log("\n=== Special Characters ===\n");
const withSpaces = new Link('Looking for a bicycle in good condition');
console.log("With spaces:", withSpaces.toString());

const withQuoted = new Link(null, [
  new Link('need'),
  new Link('guid-here'),
  new Link('"Looking for a bicycle in good condition"')
]);
console.log("With quoted:", withQuoted.toString());
