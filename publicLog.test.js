/**
 * Tests for PublicLog module - deeply nested indented LiNo transaction format.
 *
 * Transaction format:
 *   (
 *     transaction (
 *       guid <txId>
 *       timestamp <iso-timestamp>
 *       change (
 *         ()                              <-- from (empty = create)
 *         (                               <-- to
 *           (
 *             need (
 *               guid <entity-guid>
 *               userId 123456
 *               description 'text'
 *               createdAt <iso-timestamp>
 *             )
 *           )
 *         )
 *       )
 *     )
 *   )
 *
 * Note: channelMessageId is NOT included in transactions because
 * we write to the public log first and get the message ID after.
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

test('PublicLog - log create operation produces deeply nested indented format', async () => {
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

  const text = lastMessage.text;

  // Should start and end with outer parens
  assert.ok(text.startsWith('('), 'Should start with (');
  assert.ok(text.trimEnd().endsWith(')'), 'Should end with )');

  // Should contain transaction keyword
  assert.ok(text.includes('transaction'), 'Should contain transaction keyword');

  // Should contain guid and timestamp fields
  assert.ok(text.includes(`guid ${result.txId}`), 'Should contain transaction guid');
  assert.ok(text.includes('timestamp'), 'Should contain timestamp field');

  // Should contain the change with empty from () and entity data
  assert.ok(text.includes('change ('), 'Should contain change block');
  assert.ok(text.includes('need ('), 'Should contain entity type with nested data');
  assert.ok(text.includes(guid), 'Should include entity guid');
  assert.ok(text.includes('userId'), 'Should include userId field');
  assert.ok(text.includes('description'), 'Should include description field');
});

test('PublicLog - log update operation uses ((...old) (...new)) substitution', async () => {
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

  // Update should contain both old and new entity data
  assert.ok(text.includes('Old description'), 'Should include old description');
  assert.ok(text.includes('Updated description'), 'Should include new description');
  assert.ok(text.includes('resource ('), 'Should include entity type');
  // Should NOT contain an isolated () for create
  // The change block should have two entity blocks, not an empty ()
});

test('PublicLog - log delete operation uses ((...old) ()) substitution', async () => {
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

  // Delete should contain old entity and end with empty ()
  assert.ok(text.includes('Deleted need'), 'Should include old description');
  assert.ok(text.includes('need ('), 'Should include entity type');
  assert.ok(text.includes(guid), 'Should include the guid');
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
  // Batch with 2 changes uses change1, change2 fields
  assert.ok(text.includes('change1 ('), 'Should have change1 for first substitution');
  assert.ok(text.includes('change2 ('), 'Should have change2 for second substitution');
  assert.ok(text.includes('need ('), 'Should include first entity type');
  assert.ok(text.includes('resource ('), 'Should include second entity type');
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
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  const text = mockTelegram.getLastMessage().text;
  // Remove timestamps (ISO format contains colons) and quoted strings
  const noTimestamps = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'TIMESTAMP');
  const noQuoted = noTimestamps.replace(/"[^"]*"/g, 'QUOTED').replace(/'[^']*'/g, 'QUOTED');
  assert.ok(!noQuoted.includes('operation:'), 'Should not contain operation:');
  assert.ok(!noQuoted.includes('entity:'), 'Should not contain entity:');
  assert.ok(!noQuoted.includes('data:'), 'Should not contain data:');
  assert.ok(!noQuoted.includes('userId:'), 'Should not contain userId:');
});

test('PublicLog - no channelMessageId in transaction output', async () => {
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
      description: 'Test',
      createdAt: '2025-10-12T00:00:00.000Z'
    }
  });

  const text = mockTelegram.getLastMessage().text;
  assert.ok(!text.includes('channelMessageId'), 'Transaction should not contain channelMessageId');
});

test('PublicLog - formatEntityIndented creates named-field lines', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const result = publicLog.formatEntityIndented({
    guid: 'test-guid',
    userId: '123',
    description: 'A bicycle',
    createdAt: '2025-10-12T00:00:00.000Z'
  }, 0);

  assert.ok(result.includes('guid test-guid'), 'Should contain guid field');
  assert.ok(result.includes('userId 123'), 'Should contain userId field');
  assert.ok(result.includes('description'), 'Should contain description field');
  assert.ok(result.includes('createdAt'), 'Should contain createdAt field');
});

test('PublicLog - formatTransaction produces correct structure', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const text = publicLog.formatTransaction({
    txId: '019cf18c-351d-71ea-988b-e1ed13d52402',
    timestamp: '2026-03-15T12:50:23.645Z',
    change: {
      operation: 'create',
      entity: 'need',
      data: {
        guid: '019cf18c-351c-75e8-b218-b4a68582ff9e',
        userId: '123456',
        description: 'Looking for a bicycle in good condition',
        createdAt: '2026-03-15T12:50:23.644Z'
      }
    }
  });

  const lines = text.split('\n');
  assert.strictEqual(lines[0], '(', 'First line should be opening paren');
  assert.ok(lines[1].includes('transaction ('), 'Second line should have transaction keyword');
  assert.ok(lines[2].includes('guid 019cf18c-351d'), 'Third line should have guid');
  assert.ok(lines[3].includes('timestamp'), 'Fourth line should have timestamp');
  assert.ok(lines[4].includes('change ('), 'Fifth line should have change block');
  assert.ok(text.includes('need ('), 'Should contain entity type with nested block');
  assert.ok(text.trimEnd().endsWith(')'), 'Should end with closing paren');
});

test('PublicLog - parseTransactionString roundtrip for create', async () => {
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

  assert.strictEqual(parsed.txId, result.txId, 'Parsed txId should match original');
  assert.ok(parsed.timestamp, 'Should have timestamp');
  assert.strictEqual(parsed.operation, 'create', 'Should be create operation');
  assert.strictEqual(parsed.entity, 'need', 'Should be need entity');
  assert.strictEqual(parsed.data.guid, guid, 'Parsed guid should match');
  assert.strictEqual(parsed.data.userId, '123', 'Parsed userId should match');
  assert.strictEqual(parsed.data.description, 'Test', 'Parsed description should match');
});

test('PublicLog - parseTransactionString roundtrip for update', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const text = publicLog.formatTransaction({
    txId: 'test-update-id',
    timestamp: '2026-03-15T13:00:00.000Z',
    change: {
      operation: 'update',
      entity: 'need',
      previousData: { guid: 'g1', userId: '1', description: 'old' },
      data: { guid: 'g1', userId: '1', description: 'new' }
    }
  });

  const parsed = publicLog.parseTransactionString(text);
  assert.strictEqual(parsed.txId, 'test-update-id');
  assert.strictEqual(parsed.operation, 'update');
  assert.strictEqual(parsed.entity, 'need');
  assert.strictEqual(parsed.previousData.description, 'old');
  assert.strictEqual(parsed.data.description, 'new');
});

test('PublicLog - parseTransactionString roundtrip for delete', () => {
  const publicLog = new PublicLog({
    telegram: {},
    logChannel: '@TestChannel',
    tracing: false
  });

  const text = publicLog.formatTransaction({
    txId: 'test-delete-id',
    timestamp: '2026-03-15T14:00:00.000Z',
    change: {
      operation: 'delete',
      entity: 'resource',
      previousData: { guid: 'g2', userId: '2', description: 'removed' }
    }
  });

  const parsed = publicLog.parseTransactionString(text);
  assert.strictEqual(parsed.txId, 'test-delete-id');
  assert.strictEqual(parsed.operation, 'delete');
  assert.strictEqual(parsed.entity, 'resource');
  assert.strictEqual(parsed.previousData.description, 'removed');
});

test('PublicLog - deeply indented format is human readable', async () => {
  const mockTelegram = new MockTelegram();
  const publicLog = new PublicLog({
    telegram: mockTelegram,
    logChannel: '@TestChannel',
    tracing: false
  });

  const guid = uuidv7();
  await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    data: {
      guid,
      userId: '123456',
      description: 'Looking for a bicycle in good condition',
      createdAt: '2026-03-15T12:00:00.000Z'
    }
  });

  const text = mockTelegram.getLastMessage().text;
  const lines = text.trim().split('\n');

  // Verify indentation structure
  assert.strictEqual(lines[0], '(', 'Line 1: opening paren');
  assert.ok(lines[1].match(/^\s+transaction \(/), 'Line 2: indented transaction');
  assert.ok(lines[2].match(/^\s+guid /), 'Line 3: indented guid');
  assert.ok(lines[3].match(/^\s+timestamp /), 'Line 4: indented timestamp');
  assert.ok(lines[4].match(/^\s+change \(/), 'Line 5: indented change block');

  // Entity data should be deeply nested with field names
  assert.ok(text.includes('guid'), 'Should have entity guid field name');
  assert.ok(text.includes('userId'), 'Should have userId field name');
  assert.ok(text.includes('description'), 'Should have description field name');
  assert.ok(text.includes('Looking for a bicycle'), 'Should include description value');
});
