#!/usr/bin/env bun
/**
 * Test script to verify Bun 1.3 compatibility with the bot's dependencies and features
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const tests = [];
const errors = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Test 1: Verify Bun version
test('Bun version is 1.3.x', () => {
  const bunVersion = Bun.version;
  console.log(`  Bun version: ${bunVersion}`);
  if (!bunVersion.startsWith('1.3.')) {
    throw new Error(`Expected Bun 1.3.x, got ${bunVersion}`);
  }
});

// Test 2: Verify package.json can be read
test('Can read package.json', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  assertEquals(pkg.name, 'needs-and-resources-bot', 'Package name');
  console.log(`  Package: ${pkg.name}@${pkg.version}`);
});

// Test 3: Verify all dependencies are installed
test('All dependencies are installed', async () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const deps = Object.keys(pkg.dependencies || {});

  for (const dep of deps) {
    try {
      await import(dep);
      console.log(`  ✓ ${dep}`);
    } catch (err) {
      throw new Error(`Failed to import ${dep}: ${err.message}`);
    }
  }
});

// Test 4: Verify ESM imports work
test('ESM imports work correctly', async () => {
  const { v4: uuidv4 } = await import('uuid');
  const uuid = uuidv4();
  console.log(`  Generated UUID: ${uuid}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)) {
    throw new Error('Invalid UUID format');
  }
});

// Test 5: Verify Telegraf works
test('Telegraf can be imported and initialized', async () => {
  const { Telegraf } = await import('telegraf');
  const bot = new Telegraf('dummy-token');
  console.log(`  Telegraf instance created`);
  if (!bot.telegram) {
    throw new Error('Telegraf instance missing telegram property');
  }
});

// Test 6: Verify lowdb works
test('lowdb can be imported and initialized', async () => {
  const { Low, JSONFile } = await import('lowdb');

  const testFile = '/tmp/test-db.json';
  const adapter = new JSONFile(testFile);
  const db = new Low(adapter, { test: true });
  await db.read();
  console.log(`  lowdb instance created with data:`, db.data);
  // It's OK if data is null on first read - it means file doesn't exist yet
  if (db.data === undefined) {
    throw new Error('lowdb data is undefined');
  }
});

// Test 7: Verify dotenv works
test('dotenv can be imported and used', async () => {
  const dotenv = await import('dotenv');
  console.log(`  dotenv config function available: ${typeof dotenv.config === 'function'}`);
  if (typeof dotenv.config !== 'function') {
    throw new Error('dotenv.config is not a function');
  }
});

// Test 8: Verify lodash works
test('lodash can be imported and used', async () => {
  const _ = await import('lodash');
  const result = _.default.chunk([1, 2, 3, 4], 2);
  console.log(`  lodash chunk test:`, result);
  if (result.length !== 2) {
    throw new Error('lodash chunk failed');
  }
});

// Run all tests
console.log('Running Bun 1.3 compatibility tests...\n');

for (const { name, fn } of tests) {
  try {
    console.log(`Test: ${name}`);
    await fn();
    console.log(`  ✅ PASS\n`);
  } catch (err) {
    console.log(`  ❌ FAIL: ${err.message}\n`);
    errors.push({ name, error: err });
  }
}

// Summary
console.log('='.repeat(60));
console.log(`Tests run: ${tests.length}`);
console.log(`Passed: ${tests.length - errors.length}`);
console.log(`Failed: ${errors.length}`);

if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(({ name, error }) => {
    console.log(`  - ${name}: ${error.message}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All tests passed! Bun 1.3 is working correctly.');
  process.exit(0);
}
