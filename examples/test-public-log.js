/**
 * Example script demonstrating LiNo-based public logging with deeply nested
 * indented transaction format.
 *
 * Each transaction uses link-cli substitution operations:
 *   - Creation: (() ((entity (fields...)))) - replace nothing with a new link
 *   - Update: (((entity (...old))) ((entity (...new)))) - replace old with new
 *   - Deletion: (((entity (...old))) ()) - replace link with nothing
 *
 * Note: channelMessageId is NOT included in transactions because we write
 * to the public log first and get the message ID only after confirmation.
 *
 * Usage:
 *   node examples/test-public-log.js
 */

import PublicLog from '../publicLog.js';
import { v7 as uuidv7 } from 'uuid';

// Mock Telegram API for demonstration
class MockTelegram {
  async sendMessage(channel, text) {
    console.log('\n=== TELEGRAM MESSAGE ===');
    console.log(`Channel: ${channel}`);
    console.log(`\n${text}`);
    console.log('========================\n');

    return {
      message_id: Math.floor(Math.random() * 100000)
    };
  }
}

async function demonstratePublicLog() {
  console.log('Public Log - Deeply Nested Indented Transaction Format Demo');
  console.log('=============================================================\n');

  const publicLog = new PublicLog({
    telegram: new MockTelegram(),
    logChannel: '@PublicLogDemo',
    tracing: true
  });

  // Example 1: Create a need
  console.log('1. Creating a need (replace nothing with new link)...\n');
  const needGuid = uuidv7();
  const createResult = await publicLog.logChange({
    operation: 'create',
    entity: 'need',
    data: {
      guid: needGuid,
      userId: '123456',
      description: 'Looking for a bicycle in good condition',
      createdAt: new Date().toISOString()
    }
  });

  // Example 2: Update a need
  console.log('\n2. Updating a need (replace old link with new link)...\n');
  await publicLog.logChange({
    operation: 'update',
    entity: 'need',
    data: {
      guid: needGuid,
      userId: '123456',
      description: 'Looking for a RED bicycle in good condition',
      updatedAt: new Date().toISOString()
    },
    previousData: {
      guid: needGuid,
      userId: '123456',
      description: 'Looking for a bicycle in good condition',
      createdAt: createResult.timestamp
    }
  });

  // Example 3: Delete a need
  console.log('\n3. Deleting a need (replace link with nothing)...\n');
  await publicLog.logChange({
    operation: 'delete',
    entity: 'need',
    previousData: {
      guid: needGuid,
      userId: '123456',
      description: 'Looking for a RED bicycle in good condition',
      createdAt: createResult.timestamp
    }
  });

  // Example 4: Batch - multiple operations in one transaction
  console.log('\n4. Batch: multiple substitutions in one transaction...\n');
  await publicLog.logBatchChanges([
    {
      operation: 'create',
      entity: 'resource',
      data: {
        guid: uuidv7(),
        userId: '789012',
        description: 'Offering old laptop',
        createdAt: new Date().toISOString()
      }
    },
    {
      operation: 'create',
      entity: 'need',
      data: {
        guid: uuidv7(),
        userId: '345678',
        description: 'Need winter clothes',
        createdAt: new Date().toISOString()
      }
    }
  ]);

  console.log('\n=== Demo Complete ===');
  console.log('\nLink substitution operations (deeply indented):');
  console.log('  Create: (() ((entity (fields...)))) - replace nothing with link');
  console.log('  Update: (((entity (...old))) ((entity (...new)))) - replace old with new');
  console.log('  Delete: (((entity (...old))) ()) - replace link with nothing');
}

demonstratePublicLog().catch(console.error);
