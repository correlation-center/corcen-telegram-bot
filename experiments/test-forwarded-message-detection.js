// Test script to understand forwarded message detection in Telegraf
// This helps us verify our implementation approach

/**
 * Check if a message is forwarded
 * According to Telegram Bot API:
 * - New API (Bot API 7.0+): ctx.message.forward_origin exists
 * - Old API (still supported): ctx.message.forward_from, forward_from_chat, or forward_date exists
 */
function isForwardedMessage(message) {
  if (!message) return false;

  // Check new API field (Bot API 7.0+)
  if (message.forward_origin) {
    return true;
  }

  // Check old API fields (for backwards compatibility)
  if (message.forward_from || message.forward_from_chat || message.forward_date) {
    return true;
  }

  return false;
}

// Test cases
const testCases = [
  {
    name: 'Normal message',
    message: { text: '/help', from: { id: 123 } },
    expected: false
  },
  {
    name: 'Forwarded from user (old API)',
    message: { text: '/help', forward_from: { id: 456 }, forward_date: 1234567890 },
    expected: true
  },
  {
    name: 'Forwarded from channel (old API)',
    message: { text: '/help', forward_from_chat: { id: -100123 }, forward_date: 1234567890 },
    expected: true
  },
  {
    name: 'Forwarded with new API',
    message: { text: '/help', forward_origin: { type: 'user', date: 1234567890 } },
    expected: true
  },
  {
    name: 'Forwarded with forward_date only',
    message: { text: '/help', forward_date: 1234567890 },
    expected: true
  }
];

console.log('Testing forwarded message detection:\n');
let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = isForwardedMessage(test.message);
  const status = result === test.expected ? '✓ PASS' : '✗ FAIL';

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status}: ${test.name}`);
  console.log(`  Expected: ${test.expected}, Got: ${result}`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
