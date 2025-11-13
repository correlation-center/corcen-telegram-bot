/**
 * Tests for PublicLog module
 */
import { test } from 'node:test';
import assert from 'node:assert';
import PublicLog from './publicLog.js';
import { v7 as uuidv7 } from 'uuid';

// Mock Telegram API
class MockTelegram {
  constructor() {
    this.messages = [];
  }

  async sendMessage(channel, text, options) {
    const messageId = this.messages.length + 1;
    this.messages.push({ channel, text, options, messageId });
    return { message_id: messageId };
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
}

test('PublicLog - log create operation', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const result = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    userId: '123',
    data: {
      guid: uuidv7(),
      description: 'Test need',
      createdAt: new Date().toISOString()
    }
  });

  assert.ok(result.txId, 'Should return transaction ID');
  assert.ok(result.messageId, 'Should return message ID');
  assert.strictEqual(result.confirmed, true, 'Should be confirmed');
  assert.strictEqual(mockTelegram.messages.length, 1, 'Should send one message');

  const lastMessage = mockTelegram.getLastMessage();
  assert.strictEqual(lastMessage.channel, '@TestChannel', 'Should send to correct channel');
  assert.ok(lastMessage.text.includes('Transaction:'), 'Should include transaction header');
  assert.ok(lastMessage.text.includes('operation: create'), 'Should include operation');
  assert.ok(lastMessage.text.includes('entity: need'), 'Should include entity type');
});

test('PublicLog - log update operation', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const result = await publicLog.logChange({
    operation: 'update',
    entity: 'resource',
    userId: '456',
    data: {
      guid: uuidv7(),
      description: 'Updated description'
    },
    previousData: {
      description: 'Old description'
    }
  });

  assert.ok(result.confirmed, 'Should be confirmed');
  const lastMessage = mockTelegram.getLastMessage();
  assert.ok(lastMessage.text.includes('previousData:'), 'Should include previous data');
});

test('PublicLog - batch changes', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const changes = [
    { operation: 'create', entity: 'need', userId: '1', data: { description: 'A' } },
    { operation: 'create', entity: 'resource', userId: '2', data: { description: 'B' } }
  ];

  const result = await publicLog.logBatchChanges(changes);

  assert.ok(result.txId, 'Should return transaction ID');
  assert.ok(result.confirmed, 'Should be confirmed');
  const lastMessage = mockTelegram.getLastMessage();
  assert.ok(lastMessage.text.includes('Batch Transaction'), 'Should be batch transaction');
  assert.ok(lastMessage.text.includes('2 changes'), 'Should show change count');
});

test('PublicLog - no channel configured', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: null, // No channel
    tracing: false
  });

  const result = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    userId: '123',
    data: { description: 'Test' }
  });

  assert.ok(result.txId, 'Should still return transaction ID');
  assert.strictEqual(result.messageId, null, 'Should not have message ID');
  assert.strictEqual(result.confirmed, true, 'Should be confirmed (local-only mode)');
  assert.strictEqual(mockTelegram.messages.length, 0, 'Should not send any messages');
});

test('PublicLog - handles telegram errors gracefully', async () => {
  class ErrorTelegram {
    async sendMessage() {
      throw new Error('Network error');
    }
  }

  const publicLog = new PublicLog({
    telegram: new ErrorTelegram(),
    logChannel: '@TestChannel',
    tracing: false
  });

  const result = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    userId: '123',
    data: { description: 'Test' }
  });

  assert.ok(result.txId, 'Should return transaction ID');
  assert.strictEqual(result.messageId, null, 'Should not have message ID');
  assert.strictEqual(result.confirmed, false, 'Should not be confirmed');
  assert.ok(result.error, 'Should include error message');
});
