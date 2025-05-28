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

async function runTests() {
  console.log("🧪 Testing Proxy Stone Features\n");

  try {
    // Test 1: Health
    console.log("1. Health Check");
    const health = await makeRequest("GET", "/health");
    console.log(
      `   Status: ${health.status} - ${health.status === 200 ? "✅" : "❌"}`
    );

    // Test 2: Cluster Status
    console.log("\n2. Cluster Status");
    const cluster = await makeRequest("GET", "/api/cluster/status");
    console.log(
      `   Status: ${cluster.status} - ${cluster.status === 200 ? "✅" : "❌"}`
    );
    if (cluster.status === 200) {
      console.log(
        `   Node ID: ${cluster.data.status.nodeId.substring(0, 8)}...`
      );
      console.log(`   Serving: ${cluster.data.serviceStatus.serving}`);
    }

    // Test 3: Password Manager Template
    console.log("\n3. Password Manager CSV Template");
    const template = await makeRequest(
      "GET",
      "/api/password-manager/csv-template"
    );
    console.log(
      `   Status: ${template.status} - ${template.status === 200 ? "✅" : "❌"}`
    );

    // Test 4: CSV Upload
    console.log("\n4. CSV Upload");
    const csvData = {
      csvContent: `login,password,url,category,importance,tags
test@example.com,password123,https://example.com,test,3,"demo"`,
    };
    const upload = await makeRequest(
      "POST",
      "/api/password-manager/upload-csv",
      csvData
    );
    console.log(
      `   Status: ${upload.status} - ${upload.status === 200 ? "✅" : "❌"}`
    );
    if (upload.status === 200) {
      console.log(`   Imported: ${upload.data.result.imported} credentials`);
    }

    // Test 5: Get Credentials
    console.log("\n5. Get Credentials");
    const creds = await makeRequest("GET", "/api/password-manager/credentials");
    console.log(
      `   Status: ${creds.status} - ${creds.status === 200 ? "✅" : "❌"}`
    );
    if (creds.status === 200) {
      console.log(`   Total: ${creds.data.total} credentials`);
      console.log(`   Categories: ${creds.data.categories.join(", ")}`);
    }

    // Test 6: Maintenance Mode
    console.log("\n6. Maintenance Mode");
    const disable = await makeRequest("POST", "/api/cluster/disable-serving");
    console.log(`   Disable: ${disable.status === 200 ? "✅" : "❌"}`);

    const enable = await makeRequest("POST", "/api/cluster/enable-serving");
    console.log(`   Enable: ${enable.status === 200 ? "✅" : "❌"}`);

    console.log("\n🎉 Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

runTests();
