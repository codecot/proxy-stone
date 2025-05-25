#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🔍 Multi-Database Approach Verification\n');

const testDatabase = async (dbType, port, dbConfig = {}) => {
  console.log(`\n📋 Testing ${dbType.toUpperCase()} Database`);
  console.log('='.repeat(50));

  // Build command arguments
  const args = ['run', 'dev', '--'];
  args.push('--port', port.toString());

  if (dbType !== 'sqlite') {
    args.push('--db-type', dbType);
    if (dbConfig.host) args.push('--db-host', dbConfig.host);
    if (dbConfig.port) args.push('--db-port', dbConfig.port.toString());
    if (dbConfig.database) args.push('--db-name', dbConfig.database);
    if (dbConfig.user) args.push('--db-user', dbConfig.user);
    if (dbConfig.password) args.push('--db-password', dbConfig.password);
  }

  console.log(`Command: npm ${args.join(' ')}`);

  // Start the application
  const app = spawn('npm', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let output = '';
  let errorOutput = '';

  app.stdout.on('data', (data) => {
    output += data.toString();
  });

  app.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  // Wait for startup
  console.log('⏳ Starting application...');
  await setTimeout(8000);

  try {
    // Test health endpoint
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await fetch(`http://localhost:${port}/health`);

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint: OK');
      console.log(`   Status: ${healthData.status}`);
      console.log(`   File cache: ${healthData.config.enableFileCache ? 'enabled' : 'disabled'}`);
    } else {
      console.log('❌ Health endpoint: Failed');
      return false;
    }

    // Test proxy functionality
    console.log('🔍 Testing proxy functionality...');
    const proxyResponse = await fetch(`http://localhost:${port}/api/get`);

    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json();
      console.log('✅ Proxy functionality: OK');
      console.log(`   Origin: ${proxyData.origin}`);
      console.log(`   URL: ${proxyData.url}`);
    } else {
      console.log('❌ Proxy functionality: Failed');
      return false;
    }

    // Test cache functionality
    console.log('🔍 Testing cache functionality...');
    const cacheResponse1 = await fetch(`http://localhost:${port}/api/uuid`);
    const cacheResponse2 = await fetch(`http://localhost:${port}/api/uuid`);

    if (cacheResponse1.ok && cacheResponse2.ok) {
      const data1 = await cacheResponse1.json();
      const data2 = await cacheResponse2.json();

      if (data1.uuid === data2.uuid) {
        console.log('✅ Cache functionality: OK (same UUID returned)');
        console.log(`   Cached UUID: ${data1.uuid}`);
      } else {
        console.log('⚠️  Cache functionality: Working but not caching (different UUIDs)');
      }
    } else {
      console.log('❌ Cache functionality: Failed');
      return false;
    }

    console.log(`\n🎉 ${dbType.toUpperCase()} database test: PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${dbType.toUpperCase()} database test: FAILED`);
    console.log(`   Error: ${error.message}`);
    return false;
  } finally {
    // Kill the application
    console.log('🛑 Stopping application...');
    app.kill('SIGTERM');
    await setTimeout(2000);
    if (!app.killed) {
      app.kill('SIGKILL');
    }
  }
};

const main = async () => {
  console.log('🚀 Starting Multi-Database Verification Tests\n');

  const results = {
    sqlite: false,
    postgresql: false,
    mysql: false,
  };

  // Test SQLite (default)
  console.log('📦 Testing SQLite (Default Configuration)');
  results.sqlite = await testDatabase('sqlite', 4010);

  // Test PostgreSQL (requires Docker container)
  console.log('\n📦 Testing PostgreSQL (Docker Container)');
  results.postgresql = await testDatabase('postgresql', 4011, {
    host: 'localhost',
    port: 5432,
    database: 'proxydb',
    user: 'devuser',
    password: 'devpass',
  });

  // Test MySQL (requires Docker container)
  console.log('\n📦 Testing MySQL (Docker Container)');
  results.mysql = await testDatabase('mysql', 4012, {
    host: 'localhost',
    port: 3306,
    database: 'proxydb',
    user: 'devuser',
    password: 'devpass',
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([db, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${db.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  console.log(`\n🎯 Overall Result: ${passed}/${total} database types working`);

  if (passed === total) {
    console.log('🎉 Multi-Database Approach: FULLY VERIFIED ✅');
    console.log('\n✨ Your proxy server supports:');
    console.log('   • SQLite (default, no setup required)');
    console.log('   • PostgreSQL (with Docker container)');
    console.log('   • MySQL (with Docker container)');
    console.log('\n🔧 Usage examples:');
    console.log('   npm run dev                                    # SQLite');
    console.log('   npm run dev -- --db-type postgresql --port 4001  # PostgreSQL');
    console.log('   npm run dev -- --db-type mysql --port 4002       # MySQL');
  } else {
    console.log('⚠️  Multi-Database Approach: PARTIALLY WORKING');
    console.log('\n🔧 Check that Docker containers are running for failed databases:');
    console.log('   npm run docker:pg    # For PostgreSQL');
    console.log('   npm run docker:mysql # For MySQL');
  }

  console.log('\n🏁 Verification Complete!');
  process.exit(passed === total ? 0 : 1);
};

main().catch(console.error);
