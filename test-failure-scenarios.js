#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🧪 Testing Failure Scenarios for Multi-Database Approach\n');

const testScenario = async (name, description, command, expectedBehavior) => {
  console.log(`\n🔬 Testing: ${name}`);
  console.log(`📝 Description: ${description}`);
  console.log(`⚡ Command: ${command.join(' ')}`);
  console.log('='.repeat(60));

  const app = spawn(command[0], command.slice(1), {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let output = '';
  let errorOutput = '';
  let hasStarted = false;
  let hasWarnings = false;
  let hasErrors = false;

  app.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    if (text.includes('Server listening at')) {
      hasStarted = true;
    }
  });

  app.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    if (text.includes('Server listening at')) {
      hasStarted = true;
    }
    if (text.includes('Failed to initialize snapshot manager')) {
      hasWarnings = true;
    }
    if (text.includes('Error:') && !text.includes('Failed to initialize snapshot manager')) {
      hasErrors = true;
    }
  });

  // Wait for startup
  console.log('⏳ Starting application...');
  await setTimeout(8000);

  let testResult = {
    started: hasStarted,
    gracefulDegradation: hasWarnings && !hasErrors,
    healthEndpointWorking: false,
    proxyWorking: false,
    errorHandling: 'unknown',
  };

  try {
    // Extract port from command
    const portIndex = command.findIndex((arg) => arg === '--port');
    const port = portIndex !== -1 ? command[portIndex + 1] : '4000';

    // Test health endpoint
    console.log('🔍 Testing health endpoint...');
    try {
      const healthResponse = await fetch(`http://localhost:${port}/health`);
      testResult.healthEndpointWorking = healthResponse.ok;

      if (healthResponse.ok) {
        console.log('✅ Health endpoint: Working');
      } else {
        console.log('❌ Health endpoint: Failed');
      }
    } catch (error) {
      console.log('❌ Health endpoint: Connection failed');
    }

    // Test proxy functionality
    console.log('🔍 Testing proxy functionality...');
    try {
      const proxyResponse = await fetch(`http://localhost:${port}/api/get`);
      testResult.proxyWorking = proxyResponse.ok;

      if (proxyResponse.ok) {
        console.log('✅ Proxy functionality: Working');
      } else {
        console.log('❌ Proxy functionality: Failed');
      }
    } catch (error) {
      console.log('❌ Proxy functionality: Connection failed');
    }

    // Analyze error handling
    if (hasStarted && hasWarnings && !hasErrors) {
      testResult.errorHandling = 'graceful';
      console.log('✅ Error handling: Graceful degradation');
    } else if (hasStarted && !hasWarnings && !hasErrors) {
      testResult.errorHandling = 'success';
      console.log('✅ Error handling: No issues detected');
    } else if (!hasStarted) {
      testResult.errorHandling = 'failed';
      console.log('❌ Error handling: Application failed to start');
    } else {
      testResult.errorHandling = 'partial';
      console.log('⚠️  Error handling: Partial success');
    }
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    testResult.errorHandling = 'failed';
  } finally {
    // Kill the application
    console.log('🛑 Stopping application...');
    app.kill('SIGTERM');
    await setTimeout(2000);
    if (!app.killed) {
      app.kill('SIGKILL');
    }
  }

  // Evaluate against expected behavior
  const passed = evaluateResult(testResult, expectedBehavior);

  console.log(`\n📊 Test Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Expected: ${expectedBehavior}`);
  console.log(`   Actual: ${JSON.stringify(testResult, null, 2)}`);

  if (hasWarnings) {
    console.log('\n📝 Warning Messages Found:');
    const warningLines = errorOutput
      .split('\n')
      .filter(
        (line) =>
          line.includes('Failed to initialize') || line.includes('⚠️') || line.includes('🔧')
      );
    warningLines.forEach((line) => console.log(`   ${line.trim()}`));
  }

  return passed;
};

const evaluateResult = (result, expected) => {
  switch (expected) {
    case 'graceful_degradation':
      return (
        result.started &&
        result.healthEndpointWorking &&
        result.proxyWorking &&
        result.errorHandling === 'graceful'
      );
    case 'full_success':
      return (
        result.started &&
        result.healthEndpointWorking &&
        result.proxyWorking &&
        result.errorHandling === 'success'
      );
    case 'connection_failure':
      return (
        result.started &&
        result.healthEndpointWorking &&
        result.proxyWorking &&
        (result.errorHandling === 'graceful' || result.errorHandling === 'success')
      );
    default:
      return false;
  }
};

const main = async () => {
  console.log('🚀 Starting Failure Scenario Tests\n');

  const scenarios = [
    {
      name: 'SQLite with Valid Path',
      description: 'Test SQLite with default configuration (should work)',
      command: ['npm', 'run', 'dev', '--', '--port', '4020'],
      expected: 'full_success',
    },
    {
      name: 'PostgreSQL without Docker',
      description: 'Test PostgreSQL when Docker container is not running',
      command: [
        'npm',
        'run',
        'dev',
        '--',
        '--db-type',
        'postgresql',
        '--db-host',
        'localhost',
        '--db-port',
        '5432',
        '--db-name',
        'proxydb',
        '--db-user',
        'devuser',
        '--db-password',
        'devpass',
        '--port',
        '4021',
      ],
      expected: 'graceful_degradation',
    },
    {
      name: 'MySQL without Docker',
      description: 'Test MySQL when Docker container is not running',
      command: [
        'npm',
        'run',
        'dev',
        '--',
        '--db-type',
        'mysql',
        '--db-host',
        'localhost',
        '--db-port',
        '3306',
        '--db-name',
        'proxydb',
        '--db-user',
        'devuser',
        '--db-password',
        'devpass',
        '--port',
        '4022',
      ],
      expected: 'graceful_degradation',
    },
    {
      name: 'Invalid Database Type',
      description: 'Test with an invalid database type (should fallback to SQLite)',
      command: ['npm', 'run', 'dev', '--', '--db-type', 'invalid', '--port', '4023'],
      expected: 'full_success',
    },
    {
      name: 'SQLite with Invalid Path',
      description: 'Test SQLite with a path that cannot be created',
      command: [
        'npm',
        'run',
        'dev',
        '--',
        '--db-type',
        'sqlite',
        '--db-path',
        '/root/invalid/path/db.sqlite',
        '--port',
        '4024',
      ],
      expected: 'graceful_degradation',
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    const passed = await testScenario(
      scenario.name,
      scenario.description,
      scenario.command,
      scenario.expected
    );
    results.push({ ...scenario, passed });

    // Wait between tests
    await setTimeout(2000);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FAILURE SCENARIO TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    console.log(
      `${result.passed ? '✅' : '❌'} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'}`
    );
  });

  console.log(`\n🎯 Overall Result: ${passed}/${total} scenarios handled correctly`);

  if (passed === total) {
    console.log('🎉 All failure scenarios handled gracefully! ✅');
    console.log('\n✨ Your application demonstrates:');
    console.log('   • Graceful degradation when databases are unavailable');
    console.log('   • Continued operation of core proxy functionality');
    console.log('   • Clear error messages and recovery instructions');
    console.log('   • Robust error handling without crashes');
  } else {
    console.log('⚠️  Some failure scenarios need improvement');
    console.log('\n🔧 Failed scenarios should be investigated:');
    results
      .filter((r) => !r.passed)
      .forEach((result) => {
        console.log(`   • ${result.name}: ${result.description}`);
      });
  }

  console.log('\n🏁 Failure Scenario Testing Complete!');
  process.exit(passed === total ? 0 : 1);
};

main().catch(console.error);
