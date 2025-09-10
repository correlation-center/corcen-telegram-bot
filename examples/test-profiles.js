#!/usr/bin/env node
import Storage from '../storage.js';

// Test the profiles functionality
async function testProfiles() {
  console.log('Testing profiles functionality...');
  
  const storage = new Storage();
  await storage.initDB();
  
  // Test adding a user with profiles
  const testUserId = '123456789';
  const user = await storage.getUserData(testUserId);
  
  console.log('Initial user data:', user);
  
  // Simulate adding a profile
  const profile = {
    question: "What is your name?",
    title: "Name",
    answer: "John Doe",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  user.profiles.push(profile);
  await storage.writeDB();
  
  console.log('Added profile:', profile);
  
  // Test reading the profile back
  await storage.readDB();
  const userAfter = await storage.getUserData(testUserId);
  console.log('User data after adding profile:', userAfter);
  
  // Test search functionality simulation
  const searchTerm = 'john';
  const allUsers = storage.db.data.users || {};
  const results = [];
  
  for (const [userId, userData] of Object.entries(allUsers)) {
    if (userData.profiles) {
      for (const profile of userData.profiles) {
        const searchText = `${profile.question} ${profile.title} ${profile.answer}`.toLowerCase();
        if (searchText.includes(searchTerm.toLowerCase())) {
          results.push({
            userId,
            profile,
            userData
          });
        }
      }
    }
  }
  
  console.log('Search results for "john":', results);
  
  console.log('✅ Profiles functionality test completed successfully!');
}

testProfiles().catch(console.error);