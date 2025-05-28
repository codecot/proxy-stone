const http = require("http");

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 4000,
      path: path,
      method: method,
      headers: {},
    };

    // Only set JSON content type if we have data to send
    if (data) {
      options.headers["Content-Type"] = "application/json";
    }

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAdminFeatures() {
  console.log("🔐 Testing Admin Password Manager Features\n");

  try {
    // Test 1: Upload CSV with status
    console.log("1. Testing CSV Upload with Status Field");
    const csvWithStatus = {
      csvContent: `login,password,url,category,importance,tags,status
admin@test.com,password123,https://admin.example.com,admin,5,"important,admin",pending
user@test.com,password456,https://user.example.com,user,3,"normal,user",processed
verify@test.com,password789,https://verify.example.com,verify,4,"check,verify",verified`,
    };

    const upload = await makeRequest(
      "POST",
      "/api/password-manager/upload-csv",
      csvWithStatus
    );
    console.log(
      `   Upload Status: ${upload.status} - ${upload.status === 200 ? "✅" : "❌"}`
    );
    if (upload.status === 200) {
      console.log(`   Imported: ${upload.data.result.imported} credentials`);
    }

    // Test 2: Get credentials with status filtering
    console.log("\n2. Testing Status Filtering");
    const allCreds = await makeRequest(
      "GET",
      "/api/password-manager/credentials"
    );
    console.log(`   Get All: ${allCreds.status === 200 ? "✅" : "❌"}`);
    if (allCreds.status === 200) {
      console.log(`   Total credentials: ${allCreds.data.total}`);
      console.log(
        `   Available statuses: ${allCreds.data.statuses.join(", ")}`
      );
    }

    // Test 3: Filter by status
    const pendingCreds = await makeRequest(
      "GET",
      "/api/password-manager/credentials?status=pending"
    );
    console.log(
      `   Filter Pending: ${pendingCreds.status === 200 ? "✅" : "❌"}`
    );
    if (pendingCreds.status === 200) {
      console.log(`   Pending credentials: ${pendingCreds.data.total}`);
    }

    const processedCreds = await makeRequest(
      "GET",
      "/api/password-manager/credentials?status=processed"
    );
    console.log(
      `   Filter Processed: ${processedCreds.status === 200 ? "✅" : "❌"}`
    );
    if (processedCreds.status === 200) {
      console.log(`   Processed credentials: ${processedCreds.data.total}`);
    }

    // Test 4: Single credential update
    if (allCreds.status === 200 && allCreds.data.credentials.length > 0) {
      console.log("\n3. Testing Individual Status Update");
      const firstCred = allCreds.data.credentials[0];
      console.log(`   Updating credential: ${firstCred.login}`);

      const update = await makeRequest(
        "PUT",
        `/api/password-manager/credentials/${firstCred.id}`,
        {
          status: "verified",
          importance: 5,
        }
      );
      console.log(`   Update Status: ${update.status === 200 ? "✅" : "❌"}`);
      if (update.status === 200) {
        console.log(`   New status: ${update.data.credential.status}`);
        console.log(`   New importance: ${update.data.credential.importance}`);
      }
    }

    // Test 5: Bulk status update
    if (allCreds.status === 200 && allCreds.data.credentials.length >= 2) {
      console.log("\n4. Testing Bulk Status Update");
      const credIds = allCreds.data.credentials.slice(0, 2).map((c) => c.id);
      console.log(
        `   Updating ${credIds.length} credentials to 'changed' status`
      );

      const bulkUpdate = await makeRequest(
        "POST",
        "/api/password-manager/bulk-status",
        {
          ids: credIds,
          status: "changed",
        }
      );
      console.log(`   Bulk Update: ${bulkUpdate.status === 200 ? "✅" : "❌"}`);
      if (bulkUpdate.status === 200) {
        console.log(`   Updated: ${bulkUpdate.data.updated} credentials`);
      }
    }

    // Test 6: Get single credential details
    if (allCreds.status === 200 && allCreds.data.credentials.length > 0) {
      console.log("\n5. Testing Single Credential Retrieval");
      const credId = allCreds.data.credentials[0].id;

      const singleCred = await makeRequest(
        "GET",
        `/api/password-manager/credentials/${credId}`
      );
      console.log(`   Get Single: ${singleCred.status === 200 ? "✅" : "❌"}`);
      if (singleCred.status === 200) {
        const cred = singleCred.data.credential;
        console.log(`   Login: ${cred.login}`);
        console.log(`   Status: ${cred.status}`);
        console.log(`   Category: ${cred.category}`);
        console.log(`   Importance: ${cred.importance}`);
      }
    }

    // Test 7: CSV Template with new format
    console.log("\n6. Testing Updated CSV Template");
    const template = await makeRequest(
      "GET",
      "/api/password-manager/csv-template"
    );
    console.log(`   Template: ${template.status === 200 ? "✅" : "❌"}`);
    if (template.status === 200) {
      const lines = template.data.split("\n");
      console.log(`   Header: ${lines[0]}`);
      console.log(
        `   Template includes status field: ${lines[0].includes("status") ? "✅" : "❌"}`
      );
    }

    console.log("\n🎉 Admin features testing completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testAdminFeatures();
