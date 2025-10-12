/**
 * Example script demonstrating LiNo-based public logging functionality.
 *
 * This script shows how database changes are logged to a Telegram channel
 * in LiNo (Links Notation) format, creating a transparent audit trail.
 *
 * Usage:
 *   node examples/test-public-log.js
 */

import PublicLog from '../publicLog.js';
import { v7 as uuidv7 } from 'uuid';

// Mock Telegram API for demonstration
class MockTelegram {
  async sendMessage(channel, text, options) {
    console.log('\n=== MOCK TELEGRAM MESSAGE ===');
    console.log(`Channel: ${channel}`);
    console.log(`Parse mode: ${options?.parse_mode || 'none'}`);
    console.log('\nMessage content:');
    console.log(text);
    console.log('=============================\n');

    return {
      message_id: Math.floor(Math.random() * 100000)
    };
  }
}

async function demonstratePublicLog() {
  console.log('Public Log Demonstration');
  console.log('========================\n');

  // Create PublicLog instance with mock Telegram
  const publicLog = new PublicLog({
    telegram: new MockTelegram(),
    logChannel: '@PublicLogDemo',
    tracing: true
  });

  // Example 1: Log a new user creation
  console.log('1. Creating a new user...\n');
  const tx1 = await publicLog.logChange({
    operation: 'create',
    entity: 'user',
    userId: '123456',
    data: {
      needs: 0,
      resources: 0
    }
  });
  console.log('Transaction result:', tx1);

  // Example 2: Log adding a need
  console.log('\n2. Adding a need for user...\n');
  const tx2 = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    userId: '123456',
    data: {
      guid: uuidv7(),
      description: 'Looking for a bicycle in good condition',
      channelMessageId: 42,
      createdAt: new Date().toISOString()
    }
  });
  console.log('Transaction result:', tx2);

  // Example 3: Log updating a need
  console.log('\n3. Updating a need (bump)...\n');
  const tx3 = await publicLog.logChange({
    operation: 'update',
    entity: 'need',
    userId: '123456',
    data: {
      guid: uuidv7(),
      description: 'Looking for a bicycle in good condition',
      channelMessageId: 99,
      updatedAt: new Date().toISOString()
    },
    previousData: {
      description: 'Looking for a bicycle in good condition',
      channelMessageId: 42
    }
  });
  console.log('Transaction result:', tx3);

  // Example 4: Log batch changes
  console.log('\n4. Logging batch changes...\n');
  const tx4 = await publicLog.logBatchChanges([
    {
      operation: 'create',
      entity: 'resource',
      userId: '789012',
      data: { guid: uuidv7(), description: 'Offering old laptop' }
    },
    {
      operation: 'create',
      entity: 'need',
      userId: '345678',
      data: { guid: uuidv7(), description: 'Need winter clothes' }
    },
    {
      operation: 'delete',
      entity: 'resource',
      userId: '123456',
      previousData: { guid: uuidv7(), description: 'No longer available' }
    }
  ]);
  console.log('Batch transaction result:', tx4);

  console.log('\n=== Demonstration Complete ===');
  console.log('\nKey features demonstrated:');
  console.log('- UUIDv7 transaction IDs for ordering');
  console.log('- LiNo format for structured data representation');
  console.log('- Support for create, update, and delete operations');
  console.log('- Batch transaction logging');
  console.log('- Asynchronous confirmation mechanism');
}

// Run demonstration
demonstratePublicLog().catch(console.error);
