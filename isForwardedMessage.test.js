import assert from 'assert';
import { describe, it } from 'node:test';

// Import the helper function from index.js
// Since index.js runs the bot, we need to extract just the function for testing
// For now, we'll duplicate the function here for testing purposes
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

describe('isForwardedMessage', () => {
  describe('Normal messages (not forwarded)', () => {
    it('returns false for regular message with text', () => {
      const message = { text: '/help', from: { id: 123 } };
      assert.strictEqual(isForwardedMessage(message), false);
    });

    it('returns false for message with only basic fields', () => {
      const message = {
        message_id: 1,
        date: 1234567890,
        chat: { id: 123 },
        from: { id: 456 }
      };
      assert.strictEqual(isForwardedMessage(message), false);
    });

    it('returns false for null message', () => {
      assert.strictEqual(isForwardedMessage(null), false);
    });

    it('returns false for undefined message', () => {
      assert.strictEqual(isForwardedMessage(undefined), false);
    });
  });

  describe('Forwarded messages - Old API', () => {
    it('returns true when forward_from is present', () => {
      const message = {
        text: '/help',
        forward_from: { id: 456, first_name: 'John' },
        forward_date: 1234567890
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true when forward_from_chat is present', () => {
      const message = {
        text: '/help',
        forward_from_chat: { id: -100123, type: 'channel', title: 'Test Channel' },
        forward_date: 1234567890
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true when only forward_date is present', () => {
      const message = {
        text: '/help',
        forward_date: 1234567890
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true for forwarded message from channel', () => {
      const message = {
        text: '/help',
        forward_from_chat: {
          id: -1001234567890,
          username: 'CorrelationCenter',
          type: 'channel',
          title: 'Correlation Center'
        },
        forward_date: 1234567890,
        forward_from_message_id: 123
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });
  });

  describe('Forwarded messages - New API (Bot API 7.0+)', () => {
    it('returns true when forward_origin is present (user)', () => {
      const message = {
        text: '/help',
        forward_origin: {
          type: 'user',
          date: 1234567890,
          sender_user: { id: 456, first_name: 'John' }
        }
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true when forward_origin is present (hidden user)', () => {
      const message = {
        text: '/help',
        forward_origin: {
          type: 'hidden_user',
          date: 1234567890,
          sender_user_name: 'John Doe'
        }
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true when forward_origin is present (chat)', () => {
      const message = {
        text: '/help',
        forward_origin: {
          type: 'chat',
          date: 1234567890,
          sender_chat: { id: -100123, type: 'group', title: 'Test Group' }
        }
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('returns true when forward_origin is present (channel)', () => {
      const message = {
        text: '/help',
        forward_origin: {
          type: 'channel',
          date: 1234567890,
          chat: { id: -1001234567890, username: 'CorrelationCenter', type: 'channel', title: 'Correlation Center' },
          message_id: 123
        }
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });
  });

  describe('Mixed scenarios', () => {
    it('returns true when both old and new API fields are present', () => {
      const message = {
        text: '/help',
        forward_origin: { type: 'user', date: 1234567890 },
        forward_from: { id: 456, first_name: 'John' },
        forward_date: 1234567890
      };
      assert.strictEqual(isForwardedMessage(message), true);
    });

    it('handles commands in forwarded messages', () => {
      const commands = ['/help', '/start', '/need', '/resource', '/get', '/give', '/needs', '/resources', '/cancel'];

      for (const command of commands) {
        const message = {
          text: command,
          forward_date: 1234567890
        };
        assert.strictEqual(
          isForwardedMessage(message),
          true,
          `Command ${command} should be detected as forwarded`
        );
      }
    });
  });
});
