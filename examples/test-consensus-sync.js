// Test script for consensus sync functionality

import { TelegramAdapter, VKAdapter } from './platform-adapter.js';
import { ConsensusSyncService } from './consensus-sync.js';

/**
 * Mock storage for testing
 */
class MockStorage {
  constructor() {
    this.db = {
      data: {
        users: {
          "12345": {
            needs: [
              {
                guid: "test-need-1",
                description: "Looking for help with JavaScript development",
                createdAt: "2025-09-10T10:00:00.000Z",
                updatedAt: "2025-09-10T10:00:00.000Z",
                user: {
                  id: 12345,
                  username: "testuser",
                  first_name: "Test",
                  last_name: "User"
                },
                requestor: "testuser",
                channelMessageId: 100,
                originPlatform: "telegram",
                platforms: {
                  telegram: {
                    channelMessageId: 100,
                    syncedAt: "2025-09-10T10:00:00.000Z"
                  }
                },
                syncStatus: "pending"
              }
            ],
            resources: [
              {
                guid: "test-resource-1", 
                description: "Offering Python tutoring services",
                createdAt: "2025-09-10T09:30:00.000Z",
                updatedAt: "2025-09-10T09:30:00.000Z",
                user: {
                  id: 12345,
                  username: "testuser",
                  first_name: "Test",
                  last_name: "User"
                },
                supplier: "testuser",
                channelMessageId: 99,
                originPlatform: "telegram",
                platforms: {
                  telegram: {
                    channelMessageId: 99,
                    syncedAt: "2025-09-10T09:30:00.000Z"
                  }
                },
                syncStatus: "pending"
              }
            ]
          }
        },
        consensus: {
          lastSync: null,
          conflicts: [],
          platformStates: {}
        }
      }
    };
  }

  async readDB() {
    // Mock read operation
    console.log('MockStorage: Reading database...');
  }

  async writeDB() {
    // Mock write operation
    console.log('MockStorage: Writing database...');
    console.log('Current data:', JSON.stringify(this.db.data, null, 2));
  }
}

/**
 * Mock Telegram adapter for testing
 */
class MockTelegramAdapter extends TelegramAdapter {
  constructor() {
    super(null, '@TestChannel');
    this.messageCounter = 200;
  }

  async postMessage(content, options = {}) {
    console.log(`MockTelegram: Posting message to ${this.channelUsername}`);
    console.log(`Content: ${content}`);
    if (options.fileId) {
      console.log(`With file: ${options.fileId}`);
    }
    
    return {
      messageId: ++this.messageCounter,
      platform: this.platformName,
      success: true
    };
  }

  async editMessage(messageId, content, options = {}) {
    console.log(`MockTelegram: Editing message ${messageId}`);
    console.log(`New content: ${content}`);
    return true;
  }

  async deleteMessage(messageId) {
    console.log(`MockTelegram: Deleting message ${messageId}`);
    return true;
  }

  async getUserInfo(userId) {
    return {
      id: userId,
      username: 'mockuser',
      first_name: 'Mock',
      last_name: 'User',
      platform: this.platformName
    };
  }
}

/**
 * Mock VK adapter for testing
 */
class MockVKAdapter extends VKAdapter {
  constructor() {
    super({ token: 'mock-token', groupId: 123456 });
    this.postCounter = 300;
  }

  async postMessage(content, options = {}) {
    console.log(`MockVK: Posting to group ${this.groupId}`);
    console.log(`Content: ${content}`);
    if (options.attachments) {
      console.log(`With attachments: ${options.attachments}`);
    }
    
    return {
      messageId: ++this.postCounter,
      platform: this.platformName,
      success: true
    };
  }

  async editMessage(messageId, content, options = {}) {
    console.log(`MockVK: Editing post ${messageId}`);
    console.log(`New content: ${content}`);
    return true;
  }

  async deleteMessage(messageId) {
    console.log(`MockVK: Deleting post ${messageId}`);
    return true;
  }

