#!/usr/bin/env node
/**
 * Simple test script to demonstrate NetworkManager console logging
 * Run this to see real-time console output of what the NetworkManager is doing
 */

const path = require('path');

// Add the src directory to the Node.js path
const srcPath = path.join(__dirname, 'src');
require('module').globalPaths.push(srcPath);

function main() {
  console.log('🧪 Testing NetworkManager Console Logging');
  console.log('='.repeat(60));
  console.log('This will show you exactly what the NetworkManager is doing in real-time');
  console.log('Watch the console output to see:');
  console.log('  - File existence checks');
  console.log('  - Command executions');
  console.log('  - Configuration parsing');
  console.log('  - Data processing steps');
  console.log('  - Any errors or warnings');
  console.log('='.repeat(60));
  
  try {
    console.log('\n📥 Importing NetworkManager...');
    const networkManager = require('./src/services/network/networkManager');
    
    console.log('\n🔍 Testing interface discovery...');
    console.log('Current managed interfaces:', networkManager.managedInterfaces);
    
    if (networkManager.managedInterfaces && networkManager.managedInterfaces.length > 0) {
      console.log(`\n📡 Testing first interface: ${networkManager.managedInterfaces[0]}`);
      
      // Test the interface info retrieval
      networkManager.getInterfaceInfo(networkManager.managedInterfaces[0])
        .then(interfaceInfo => {
          console.log(`\n✅ Got interface info for ${interfaceInfo.name}`);
          console.log(`   Admin state: ${interfaceInfo.admin_state}`);
          console.log(`   Operational state: ${interfaceInfo.oper_state}`);
          console.log(`   MAC: ${interfaceInfo.mac}`);
          console.log(`   IPv4 addresses: ${interfaceInfo.ipv4.length}`);
          console.log(`   Routes: ${interfaceInfo.routes.length}`);
          console.log(`   Warnings: ${interfaceInfo.warnings.length}`);
          
          // Test all interfaces
          console.log(`\n🌐 Testing all interfaces...`);
          return networkManager.getAllInterfaces();
        })
        .then(allInfo => {
          console.log(`Total interfaces processed: ${allInfo.interfaces.length}`);
          console.log('\n🎉 Console logging test completed!');
          console.log('Check the output above to see all the detailed logging');
        })
        .catch(error => {
          console.error(`\n❌ Test failed: ${error.message}`);
          console.error('Stack trace:', error.stack);
        });
    } else {
      console.log('\n⚠️  No managed interfaces found');
      console.log('🎉 Console logging test completed!');
      console.log('Check the output above to see all the detailed logging');
    }
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return false;
  }
  
  return true;
}

// Run the test
const success = main();
if (!success) {
  process.exit(1);
}
