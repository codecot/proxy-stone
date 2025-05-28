#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Storage Plugins Verification\n');

// Import the storage system
let StorageFactory, StorageType, StoragePluginRegistry;

try {
  // Try to import from the built dist
  const distPath = join(__dirname, 'dist', 'database', 'storage-factory.js');
  const module = await import(distPath);
  StorageFactory = module.StorageFactory;
  StorageType = module.StorageType;
  StoragePluginRegistry = module.StoragePluginRegistry;
} catch (error) {
  console.log('⚠️  Dist not available, trying to build first...');
  
  // Try to build the project
  const { spawn } = await import('child_process');
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  await new Promise((resolve, reject) => {
    buildProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
  
  // Try import again
  try {
    const distPath = join(__dirname, 'dist', 'database', 'storage-factory.js');
    const module = await import(distPath);
    StorageFactory = module.StorageFactory;
    StorageType = module.StorageType;
    StoragePluginRegistry = module.StoragePluginRegistry;
  } catch (importError) {
    console.error('❌ Failed to import storage modules:', importError.message);
    process.exit(1);
  }
}

// Define expected storage types from the enum
const expectedStorageTypes = [
  'sqlite',
  'mysql', 
  'postgresql',
  'mongodb',
  'redis',
  'dynamodb',
  's3',
  'local_file',
  'azure_blob',
  'gcs'
];

// Define core storage types (should be implemented)
const coreStorageTypes = [
  'sqlite',
  'mysql',
  'postgresql', 
  'local_file'
];

// Define external storage types (may need plugins)
const externalStorageTypes = [
  'mongodb',
  'redis',
  's3',
  'dynamodb',
  'azure_blob',
  'gcs'
];

const testStoragePlugin = async (storageType) => {
  console.log(`\n📋 Testing ${storageType.toUpperCase()} Storage Plugin`);
  console.log('='.repeat(50));
  
  try {
    // Initialize the storage factory
    await StorageFactory.initialize();
    
    // Check if plugin is registered
    const isSupported = StoragePluginRegistry.isSupported(storageType);
    console.log(`🔌 Plugin registered: ${isSupported ? '✅' : '❌'}`);
    
    if (!isSupported) {
      console.log(`⚠️  ${storageType} plugin not registered`);
      return { success: false, reason: 'Plugin not registered' };
    }
    
    // Get plugin info
    const plugin = StoragePluginRegistry.getPlugin(storageType);
    if (plugin) {
      console.log(`📦 Plugin name: ${plugin.name}`);
      console.log(`📝 Description: ${plugin.description}`);
      console.log(`🔗 Dependencies: ${plugin.dependencies?.join(', ') || 'None'}`);
    }
    
    // Try to get default config
    let config;
    try {
      config = StorageFactory.getDefaultConfig(storageType);
      console.log(`⚙️  Default config: ✅`);
    } catch (error) {
      console.log(`⚙️  Default config: ❌ (${error.message})`);
      
      // Create minimal config for testing
      config = { type: storageType };
      
      // Add required fields based on storage type
      switch (storageType) {
        case 'sqlite':
          config.path = './test-storage.db';
          break;
        case 'mysql':
        case 'postgresql':
          config.host = 'localhost';
          config.database = 'test';
          break;
        case 'local_file':
          config.directory = './test-storage';
          break;
        case 'mongodb':
          config.connectionString = 'mongodb://localhost:27017';
          config.database = 'test';
          config.collection = 'test';
          break;
        case 'redis':
          config.host = 'localhost';
          config.port = 6379;
          break;
        case 's3':
          config.bucket = 'test-bucket';
          config.region = 'us-east-1';
          break;
      }
    }
    
    // Try to create adapter
    try {
      const adapter = await StorageFactory.createStorageAdapter(config);
      console.log(`🏗️  Adapter creation: ✅`);
      
      // Test adapter interface
      const hasRequiredMethods = [
        'initialize', 'close', 'save', 'get', 'delete', 'exists',
        'saveBatch', 'getBatch', 'deleteBatch', 'find', 'count',
        'cleanup', 'getStats', 'getStorageType'
      ].every(method => typeof adapter[method] === 'function');
      
      console.log(`🔧 Interface compliance: ${hasRequiredMethods ? '✅' : '❌'}`);
      
      // Test storage type method
      try {
        const reportedType = adapter.getStorageType();
        console.log(`🏷️  Storage type: ${reportedType} ${reportedType === storageType ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`🏷️  Storage type: ❌ (${error.message})`);
      }
      
      return { 
        success: true, 
        hasAdapter: true, 
        interfaceCompliant: hasRequiredMethods,
        plugin: plugin
      };
      
    } catch (error) {
      console.log(`🏗️  Adapter creation: ❌ (${error.message})`);
      return { 
        success: false, 
        reason: `Adapter creation failed: ${error.message}`,
        hasPlugin: true,
        plugin: plugin
      };
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return { success: false, reason: error.message };
  }
};

const checkAdapterFiles = () => {
  console.log('\n📁 Checking Storage Adapter Files');
  console.log('='.repeat(50));
  
  const adapterFiles = [
    'sqlite-adapter.ts',
    'mysql-adapter.ts', 
    'postgresql-adapter.ts',
    'mongodb-storage-adapter.ts',
    's3-storage-adapter.ts'
  ];
  
  const srcPath = join(__dirname, 'src', 'database', 'adapters');
  
  adapterFiles.forEach(file => {
    try {
      const filePath = join(srcPath, file);
      const content = readFileSync(filePath, 'utf8');
      const hasExport = content.includes('export class') || content.includes('export default');
      console.log(`📄 ${file}: ${hasExport ? '✅' : '❌'} ${hasExport ? 'Found' : 'Missing export'}`);
    } catch (error) {
      console.log(`📄 ${file}: ❌ File not found`);
    }
  });
};

const main = async () => {
  console.log('🚀 Starting Storage Plugins Verification\n');
  
  // Check adapter files first
  checkAdapterFiles();
  
  const results = {};
  
  // Test all expected storage types
  for (const storageType of expectedStorageTypes) {
    results[storageType] = await testStoragePlugin(storageType);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 STORAGE PLUGINS VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  const coreResults = coreStorageTypes.map(type => ({ type, result: results[type] }));
  const externalResults = externalStorageTypes.map(type => ({ type, result: results[type] }));
  
  console.log('\n🏗️  CORE STORAGE PLUGINS (Built-in):');
  coreResults.forEach(({ type, result }) => {
    const status = result.success ? '✅ WORKING' : '❌ FAILED';
    console.log(`   ${type.toUpperCase()}: ${status}`);
    if (!result.success) {
      console.log(`      Reason: ${result.reason}`);
    }
  });
  
  console.log('\n🔌 EXTERNAL STORAGE PLUGINS (Require dependencies):');
  externalResults.forEach(({ type, result }) => {
    const status = result.success ? '✅ WORKING' : 
                   result.hasPlugin ? '⚠️  PLUGIN AVAILABLE' : '❌ NOT IMPLEMENTED';
    console.log(`   ${type.toUpperCase()}: ${status}`);
    if (!result.success && result.reason) {
      console.log(`      Reason: ${result.reason}`);
    }
  });
  
  // Overall statistics
  const totalWorking = Object.values(results).filter(r => r.success).length;
  const totalPlugins = Object.values(results).filter(r => r.hasPlugin || r.success).length;
  const coreWorking = coreResults.filter(r => r.result.success).length;
  
  console.log('\n📈 STATISTICS:');
  console.log(`   Working storage adapters: ${totalWorking}/${expectedStorageTypes.length}`);
  console.log(`   Available plugins: ${totalPlugins}/${expectedStorageTypes.length}`);
  console.log(`   Core storage working: ${coreWorking}/${coreStorageTypes.length}`);
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  
  const failedCore = coreResults.filter(r => !r.result.success);
  if (failedCore.length > 0) {
    console.log('   🔧 Fix core storage issues:');
    failedCore.forEach(({ type, result }) => {
      console.log(`      - ${type}: ${result.reason}`);
    });
  }
  
  const missingExternal = externalResults.filter(r => !r.result.hasPlugin && !r.result.success);
  if (missingExternal.length > 0) {
    console.log('   📦 Implement missing external plugins:');
    missingExternal.forEach(({ type }) => {
      console.log(`      - ${type}: Create adapter and register plugin`);
    });
  }
  
  const availableButBroken = Object.entries(results).filter(([_, r]) => r.hasPlugin && !r.success);
  if (availableButBroken.length > 0) {
    console.log('   🔨 Fix broken plugins:');
    availableButBroken.forEach(([type, result]) => {
      console.log(`      - ${type}: ${result.reason}`);
    });
  }
  
  console.log('\n🏁 Verification Complete!');
  
  // Exit with appropriate code
  const criticalIssues = coreWorking < coreStorageTypes.length;
  process.exit(criticalIssues ? 1 : 0);
};

main().catch(console.error); 