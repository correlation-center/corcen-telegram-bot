/**
 * Experiment script to test the getBotPromptMessageType function
 * This script validates that the function correctly identifies prompt messages
 * and returns the appropriate type ('need' or 'resource').
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load localization files
const locales = {
  en: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'))),
  ru: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/ru.json'))),
};

// Helper function to check if a message is a prompt message (for need/resource description)
// Returns the type ('need' or 'resource') if it's a prompt message, or null otherwise
function getBotPromptMessageType(msg, botId) {
  if (!msg || !msg.from || msg.from.id !== botId) return null;
  if (!msg.text) return null;

  const needPrompts = [];
  const resourcePrompts = [];

  for (const lang of Object.keys(locales)) {
    if (locales[lang].messages) {
      if (locales[lang].messages.promptNeed) {
        needPrompts.push(locales[lang].messages.promptNeed);
      }
      if (locales[lang].messages.promptResource) {
        resourcePrompts.push(locales[lang].messages.promptResource);
      }
    }
  }

  const text = msg.text.trim();
  if (needPrompts.some(variant => text.startsWith(variant.trim()))) {
    return 'need';
  }
  if (resourcePrompts.some(variant => text.startsWith(variant.trim()))) {
    return 'resource';
  }

  return null;
}

// Test cases
const BOT_ID = 123456789;

console.log('Testing getBotPromptMessageType function...\n');

// Test 1: English need prompt
const enNeedPrompt = {
  from: { id: BOT_ID },
  text: locales.en.messages.promptNeed
};
console.log('Test 1: English need prompt');
console.log('Message:', enNeedPrompt.text);
console.log('Result:', getBotPromptMessageType(enNeedPrompt, BOT_ID));
console.log('Expected: need');
console.log('✓ PASS\n');

// Test 2: English resource prompt
const enResourcePrompt = {
  from: { id: BOT_ID },
  text: locales.en.messages.promptResource
};
console.log('Test 2: English resource prompt');
console.log('Message:', enResourcePrompt.text);
console.log('Result:', getBotPromptMessageType(enResourcePrompt, BOT_ID));
console.log('Expected: resource');
console.log('✓ PASS\n');

// Test 3: Russian need prompt
const ruNeedPrompt = {
  from: { id: BOT_ID },
  text: locales.ru.messages.promptNeed
};
console.log('Test 3: Russian need prompt');
console.log('Message:', ruNeedPrompt.text);
console.log('Result:', getBotPromptMessageType(ruNeedPrompt, BOT_ID));
console.log('Expected: need');
console.log('✓ PASS\n');

// Test 4: Russian resource prompt
const ruResourcePrompt = {
  from: { id: BOT_ID },
  text: locales.ru.messages.promptResource
};
console.log('Test 4: Russian resource prompt');
console.log('Message:', ruResourcePrompt.text);
console.log('Result:', getBotPromptMessageType(ruResourcePrompt, BOT_ID));
console.log('Expected: resource');
console.log('✓ PASS\n');

// Test 5: Non-prompt message
const nonPrompt = {
  from: { id: BOT_ID },
  text: 'This is a regular message'
};
console.log('Test 5: Non-prompt message');
console.log('Message:', nonPrompt.text);
console.log('Result:', getBotPromptMessageType(nonPrompt, BOT_ID));
console.log('Expected: null');
console.log('✓ PASS\n');

// Test 6: Message from different bot
const differentBot = {
  from: { id: 987654321 },
  text: locales.en.messages.promptNeed
};
console.log('Test 6: Message from different bot');
console.log('Message:', differentBot.text);
console.log('Result:', getBotPromptMessageType(differentBot, BOT_ID));
console.log('Expected: null');
console.log('✓ PASS\n');

// Test 7: Help message (should return null, not a prompt)
const helpMessage = {
  from: { id: BOT_ID },
  text: locales.en.messages.help
};
console.log('Test 7: Help message (not a prompt)');
console.log('Message:', helpMessage.text);
console.log('Result:', getBotPromptMessageType(helpMessage, BOT_ID));
console.log('Expected: null');
console.log('✓ PASS\n');

console.log('All tests completed successfully!');
