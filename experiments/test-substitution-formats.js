import { Parser, Link } from '@linksplatform/protocols-lino';

const parser = new Parser();

// Test: how does link-cli format actually parse?
// link-cli uses: () ((1 1))
// That's TWO separate expressions, not one wrapping link

// Let's try explicit format from link-cli docs
const tests = [
  '(() (need g1 123))',          // creation attempt 1
  '(() ((need g1 123)))',        // creation attempt 2  
  '(()) ((need g1 123))',        // creation attempt 3 - two separate links
  '() (need g1 123)',            // creation attempt 4 - two separate links at top
];

for (const t of tests) {
  console.log(`Input: ${t}`);
  try {
    const parsed = parser.parse(t);
    console.log(`  Parsed: ${parsed.length} links`);
    for (let i = 0; i < parsed.length; i++) {
      const link = parsed[i];
      console.log(`  [${i}] id=${link.id}, values.length=${link.values.length}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  console.log();
}

// Looking at this from the right angle:
// In link-cli, a substitution is expressed as TWO links: pattern and replacement
// So for a transaction containing a substitution, we need a way to clearly separate them

// Option: use an explicit "change" wrapper with two children
const change = new Link(null, [
  new Link(null, []),   // from (empty = creation)
  new Link(null, [new Link('need'), new Link('g1'), new Link('123')])  // to
]);
console.log("Change link:", change.toString());
const changeParsed = parser.parse(change.toString());
console.log("Change parsed:", JSON.stringify(changeParsed, null, 2));
