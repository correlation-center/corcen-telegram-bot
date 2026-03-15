/**
 * Test script to demonstrate the bot detection bug
 *
 * Issue: isOnlyBotInChat function incorrectly compares bot IDs
 *
 * The bug is on line 288 of index.js:
 * ```
 * const otherBots = administrators.filter(admin =>
 *   admin.user.is_bot && admin.user.id !== ctx.from.id  // BUG: ctx.from.id is USER's ID, not BOT's ID
 * );
 * ```
 *
 * What happens:
 * 1. User sends /start command
 * 2. ctx.from.id = user's ID (e.g., 123456789)
 * 3. Bot checks administrators list
 * 4. Bot finds itself in administrators list with id = bot's ID (e.g., 987654321)
 * 5. Compares: 987654321 !== 123456789 → TRUE
 * 6. Bot thinks "there's another bot!" (but it's actually itself)
 * 7. Bot doesn't respond to /start without @mention
 *
 * The fix:
 * Change `ctx.from.id` to `bot.botInfo.id` to correctly identify the bot itself
 */

// Simulate the bug
function buggyIsOnlyBotInChat() {
  const userId = 123456789; // ctx.from.id (the user who sent the command)
  const botId = 987654321; // bot.botInfo.id (the actual bot)

  const administrators = [
    { user: { id: botId, is_bot: true, username: 'CorrelationCenterBot' } },
    { user: { id: userId, is_bot: false, username: 'konstantinDyachenko' } }
  ];

  // BUGGY CODE: compares bot's ID with user's ID
  const otherBots = administrators.filter(admin =>
    admin.user.is_bot && admin.user.id !== userId // BUG HERE!
  );

  console.log('Buggy behavior:');
  console.log('  User ID:', userId);
  console.log('  Bot ID:', botId);
  console.log('  Found "other" bots:', otherBots.length);
  console.log('  Bot thinks it should respond:', otherBots.length === 0);
  console.log('');

  return otherBots.length === 0;
}

// Simulate the fix
function fixedIsOnlyBotInChat() {
  const userId = 123456789; // ctx.from.id (the user who sent the command)
  const botId = 987654321; // bot.botInfo.id (the actual bot)

  const administrators = [
    { user: { id: botId, is_bot: true, username: 'CorrelationCenterBot' } },
    { user: { id: userId, is_bot: false, username: 'konstantinDyachenko' } }
  ];

  // FIXED CODE: compares bot's ID with bot's ID
  const otherBots = administrators.filter(admin =>
    admin.user.is_bot && admin.user.id !== botId // FIX: use bot.botInfo.id
  );

  console.log('Fixed behavior:');
  console.log('  User ID:', userId);
  console.log('  Bot ID:', botId);
  console.log('  Found "other" bots:', otherBots.length);
  console.log('  Bot thinks it should respond:', otherBots.length === 0);
  console.log('');

  return otherBots.length === 0;
}

console.log('=== Bot Detection Bug Demonstration ===\n');
console.log('Scenario: User sends /start in a group chat with only one bot (our bot)\n');

const buggyResult = buggyIsOnlyBotInChat();
const fixedResult = fixedIsOnlyBotInChat();

console.log('Summary:');
console.log('  Buggy version thinks it should respond:', buggyResult, '❌');
console.log('  Fixed version thinks it should respond:', fixedResult, '✅');
