/**
 * Tests for PublicLog module - LiNo link substitution format
 */
import { test } from 'node:test';
import assert from 'node:assert';
import PublicLog from './publicLog.js';
import { Parser, Link } from '@linksplatform/protocols-lino';
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

test('PublicLog - log create operation uses (() (...)) substitution', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const guid = uuidv7();
  const result = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    data: {
      guid,
      userId: '123',
      description: 'Test need',
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  assert.ok(result.txId, 'Should return transaction ID');
  assert.ok(result.messageId, 'Should return message ID');
  assert.strictEqual(result.confirmed, true, 'Should be confirmed');
  assert.strictEqual(mockTelegram.messages.length, 1, 'Should send one message');

  const lastMessage = mockTelegram.getLastMessage();
  assert.strictEqual(lastMessage.channel, '@TestChannel', 'Should send to correct channel');

  // Verify LiNo format: should contain transaction wrapper and substitution
  const text = lastMessage.text;
  assert.ok(text.includes('transaction'), 'Should include transaction keyword');
  assert.ok(text.includes('need'), 'Should include entity type');
  assert.ok(text.includes(guid), 'Should include guid');

  // Verify it's parseable by LiNo parser
  const parser = new Parser();
  const parsed = parser.parse(text);
  assert.ok(parsed.length > 0, 'Should be parseable as LiNo');

  // Verify substitution structure: the 4th value should be the substitution (() (...))
  const txLink = parsed[0];
  assert.strictEqual(txLink.values[0].id, 'transaction', 'First value should be transaction');
  const substitution = txLink.values[3];
  // First element of substitution should be empty (creation)
  assert.strictEqual(substitution.values[0].values.length, 0, 'First element should be empty () for creation');
  // Second element should have the entity data
  assert.strictEqual(substitution.values[1].values[0].id, 'need', 'Second element should start with entity type');
});

test('PublicLog - log update operation uses ((...) (...)) substitution', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const guid = uuidv7();
  const result = await publicLog.logChange({
    operation: 'update',
    entity: 'resource',
    data: {
      guid,
      userId: '456',
      description: 'Updated description',
      updatedAt: '2025-10-13T00:00:00.000Z'
    },
    previousData: {
      guid,
      userId: '456',
      description: 'Old description',
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  assert.ok(result.confirmed, 'Should be confirmed');
  const text = mockTelegram.getLastMessage().text;

  // Parse and verify substitution structure
  const parser = new Parser();
  const parsed = parser.parse(text);
  const substitution = parsed[0].values[3];
  // Both elements should be non-empty for update
  assert.ok(substitution.values[0].values.length > 0, 'First element should have old data for update');
  assert.ok(substitution.values[1].values.length > 0, 'Second element should have new data for update');
});

test('PublicLog - log delete operation uses ((...) ()) substitution', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const guid = uuidv7();
  const result = await publicLog.logChange({
    operation: 'delete',
    entity: 'need',
    previousData: {
      guid,
      userId: '123',
      description: 'Deleted need',
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  assert.ok(result.confirmed, 'Should be confirmed');
  const text = mockTelegram.getLastMessage().text;

  // Parse and verify substitution structure
  const parser = new Parser();
  const parsed = parser.parse(text);
  const substitution = parsed[0].values[3];
  // First element should have data, second should be empty (deletion)
  assert.ok(substitution.values[0].values.length > 0, 'First element should have old data for deletion');
  assert.strictEqual(substitution.values[1].values.length, 0, 'Second element should be empty () for deletion');
});

test('PublicLog - batch changes', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const changes = [
    {
      operation: 'create',
      entity: 'need',
      data: { guid: uuidv7(), userId: '1', description: 'A', createdAt: '2025-10-12T00:00:00.000Z' }
    },
    {
      operation: 'create',
      entity: 'resource',
      data: { guid: uuidv7(), userId: '2', description: 'B', createdAt: '2025-10-12T00:00:00.000Z' }
    }
  ];

  const result = await publicLog.logBatchChanges(changes);

  assert.ok(result.txId, 'Should return transaction ID');
  assert.ok(result.confirmed, 'Should be confirmed');

  const text = mockTelegram.getLastMessage().text;
  assert.ok(text.includes('transaction'), 'Should contain transaction');

  // Should be parseable
  const parser = new Parser();
  const parsed = parser.parse(text);
  // Transaction should have: transaction, txId, timestamp, sub1, sub2
  assert.ok(parsed[0].values.length >= 5, 'Should have at least 5 values (transaction + id + time + 2 subs)');
});

test('PublicLog - no channel configured', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: null,
    tracing: false
  });

  const result = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    data: { guid: uuidv7(), userId: '123', description: 'Test' }
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
    data: { guid: uuidv7(), userId: '123', description: 'Test' }
  });

  assert.ok(result.txId, 'Should return transaction ID');
  assert.strictEqual(result.messageId, null, 'Should not have message ID');
  assert.strictEqual(result.confirmed, false, 'Should not be confirmed');
  assert.ok(result.error, 'Should include error message');
});

