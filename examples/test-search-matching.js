// Test script for search matching logic
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the search function (we'll need to extract it from index.js)
function matchesSearchQuery(searchQuery, resourceDescription) {
  if (!searchQuery || !resourceDescription) return false;
  
  const queryTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  const description = resourceDescription.toLowerCase();
  
  // All query terms must be present in the description (AND logic)
  return queryTerms.every(term => description.includes(term));
}

// Test cases
const testCases = [
  // Basic matching
  { query: "laptop", resource: "MacBook Pro laptop for sale", expected: true },
  { query: "laptop", resource: "Desktop computer for sale", expected: false },
  
  // Multi-word matching (AND logic)
  { query: "laptop gaming", resource: "Gaming laptop with RTX 4090", expected: true },
  { query: "laptop gaming", resource: "Laptop for office work", expected: false },
  { query: "laptop gaming", resource: "Gaming desktop computer", expected: false },
  
  // Case insensitive
  { query: "LAPTOP", resource: "laptop for sale", expected: true },
  { query: "laptop", resource: "LAPTOP FOR SALE", expected: true },
  
  // Partial word matching
  { query: "car", resource: "Used car for sale", expected: true },
  { query: "car", resource: "Carrot from my garden", expected: true }, // This might be a false positive
  
  // Empty queries
  { query: "", resource: "Some resource", expected: false },
  { query: "laptop", resource: "", expected: false },
  { query: "", resource: "", expected: false },
  
  // Complex queries
  { query: "python programming book", resource: "Learn Python programming with this comprehensive book", expected: true },
  { query: "python programming book", resource: "Java programming guide", expected: false },
];

console.log("Testing search matching logic:");
console.log("================================");

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = matchesSearchQuery(testCase.query, testCase.resource);
  const status = result === testCase.expected ? "✅ PASS" : "❌ FAIL";
  
  console.log(`${status} Query: "${testCase.query}"`);
  console.log(`      Resource: "${testCase.resource}"`);
  console.log(`      Expected: ${testCase.expected}, Got: ${result}`);
  console.log();
  
  if (result === testCase.expected) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);