import Storage from '../storage.js';

// Test script to verify archiving functionality
async function testArchiving() {
  console.log('Testing archiving functionality...');
  
  const storage = new Storage();
  await storage.initDB();
  
  // Create a test user with some needs and resources
  const userId = '12345';
  const user = await storage.getUserData(userId);
  
  // Add some test items
  const testNeed = {
    user: { id: userId, username: 'testuser', first_name: 'Test', last_name: 'User' },
    requestor: 'testuser',
    guid: 'test-need-1',
    description: 'I need help with testing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channelMessageId: 123
  };
  
  const testResource = {
    user: { id: userId, username: 'testuser', first_name: 'Test', last_name: 'User' },
    supplier: 'testuser',
    guid: 'test-resource-1',
    description: 'I can provide testing services',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channelMessageId: 124
  };
  
  user.needs.push(testNeed);
  user.resources.push(testResource);
  await storage.writeDB();
  
  console.log('✓ Created test items');
  console.log('Needs:', user.needs.length);
  console.log('Resources:', user.resources.length);
  
  // Test archiving
  testNeed.archivedAt = new Date().toISOString();
  await storage.writeDB();
  
  console.log('✓ Archived test need');
  
  // Test filtering
  const activeNeeds = user.needs.filter(item => !item.archivedAt);
  const archivedNeeds = user.needs.filter(item => item.archivedAt);
  
  console.log('Active needs:', activeNeeds.length);
  console.log('Archived needs:', archivedNeeds.length);
  
  if (activeNeeds.length === 0 && archivedNeeds.length === 1) {
    console.log('✓ Archiving functionality working correctly');
  } else {
    console.log('✗ Archiving functionality not working as expected');
  }
  
  // Clean up
  user.needs = [];
  user.resources = [];
  await storage.writeDB();
  
  console.log('✓ Cleaned up test data');
}

testArchiving().catch(console.error);