test('PublicLog - LiNo output contains no colons in data fields', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    data: {
      guid: 'test-guid',
      userId: '123',
      description: 'Simple test',
      channelMessageId: 42,
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  const text = mockTelegram.getLastMessage().text;
  // The LiNo format should not use colons for field names
  // (colons in LiNo mean globally unique link identifiers)
  // Only acceptable colons are in timestamps and the "transaction" identifier if used as id
  const nonTimestampText = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'TIMESTAMP');
  // Check that there are no "key:" patterns (like "operation:", "entity:", "data:")
  assert.ok(!nonTimestampText.includes('operation:'), 'Should not contain operation:');
  assert.ok(!nonTimestampText.includes('entity:'), 'Should not contain entity:');
  assert.ok(!nonTimestampText.includes('data:'), 'Should not contain data:');
  assert.ok(!nonTimestampText.includes('userId:'), 'Should not contain userId:');
});

test('PublicLog - buildEntityLink creates correct structure', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const link = publicLog.buildEntityLink('need', {
    guid: 'test-guid',
    userId: '123',
    description: 'A bicycle',
    channelMessageId: 42,
    createdAt: '2025-10-12T00:00:00.000Z'
  });

  const str = link.toString();
  assert.ok(str.includes('need'), 'Should contain entity type');
  assert.ok(str.includes('test-guid'), 'Should contain guid');
  assert.ok(str.includes('123'), 'Should contain userId');
  assert.ok(str.includes('A bicycle') || str.includes("'A bicycle'"), 'Should contain description');
  assert.ok(str.includes('42'), 'Should contain channelMessageId');
});

test('PublicLog - buildSubstitutionString for create returns (() (...))', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const str = publicLog.buildSubstitutionString({
    operation: 'create',
    entity: 'need',
    data: { guid: 'g1', userId: '1', description: 'test' }
  });

  assert.ok(str.startsWith('('), 'Should be wrapped in parens');
  assert.ok(str.startsWith('(()'), 'Should start with empty link (() for creation');
  // Parse to verify structure
  const parser = new Parser();
  const parsed = parser.parse(str);
  assert.strictEqual(parsed[0].values[0].values.length, 0, 'First value should be empty link');
  assert.ok(parsed[0].values[1].values.length > 0, 'Second value should have data');
});

test('PublicLog - buildSubstitutionString for delete returns ((...) ())', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const str = publicLog.buildSubstitutionString({
    operation: 'delete',
    entity: 'need',
    previousData: { guid: 'g1', userId: '1', description: 'test' }
  });

  assert.ok(str.endsWith('())'), 'Should end with empty link ()) for deletion');
  const parser = new Parser();
  const parsed = parser.parse(str);
  assert.ok(parsed[0].values[0].values.length > 0, 'First value should have data');
  assert.strictEqual(parsed[0].values[1].values.length, 0, 'Second value should be empty link');
});
