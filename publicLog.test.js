/**
 * Tests for PublicLog module - LiNo link substitution format with lino-objects-codec
 * The new format uses formatIndented for human-readable transactions:
 *   txId
 *     timestamp "..."
 *     change "substitution-string"
 *
 * Entity data uses named fields via jsonToLino:
 *   ((guid ...) (userId ...) (description '...') ...)
 */
import { test } from 'node:test';
import assert from 'node:assert';
import PublicLog from './publicLog.js';
import { parseIndented } from 'lino-objects-codec';
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

  // Verify indented format: first line is the transaction ID
  const text = lastMessage.text;
  const lines = text.trim().split('\n');
  assert.strictEqual(lines[0].trim(), result.txId, 'First line should be the transaction ID');

  // Verify the format is parseable by parseIndented
  const parsed = parseIndented({ text });
  assert.strictEqual(parsed.id, result.txId, 'Parsed id should match txId');
  assert.ok(parsed.obj.timestamp, 'Should have timestamp field');
  assert.ok(parsed.obj.change, 'Should have change field');

  // Verify entity and creation pattern in the change field
  const change = parsed.obj.change;
  assert.ok(change.includes('need'), 'Should include entity type');
  assert.ok(change.includes(guid), 'Should include guid');
  assert.ok(change.startsWith('(()'), 'Change should start with empty-link pattern for creation');
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

  const parsed = parseIndented({ text });
  const change = parsed.obj.change;
  // Update: starts with the entity (non-empty), contains two parts
  assert.ok(change.startsWith('((resource'), 'Update change should start with old entity data');
  assert.ok(change.includes('Old description'), 'Should include old description');
  assert.ok(change.includes('Updated description'), 'Should include new description');
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

  const parsed = parseIndented({ text });
  const change = parsed.obj.change;
  // Delete: ends with ())
  assert.ok(change.endsWith('())'), 'Delete change should end with empty link ()');
  assert.ok(change.startsWith('((need'), 'Delete change should start with old entity data');
  assert.ok(change.includes(guid), 'Should include the guid');
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
  const parsed = parseIndented({ text });
  assert.strictEqual(parsed.id, result.txId, 'Parsed id should match txId');
  // Batch with 2 changes uses change1, change2 fields
  assert.ok(parsed.obj.change1, 'Should have change1 field for first substitution');
  assert.ok(parsed.obj.change2, 'Should have change2 field for second substitution');
  assert.ok(parsed.obj.change1.includes('need'), 'change1 should include first entity type');
  assert.ok(parsed.obj.change2.includes('resource'), 'change2 should include second entity type');
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
  // Remove timestamps (ISO format contains colons) and quoted strings (may contain colons)
  // then check no "key:" patterns remain
  const noTimestamps = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'TIMESTAMP');
  const noQuoted = noTimestamps.replace(/"[^"]*"/g, 'QUOTED');
  assert.ok(!noQuoted.includes('operation:'), 'Should not contain operation:');
  assert.ok(!noQuoted.includes('entity:'), 'Should not contain entity:');
  assert.ok(!noQuoted.includes('data:'), 'Should not contain data:');
  assert.ok(!noQuoted.includes('userId:'), 'Should not contain userId:');
});

test('PublicLog - buildEntityDataLino creates named-field structure', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const linoStr = publicLog.buildEntityDataLino({
    guid: 'test-guid',
    userId: '123',
    description: 'A bicycle',
    channelMessageId: 42,
    createdAt: '2025-10-12T00:00:00.000Z'
  });

  assert.ok(linoStr.includes('guid'), 'Should contain guid field name');
  assert.ok(linoStr.includes('test-guid'), 'Should contain guid value');
  assert.ok(linoStr.includes('userId'), 'Should contain userId field name');
  assert.ok(linoStr.includes('123'), 'Should contain userId value');
  assert.ok(linoStr.includes('description'), 'Should contain description field name');
  assert.ok(linoStr.includes('A bicycle') || linoStr.includes("'A bicycle'"), 'Should contain description value');
  assert.ok(linoStr.includes('channelMessageId'), 'Should contain channelMessageId field name');
  assert.ok(linoStr.includes('42'), 'Should contain channelMessageId value');
  // Each field should appear as a (fieldName value) pair
  assert.ok(linoStr.startsWith('('), 'Should be wrapped in parens');
  assert.ok(linoStr.includes('(guid'), 'Fields should appear as (fieldName value) pairs');
  assert.ok(linoStr.includes('(userId'), 'Fields should appear as (fieldName value) pairs');
});

test('PublicLog - buildSubstitutionString for create returns (() (entity (...)))', () => {
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

  assert.ok(str.startsWith('(()'), 'Should start with empty link (() for creation');
  assert.ok(str.includes('need'), 'Should include entity type');
  assert.ok(str.includes('guid'), 'Should include guid field name');
  assert.ok(str.includes('userId'), 'Should include userId field name');
  assert.ok(str.includes('description'), 'Should include description field name');
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
  assert.ok(str.startsWith('((need'), 'Should start with entity data for deletion');
  assert.ok(str.includes('guid'), 'Should include guid field name');
});

test('PublicLog - indented format is human readable with field names', async () => {
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
      userId: '123456',
      description: 'Looking for a bicycle in good condition',
      channelMessageId: 42,
      createdAt: '2026-03-15T12:00:00.000Z'
    }
  });

  const text = mockTelegram.getLastMessage().text;
  const lines = text.trim().split('\n');

  // Line 1: txId (UUID)
  assert.match(lines[0].trim(), /^[0-9a-f-]{36}$/, 'First line should be a UUID');

  // Line 2: indented timestamp field
  assert.ok(lines[1].trim().startsWith('timestamp '), 'Second line should be timestamp field');

  // Line 3: indented change field
  assert.ok(lines[2].trim().startsWith('change '), 'Third line should be change field');

  // The change value should contain named fields for the entity
  const parsed = parseIndented({ text });
  const change = parsed.obj.change;
  assert.ok(change.includes('guid'), 'Change should have guid field name');
  assert.ok(change.includes('userId'), 'Change should have userId field name');
  assert.ok(change.includes('description'), 'Change should have description field name');
  assert.ok(change.includes('Looking for a bicycle'), 'Change should include description value');
});

test('PublicLog - parseTransactionString roundtrip', async () => {
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
    data: { guid, userId: '123', description: 'Test', createdAt: '2026-03-15T12:00:00.000Z' }
  });

  const text = mockTelegram.getLastMessage().text;
  const parsed = publicLog.parseTransactionString(text);

  assert.strictEqual(parsed.id, result.txId, 'Parsed id should match original txId');
  assert.ok(parsed.obj.timestamp, 'Should have timestamp');
  assert.ok(parsed.obj.change, 'Should have change');
  assert.ok(parsed.obj.change.includes(guid), 'Change should include the guid');
});
