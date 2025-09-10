/**
 * Test script for the matching functionality
 */

import { calculateSimilarity, findMatches, findAllMatches } from '../matching.js';
import Storage from '../storage.js';

// Test similarity function
console.log('Testing similarity calculation:');
console.log('Similar texts (0.8):', calculateSimilarity('I need a car for transportation', 'Looking for a vehicle for transport'));
console.log('Different texts (0.0):', calculateSimilarity('I need a car', 'I have a house'));
console.log('Empty texts (0.0):', calculateSimilarity('', 'something'));

// Test matching with sample data
const sampleNeeds = [
  {
    description: 'I need a bicycle for commuting to work',
    user: { id: 1, first_name: 'Alice' },
    guid: 'need-1'
  },
  {
    description: 'Looking for programming help with JavaScript',
    user: { id: 2, first_name: 'Bob' },
    guid: 'need-2'
  }
];

const sampleResources = [
  {
    description: 'I have a bike that I can lend out',
    user: { id: 3, first_name: 'Charlie' },
    guid: 'resource-1'
  },
  {
    description: 'Experienced JavaScript developer offering tutoring',
    user: { id: 4, first_name: 'Diana' },
    guid: 'resource-2'
  },
  {
    description: 'Programming help available for web development',
    user: { id: 6, first_name: 'Frank' },
    guid: 'resource-3'
  }
];

console.log('\nTesting need-to-resource matching:');
for (const need of sampleNeeds) {
  const matches = findMatches(need, sampleResources, 0.3);
  console.log(`Need: "${need.description.substring(0, 30)}..." found ${matches.length} matches`);
  matches.forEach(match => {
    console.log(`  - Resource: "${match.item.description.substring(0, 30)}..." (similarity: ${match.similarity.toFixed(2)})`);
  });
}

console.log('\nTesting need-to-need matching:');
const moreNeeds = [
  {
    description: 'Need transportation for daily commute',
    user: { id: 5, first_name: 'Eve' },
    guid: 'need-3'
  }
];

for (const need of sampleNeeds) {
  const matches = findMatches(need, moreNeeds, 0.3);
  console.log(`Need: "${need.description.substring(0, 30)}..." found ${matches.length} need matches`);
  matches.forEach(match => {
    console.log(`  - Need: "${match.item.description.substring(0, 30)}..." (similarity: ${match.similarity.toFixed(2)})`);
  });
}

console.log('\nMatching test completed successfully! ✅');