  async getUserInfo(userId) {
    return {
      id: userId,
      username: 'mockvkuser',
      first_name: 'VK Mock',
      last_name: 'User',
      platform: this.platformName
    };
  }

  buildUserMention(user) {
    return `@id${user.id}(${user.first_name || 'User'})`;
  }
}

/**
 * Test the consensus sync functionality
 */
async function testConsensusSync() {
  console.log('=== Testing Consensus Sync Service ===\n');

  // Create mock adapters
  const telegramAdapter = new MockTelegramAdapter();
  const vkAdapter = new MockVKAdapter();
  
  const adapters = {
    telegram: telegramAdapter,
    vk: vkAdapter
  };

  // Create mock storage
  const storage = new MockStorage();

  // Create consensus sync service
  const syncService = new ConsensusSyncService(adapters, storage, {
    enabledPlatforms: ['telegram', 'vk'],
    syncIntervalMs: 0, // Disable automatic sync for testing
    conflictResolution: 'timestamp',
    showOriginPlatform: true
  });

  console.log('1. Testing sync stats...');
  console.log('Initial sync stats:', syncService.getSyncStats());
  console.log();

  console.log('2. Testing platform synchronization...');
  await syncService.syncPlatforms();
  console.log();

  console.log('3. Testing cross-platform posting...');
  const crossPostResult = await syncService.crossPostContent(
    "Testing cross-platform posting functionality",
    "need",
    {
      id: 54321,
      username: "crosstester",
      first_name: "Cross",
      last_name: "Tester"
    },
    {
      excludePlatform: "telegram",
      originMessageId: 150
    }
  );
  
  console.log('Cross-post result:', crossPostResult);
  console.log();

  console.log('4. Testing file attachment cross-posting...');
  const filePostResult = await syncService.crossPostContent(
    "Sharing an image resource",
    "resource", 
    {
      id: 67890,
      username: "filesharer",
      first_name: "File",
      last_name: "Sharer"
    },
    {
      fileId: "mock-file-123",
      excludePlatform: "vk",
      originMessageId: 250
    }
  );
  
  console.log('File post result:', filePostResult);
  console.log();

  console.log('5. Final sync stats...');
  console.log('Final sync stats:', syncService.getSyncStats());
  console.log();

  console.log('=== Test Complete ===');
}

/**
 * Test conflict resolution
 */
async function testConflictResolution() {
  console.log('\n=== Testing Conflict Resolution ===\n');

  const storage = new MockStorage();
  const adapters = {
    telegram: new MockTelegramAdapter(),
    vk: new MockVKAdapter()
  };

  // Test timestamp-based resolution
  const syncService1 = new ConsensusSyncService(adapters, storage, {
    conflictResolution: 'timestamp'
  });

  const conflict = {
    type: 'duplicate',
    items: [
      { 
        guid: 'item1', 
        updatedAt: '2025-09-10T10:00:00.000Z',
        originPlatform: 'telegram' 
      },
      { 
        guid: 'item2', 
        updatedAt: '2025-09-10T10:30:00.000Z',
        originPlatform: 'vk' 
      }
    ]
  };

  console.log('Testing timestamp resolution...');
  const timestampResult = await syncService1.handleConflict(conflict);
  console.log('Winner:', timestampResult);
  console.log();

  // Test platform priority resolution
  const syncService2 = new ConsensusSyncService(adapters, storage, {
    conflictResolution: 'platform_priority',
    platformPriority: ['vk', 'telegram']
  });

  console.log('Testing platform priority resolution...');
  const priorityResult = await syncService2.handleConflict(conflict);
  console.log('Winner:', priorityResult);
  console.log();

  console.log('=== Conflict Resolution Test Complete ===');
}

// Run the tests
async function runTests() {
  try {
    await testConsensusSync();
    await testConflictResolution();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export for use in other test files
export { 
  MockStorage, 
  MockTelegramAdapter, 
  MockVKAdapter, 
  testConsensusSync, 
  testConflictResolution,
  runTests
};

// Run tests if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  runTests();
}