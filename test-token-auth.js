#!/usr/bin/env node

const BASE_URL = 'http://localhost:8001/api';

async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function testTokenAuth() {
  console.log('🧪 Testing Token-Based Authentication\n');

  // 1. Check auth status
  console.log('1️⃣ Checking auth status...');
  const status = await makeRequest(`${BASE_URL}/auth/status`);
  console.log(`Status: ${status.status}`);
  console.log(`Auth enabled: ${status.data.auth_enabled}`);
  console.log(`User auth enabled: ${status.data.user_auth_enabled}\n`);

  if (!status.data.auth_enabled) {
    console.log('❌ Authentication is disabled. Start server with:');
    console.log('   ENABLE_AUTH=true JWT_SECRET=your-secret npm start\n');
    return;
  }

  // 2. Try accessing protected endpoint without token
  console.log('2️⃣ Accessing protected endpoint without token...');
  const noAuth = await makeRequest(`${BASE_URL}/auth/test-protected`);
  console.log(`Status: ${noAuth.status} (expected 401)`);
  console.log(`Message: ${noAuth.data.message}\n`);

  // 3. Create a user (this would normally be done by admin)
  console.log('3️⃣ Creating a test user...');
  // Note: In real scenario, you'd need admin token for this
  const createUser = await makeRequest(`${BASE_URL}/auth/users`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'testuser',
      password: 'testpass123',
      role: 'readonly',
    }),
  });
  console.log(`Status: ${createUser.status}`);
  if (createUser.status === 201 || createUser.status === 409) {
    console.log('✅ User created or already exists\n');
  } else {
    console.log(`❌ Failed to create user: ${createUser.data.error}\n`);
  }

  // 4. Login to get token
  console.log('4️⃣ Logging in to get access token...');
  const login = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: 'testuser',
      password: 'testpass123',
    }),
  });
  console.log(`Status: ${login.status}`);

  if (login.status !== 200) {
    console.log(`❌ Login failed: ${login.data.error}\n`);
    return;
  }

  const token = login.data.access_token;
  console.log(`✅ Login successful!`);
  console.log(`Token type: ${login.data.token_type}`);
  console.log(`User: ${login.data.user.username} (${login.data.user.role})`);
  console.log(`Token: ${token.substring(0, 20)}...\n`);

  // 5. Access protected endpoint with token
  console.log('5️⃣ Accessing protected endpoint with token...');
  const withAuth = await makeRequest(`${BASE_URL}/auth/test-protected`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${withAuth.status} (expected 200)`);
  console.log(`Message: ${withAuth.data.message}`);
  console.log(`Auth info: ${JSON.stringify(withAuth.data.auth, null, 2)}\n`);

  // 6. Try admin endpoint (should fail with readonly role)
  console.log('6️⃣ Trying admin endpoint with readonly token...');
  const adminFail = await makeRequest(`${BASE_URL}/auth/test-admin`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${adminFail.status} (expected 403)`);
  console.log(`Message: ${adminFail.data.message}\n`);

  // 7. Logout (revoke token)
  console.log('7️⃣ Logging out (revoking token)...');
  const logout = await makeRequest(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${logout.status}`);
  console.log(`Message: ${logout.data.message}\n`);

  // 8. Try using revoked token
  console.log('8️⃣ Trying to use revoked token...');
  const revokedToken = await makeRequest(`${BASE_URL}/auth/test-protected`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log(`Status: ${revokedToken.status} (expected 401)`);
  console.log(`Message: ${revokedToken.data.message}\n`);

  console.log('🎉 Token authentication test completed!');
}

// Run the test
testTokenAuth().catch(console.error);
