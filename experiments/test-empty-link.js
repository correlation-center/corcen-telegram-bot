import { Parser, Link } from '@linksplatform/protocols-lino';

const parser = new Parser();

const empty = new Link(null, []);
console.log("Empty toString:", JSON.stringify(empty.toString()));
console.log("Empty format(false):", JSON.stringify(empty.format(false)));
console.log("Empty format(true):", JSON.stringify(empty.format(true)));

const data = new Link(null, [new Link('need'), new Link('g1')]);
console.log("\nData toString:", data.toString());

// Build the substitution manually
const sub = new Link(null, [empty, data]);
console.log("\nSub toString:", JSON.stringify(sub.toString()));
// The issue: empty.format() returns "()" but when used as a value in another link,
// the formatValue method might strip the parens

// Let's check what formatValue does with the empty link
console.log("\nformatValue of empty:", sub.formatValue(empty));
console.log("formatValue of data:", sub.formatValue(data));

// Try alternative: use a token like "void" instead of empty link for clarity
const subWithVoid = new Link(null, [new Link('void'), data]);
console.log("\nWith void:", subWithVoid.toString());

// Or just use the string directly - build LiNo string manually
const manualCreation = `(() (need g1 123))`;
console.log("\nManual string:", manualCreation);
const parsed = parser.parse(manualCreation);
console.log("Parsed:", JSON.stringify(parsed, null, 2));
console.log("Values count:", parsed[0].values.length);
console.log("Values[0]:", JSON.stringify(parsed[0].values[0]));
console.log("Values[1]:", JSON.stringify(parsed[0].values[1]));
