#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Extract environment variables from docker-compose.db.yml
const dockerComposeContent = fs.readFileSync('docker-compose.db.yml', 'utf8');

// Parse default values from docker-compose file
const extractDefaults = (content) => {
  const defaults = {};
  const envVarRegex = /\$\{([^:}]+):-([^}]+)\}/g;
  let match;

  while ((match = envVarRegex.exec(content)) !== null) {
    const [, varName, defaultValue] = match;
    defaults[varName] = defaultValue;
  }

  return defaults;
};

const defaults = extractDefaults(dockerComposeContent);

console.log('🔍 Found environment variables in docker-compose.db.yml:');
console.log(JSON.stringify(defaults, null, 2));

// Define the expected environment files content
const pgsqlEnvContent = `# PostgreSQL Database Configuration
POSTGRES_USER=${defaults.POSTGRES_USER || 'devuser'}
POSTGRES_PASSWORD=${defaults.POSTGRES_PASSWORD || 'devpass'}
POSTGRES_DB=${defaults.POSTGRES_DB || 'proxydb'}

# PgAdmin Configuration
PGADMIN_EMAIL=${defaults.PGADMIN_EMAIL || 'admin@local.dev'}
PGADMIN_PASSWORD=${defaults.PGADMIN_PASSWORD || 'adminpass'}

# Database Connection Settings (for application use)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${defaults.POSTGRES_DB || 'proxydb'}
DB_USER=${defaults.POSTGRES_USER || 'devuser'}
DB_PASSWORD=${defaults.POSTGRES_PASSWORD || 'devpass'}
`;

const mysqlEnvContent = `# MySQL Database Configuration
MYSQL_ROOT_PASSWORD=${defaults.MYSQL_ROOT_PASSWORD || 'rootpass'}
MYSQL_DATABASE=${defaults.MYSQL_DATABASE || 'proxydb'}
MYSQL_USER=${defaults.MYSQL_USER || 'devuser'}
MYSQL_PASSWORD=${defaults.MYSQL_PASSWORD || 'devpass'}

# Database Connection Settings (for application use)
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${defaults.MYSQL_DATABASE || 'proxydb'}
DB_USER=${defaults.MYSQL_USER || 'devuser'}
DB_PASSWORD=${defaults.MYSQL_PASSWORD || 'devpass'}
`;

// Check if files exist and compare
const checkFile = (filename, expectedContent) => {
  console.log(`\n📁 Checking ${filename}:`);

  if (fs.existsSync(filename)) {
    const currentContent = fs.readFileSync(filename, 'utf8');
    if (currentContent.trim() === expectedContent.trim()) {
      console.log(`✅ ${filename} exists and is synced with docker-compose.db.yml`);
      return true;
    } else {
      console.log(`⚠️  ${filename} exists but has different values`);
      console.log('Expected content:');
      console.log(expectedContent);
      console.log('\nCurrent content:');
      console.log(currentContent);
      return false;
    }
  } else {
    console.log(`❌ ${filename} does not exist`);
    console.log('Expected content:');
    console.log(expectedContent);

    // Create the file
    try {
      fs.writeFileSync(filename, expectedContent);
      console.log(`✅ Created ${filename} with synced values`);
      return true;
    } catch (error) {
      console.log(`❌ Failed to create ${filename}: ${error.message}`);
      return false;
    }
  }
};

console.log('\n🔄 Checking environment files sync...\n');

const pgsqlSynced = checkFile('.env.pgsql', pgsqlEnvContent);
const mysqlSynced = checkFile('.env.mysql', mysqlEnvContent);

console.log('\n📊 Summary:');
console.log(`PostgreSQL env file: ${pgsqlSynced ? '✅ Synced' : '❌ Not synced'}`);
console.log(`MySQL env file: ${mysqlSynced ? '✅ Synced' : '❌ Not synced'}`);

if (pgsqlSynced && mysqlSynced) {
  console.log('\n🎉 All environment files are synced with docker-compose.db.yml!');
} else {
  console.log('\n⚠️  Some environment files need attention. Please review the output above.');
}
