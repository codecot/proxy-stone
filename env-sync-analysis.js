#!/usr/bin/env node

import fs from 'fs';

console.log('🔍 Environment Files Sync Analysis\n');

// Read docker-compose.db.yml
const dockerComposeContent = fs.readFileSync('docker-compose.db.yml', 'utf8');

// Extract default values from docker-compose file
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

// Parse .env file content
const parseEnvFile = (content) => {
  const vars = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        vars[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return vars;
};

// Extract values from DATABASE_URL
const parseConnectionString = (url, type) => {
  const result = {};

  if (type === 'postgresql') {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      result.user = match[1];
      result.password = match[2];
      result.host = match[3];
      result.port = match[4];
      result.database = match[5];
    }
  } else if (type === 'mysql') {
    const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      result.user = match[1];
      result.password = match[2];
      result.host = match[3];
      result.port = match[4];
      result.database = match[5];
    }
  }

  return result;
};

const dockerDefaults = extractDefaults(dockerComposeContent);

console.log('📋 Docker Compose Default Values:');
console.log(JSON.stringify(dockerDefaults, null, 2));

// Analyze PostgreSQL
console.log('\n🐘 PostgreSQL Configuration Analysis:');
if (fs.existsSync('.env.pgsql')) {
  const pgsqlContent = fs.readFileSync('.env.pgsql', 'utf8');
  const pgsqlVars = parseEnvFile(pgsqlContent);

  console.log('Current .env.pgsql variables:');
  console.log(JSON.stringify(pgsqlVars, null, 2));

  if (pgsqlVars.DATABASE_URL) {
    const connDetails = parseConnectionString(pgsqlVars.DATABASE_URL, 'postgresql');
    console.log('\nParsed from DATABASE_URL:');
    console.log(JSON.stringify(connDetails, null, 2));

    console.log('\n🔄 Sync Status:');
    console.log(
      `User: ${connDetails.user} ${connDetails.user === dockerDefaults.POSTGRES_USER ? '✅' : '❌'} (expected: ${dockerDefaults.POSTGRES_USER})`
    );
    console.log(
      `Password: ${connDetails.password} ${connDetails.password === dockerDefaults.POSTGRES_PASSWORD ? '✅' : '❌'} (expected: ${dockerDefaults.POSTGRES_PASSWORD})`
    );
    console.log(
      `Database: ${connDetails.database} ${connDetails.database === dockerDefaults.POSTGRES_DB ? '✅' : '❌'} (expected: ${dockerDefaults.POSTGRES_DB})`
    );
    console.log(
      `Host: ${connDetails.host} ${connDetails.host === 'localhost' ? '✅' : '❌'} (expected: localhost)`
    );
    console.log(
      `Port: ${connDetails.port} ${connDetails.port === '5432' ? '✅' : '❌'} (expected: 5432)`
    );
  }

  // Check PgAdmin settings
  console.log('\n🔧 PgAdmin Settings:');
  console.log(
    `Email: ${pgsqlVars.PGADMIN_EMAIL} ${pgsqlVars.PGADMIN_EMAIL === dockerDefaults.PGADMIN_EMAIL ? '✅' : '❌'} (expected: ${dockerDefaults.PGADMIN_EMAIL})`
  );
  console.log(
    `Password: ${pgsqlVars.PGADMIN_PASSWORD} ${pgsqlVars.PGADMIN_PASSWORD === dockerDefaults.PGADMIN_PASSWORD ? '✅' : '❌'} (expected: ${dockerDefaults.PGADMIN_PASSWORD})`
  );
} else {
  console.log('❌ .env.pgsql file not found');
}

// Analyze MySQL
console.log('\n🐬 MySQL Configuration Analysis:');
if (fs.existsSync('.env.mysql')) {
  const mysqlContent = fs.readFileSync('.env.mysql', 'utf8');
  const mysqlVars = parseEnvFile(mysqlContent);

  console.log('Current .env.mysql variables:');
  console.log(JSON.stringify(mysqlVars, null, 2));

  if (mysqlVars.DATABASE_URL) {
    const connDetails = parseConnectionString(mysqlVars.DATABASE_URL, 'mysql');
    console.log('\nParsed from DATABASE_URL:');
    console.log(JSON.stringify(connDetails, null, 2));

    console.log('\n🔄 Sync Status:');
    console.log(
      `User: ${connDetails.user} ${connDetails.user === dockerDefaults.MYSQL_USER ? '✅' : '❌'} (expected: ${dockerDefaults.MYSQL_USER})`
    );
    console.log(
      `Password: ${connDetails.password} ${connDetails.password === dockerDefaults.MYSQL_PASSWORD ? '✅' : '❌'} (expected: ${dockerDefaults.MYSQL_PASSWORD})`
    );
    console.log(
      `Database: ${connDetails.database} ${connDetails.database === dockerDefaults.MYSQL_DATABASE ? '✅' : '❌'} (expected: ${dockerDefaults.MYSQL_DATABASE})`
    );
    console.log(
      `Host: ${connDetails.host} ${connDetails.host === 'localhost' ? '✅' : '❌'} (expected: localhost)`
    );
    console.log(
      `Port: ${connDetails.port} ${connDetails.port === '3306' ? '✅' : '❌'} (expected: 3306)`
    );
  }
} else {
  console.log('❌ .env.mysql file not found');
}

console.log('\n📊 Summary:');
console.log('The .env files use a simplified format with DATABASE_URL connection strings,');
console.log('while docker-compose.db.yml uses individual environment variables.');
console.log('Both approaches are valid, but the values should match for consistency.');
