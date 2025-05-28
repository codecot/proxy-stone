import { PasswordCSVImporter } from "./apps/backend/src/modules/password-manager/services/csv-import.js";

async function testPasswordManager() {
  console.log("Testing Password Manager CSV Import...\n");

  const importer = new PasswordCSVImporter();

  // Test CSV template generation
  console.log("1. Testing CSV template generation:");
  const template = importer.generateTemplate();
  console.log(template);
  console.log("\n");

  // Test CSV import
  console.log("2. Testing CSV import:");
  const testCSV = `login,password,url,category,importance,tags
admin@example.com,secret123,https://example.com,work,5,"admin,important"
user@test.com,password456,https://test.com,personal,3,"social"
invalid-url,weak,not-a-url,test,2,"broken"`;

  try {
    const result = await importer.importFromCSV(testCSV);
    console.log("Import Result:");
    console.log(`- Imported: ${result.imported}`);
    console.log(`- Failed: ${result.failed}`);
    console.log(`- Errors: ${result.errors.join(", ")}`);
    console.log(`- Data count: ${result.data.length}`);

    if (result.data.length > 0) {
      console.log("\nFirst imported credential:");
      const first = result.data[0];
      console.log(`- ID: ${first.id}`);
      console.log(`- Login: ${first.login}`);
      console.log(`- URL: ${first.url}`);
      console.log(`- Category: ${first.category}`);
      console.log(`- Importance: ${first.importance}`);
      console.log(`- Tags: ${first.tags.join(", ")}`);
    }

    console.log("\n3. Testing validation with invalid data:");
    const invalidCSV = `login,password,url,category,importance,tags
,empty-login,https://example.com,work,5,"test"
valid@user.com,,https://example.com,work,5,"test"
valid@user.com,password,invalid-url,work,5,"test"`;

    const invalidResult = await importer.importFromCSV(invalidCSV);
    console.log("Invalid Data Import Result:");
    console.log(`- Imported: ${invalidResult.imported}`);
    console.log(`- Failed: ${invalidResult.failed}`);
    console.log(`- Errors: ${invalidResult.errors.join("; ")}`);
  } catch (error) {
    console.error(
      "Import failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Test the screenshot service basic functionality
console.log("4. Testing Screenshot Service initialization...");
try {
  // Just test that the service can be imported without errors
  const {
    ScreenshotService,
  } = require("./apps/backend/src/modules/password-manager/services/screenshot.js");
  const screenshotService = new ScreenshotService();
  console.log("✓ Screenshot service imported successfully");
} catch (error) {
  console.log(
    "✗ Screenshot service import failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
}

console.log("\n5. Testing API routes module...");
try {
  // Test that the API routes can be imported
  const {
    passwordManagerRoutes,
  } = require("./apps/backend/src/modules/password-manager/routes/api.js");
  console.log("✓ Password manager routes imported successfully");
} catch (error) {
  console.log(
    "✗ Password manager routes import failed:",
    error instanceof Error ? error.message : "Unknown error"
  );
}

testPasswordManager().catch(console.error);
