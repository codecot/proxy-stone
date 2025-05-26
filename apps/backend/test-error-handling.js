#!/usr/bin/env node

/**
 * Test script for Phase 4 Error Handling Implementation
 * Tests various error scenarios to ensure robust error handling
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api';

// Test scenarios
const tests = [
  {
    name: 'Network Error Test',
    description: 'Test with unreachable target server',
    url: `${BASE_URL}${API_PREFIX}/unreachable`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Error': 'true',
      },
      body: JSON.stringify({
        target: 'http://unreachable-host:9999/api/data',
        data: { test: 'network error' },
      }),
    },
    expectedErrorType: 'network',
  },
  {
    name: 'Timeout Error Test',
    description: 'Test with slow/timeout target',
    url: `${BASE_URL}${API_PREFIX}/timeout`,
    options: {
      method: 'GET',
      headers: {
        'X-Debug-Error': 'true',
      },
    },
    expectedErrorType: 'timeout',
  },
  {
    name: 'Production Mode Test',
    description: 'Test error response without debug header',
    url: `${BASE_URL}${API_PREFIX}/unreachable`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No X-Debug-Error header
      },
      body: JSON.stringify({
        target: 'http://unreachable-host:9999/api/data',
      }),
    },
    expectedErrorType: 'network',
    shouldHaveDetails: false,
  },
  {
    name: 'Cache Key Generation Test',
    description: 'Test cache key generation with various inputs',
    url: `${BASE_URL}${API_PREFIX}/cache-test`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
        'X-User-ID': '12345',
      },
      body: JSON.stringify({
        complex: { nested: { data: 'test' } },
        array: [1, 2, 3],
        special: 'chars!@#$%^&*()',
      }),
    },
  },
];

async function runTest(test) {
  console.log(`\n🧪 Running: ${test.name}`);
  console.log(`📝 ${test.description}`);

  try {
    const response = await fetch(test.url, test.options);
    const data = await response.json();

    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));

    // Validate error response structure
    if (response.status >= 400) {
      const hasRequiredFields = data.error && data.message && data.timestamp;
      console.log(`✅ Has required error fields: ${hasRequiredFields}`);

      if (test.expectedErrorType) {
        const hasCorrectType = data.type === test.expectedErrorType;
        console.log(`✅ Correct error type (${test.expectedErrorType}): ${hasCorrectType}`);
      }

      if (test.shouldHaveDetails === false) {
        const hasNoDetails = !data.details;
        console.log(`✅ No debug details in production mode: ${hasNoDetails}`);
      } else if (test.options.headers['X-Debug-Error'] === 'true') {
        const hasDebugDetails = data.details && data.details.debugMode;
        console.log(`✅ Has debug details in dev mode: ${hasDebugDetails}`);
      }
    }

    console.log(`✅ Test completed successfully`);
  } catch (error) {
    console.log(`❌ Test failed with error:`, error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Phase 4 Error Handling Tests');
  console.log('='.repeat(50));

  // Check if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/health`);
    if (!healthCheck.ok) {
      throw new Error('Server health check failed');
    }
    console.log('✅ Server is running and healthy');
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   npm start');
    process.exit(1);
  }

  // Run all tests
  for (const test of tests) {
    await runTest(test);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait between tests
  }

  console.log('\n🎉 All error handling tests completed!');
  console.log('='.repeat(50));

  // Test cache statistics to verify cache error handling
  try {
    console.log('\n📊 Testing Cache Statistics...');
    const cacheStats = await fetch(`${BASE_URL}/cache/stats`);
    const stats = await cacheStats.json();
    console.log('Cache Stats:', JSON.stringify(stats, null, 2));
  } catch (error) {
    console.log('Cache stats test failed:', error.message);
  }

  // Test request analytics to verify database logging
  try {
    console.log('\n📈 Testing Request Analytics...');
    const analytics = await fetch(`${BASE_URL}/requests/analytics/errors`);
    const errorAnalytics = await analytics.json();
    console.log('Error Analytics:', JSON.stringify(errorAnalytics, null, 2));
  } catch (error) {
    console.log('Analytics test failed:', error.message);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, runTest, tests };
