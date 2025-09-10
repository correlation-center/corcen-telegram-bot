// Test script for storage functionality with searches
import Storage from '../storage.js';
import fs from 'fs';

const testDbPath = 'test-db.json';

// Clean up any existing test database
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

async function testStorageSearches() {
  console.log("Testing storage functionality with searches:");
  console.log("==========================================");

  // Create storage instance with test database
  // We'll work with the default db.json for simplicity
  const storage = new Storage();
  
  try {
    // Initialize database
    await storage.initDB();
    console.log("✅ Database initialized");

    // Test user creation with searches field
    const userId = "test_user_12345";
    const userData = await storage.getUserData(userId);
    
    if (userData.searches && Array.isArray(userData.searches)) {
      console.log("✅ User data includes searches array");
    } else {
      console.log("❌ User data missing searches array");
      return false;
    }
    
    // Test adding a search
    userData.searches.push({
      query: "test laptop",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchCount: 0,
      lastMatch: null
    });
    
    await storage.writeDB();
    console.log("✅ Search added to database");
    
    // Test reading back the search
    await storage.readDB();
    const userDataRead = await storage.getUserData(userId);
    
    if (userDataRead.searches.length === 1) {
      console.log("✅ Search data persisted correctly");
      console.log(`   Search query: "${userDataRead.searches[0].query}"`);
      console.log(`   Active: ${userDataRead.searches[0].active}`);
      console.log(`   Match count: ${userDataRead.searches[0].matchCount}`);
    } else {
      console.log("❌ Search data not persisted correctly");
      return false;
    }
    
    // Test existing users get searches field
    const anotherUserId = "test_user_67890";
    // Simulate existing user without searches field
    storage.db.data.users[anotherUserId] = { needs: [], resources: [] };
    await storage.writeDB();
    
    // This should add searches field automatically
    const existingUserData = await storage.getUserData(anotherUserId);
    
    if (existingUserData.searches && Array.isArray(existingUserData.searches)) {
      console.log("✅ Existing user automatically gets searches field");
    } else {
      console.log("❌ Existing user didn't get searches field");
      return false;
    }
    
    console.log("\nAll storage tests passed! 🎉");
    return true;
    
  } catch (error) {
    console.error("❌ Storage test failed:", error);
    return false;
  } finally {
    // Clean up test users from database
    try {
      await storage.readDB();
      if (storage.db.data.users) {
        delete storage.db.data.users["test_user_12345"];
        delete storage.db.data.users["test_user_67890"];
        await storage.writeDB();
        console.log("🧹 Test users cleaned up");
      }
    } catch (e) {
      console.log("⚠️ Cleanup failed:", e.message);
    }
  }
}

// Run the test
testStorageSearches().then(success => {
  process.exit(success ? 0 : 1);
});