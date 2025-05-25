#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const CACHE_DIR = './cache';
const TEST_CACHE_ENTRIES = [
  {
    key: 'GET:https://httpbin.org/get:',
    data: { message: 'Test cached response 1', timestamp: Date.now() },
    headers: { 'content-type': 'application/json' },
    status: 200,
    createdAt: Date.now(),
    ttl: 3600, // 1 hour
  },
  {
    key: 'GET:https://httpbin.org/users/123:',
    data: { id: 123, name: 'Test User', email: 'test@example.com' },
    headers: { 'content-type': 'application/json' },
    status: 200,
    createdAt: Date.now(),
    ttl: 600, // 10 minutes
  },
  {
    key: 'POST:https://httpbin.org/search:',
    data: { results: ['item1', 'item2', 'item3'], total: 3 },
    headers: { 'content-type': 'application/json' },
    status: 200,
    createdAt: Date.now(),
    ttl: 300, // 5 minutes
  },
];

async function createTestCacheFiles() {
  console.log('🔧 Creating test cache files...');

  // Ensure cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });

  // Create test cache files
  for (const entry of TEST_CACHE_ENTRIES) {
    const filename = `${entry.key.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
    const filepath = path.join(CACHE_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(entry, null, 2));
    console.log(`   ✅ Created: ${filename}`);
  }

  console.log(`📁 Created ${TEST_CACHE_ENTRIES.length} test cache files in ${CACHE_DIR}`);
}

async function startServerAndTestWarmup() {
  console.log('\n🚀 Starting server with cache warmup enabled...');

  return new Promise((resolve, reject) => {
    const server = spawn(
      'npm',
      ['run', 'dev', '--', '--enable-file-cache', '--enable-cache-warmup'],
      {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'development' },
      }
    );

    let output = '';
    let warmupDetected = false;
    let serverStarted = false;

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());

      // Check for cache warmup messages
      if (text.includes('Starting cache warmup')) {
        console.log('🔥 Cache warmup started!');
        warmupDetected = true;
      }

      if (text.includes('Cache warmup completed')) {
        console.log('✅ Cache warmup completed!');
      }

      // Check if server started
      if (text.includes('Server listening')) {
        serverStarted = true;
        setTimeout(() => {
          console.log('\n🛑 Stopping server...');
          server.kill('SIGTERM');
        }, 3000); // Give it 3 seconds to show warmup
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });

    server.on('close', (code) => {
      console.log(`\n📊 Server process exited with code ${code}`);

      if (warmupDetected) {
        console.log('✅ Cache warmup functionality is working!');
        resolve(true);
      } else {
        console.log('❌ Cache warmup was not detected in the logs');
        resolve(false);
      }
    });

    server.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverStarted) {
        console.log('⏰ Timeout waiting for server to start');
        server.kill('SIGTERM');
        reject(new Error('Server start timeout'));
      }
    }, 30000);
  });
}

async function testCacheStats() {
  console.log('\n📊 Testing cache stats endpoint...');

  try {
    const response = await fetch('http://localhost:4000/cache/stats');
    if (response.ok) {
      const stats = await response.json();
      console.log('Cache stats:', JSON.stringify(stats, null, 2));

      if (stats.memory && stats.memory.size > 0) {
        console.log(`✅ Memory cache has ${stats.memory.size} entries`);
      }

      if (stats.file && stats.file.size > 0) {
        console.log(`✅ File cache has ${stats.file.size} entries`);
      }
    } else {
      console.log('❌ Failed to fetch cache stats');
    }
  } catch (error) {
    console.log('❌ Cache stats endpoint not available:', error.message);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test cache files...');

  try {
    const files = await fs.readdir(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(CACHE_DIR, file));
        console.log(`   🗑️  Removed: ${file}`);
      }
    }
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.log('⚠️  Cleanup failed:', error.message);
  }
}

async function main() {
  console.log('🧪 Testing Cache Warmup Functionality\n');

  try {
    // Step 1: Create test cache files
    await createTestCacheFiles();

    // Step 2: Start server and test warmup
    const warmupWorked = await startServerAndTestWarmup();

    // Step 3: Clean up
    await cleanup();

    // Step 4: Summary
    console.log('\n📋 Test Summary:');
    console.log(
      `   Cache warmup implementation: ${warmupWorked ? '✅ WORKING' : '❌ NOT WORKING'}`
    );
    console.log(`   Test cache files: ✅ CREATED AND CLEANED`);

    process.exit(warmupWorked ? 0 : 1);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await cleanup();
    process.exit(1);
  }
}

main().catch(console.error);
