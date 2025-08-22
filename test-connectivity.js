#!/usr/bin/env node

/**
 * Test script for connectivity testing functionality
 * Run with: node test-connectivity.js
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Test configuration
const TEST_CONFIG = {
  // Test a local IP (localhost)
  localTest: {
    type: 'tcp',
    ip: '127.0.0.1',
    port: 80,
    timeout: 5000
  },
  
  // Test a public IP (Google DNS)
  publicTest: {
    type: 'tcp',
    ip: '8.8.8.8',
    port: 53,
    timeout: 5000
  },
  
  // Test an unreachable IP
  unreachableTest: {
    type: 'tcp',
    ip: '192.168.254.254',
    port: 80,
    timeout: 5000
  }
};

/**
 * Test HTTP connectivity functionality directly
 */
async function testHttpConnectivityDirectly() {
  console.log('🧪 Testing HTTP connectivity functionality directly...\n');
  
  try {
    // Test localhost HTTP connectivity
    console.log('📍 Testing localhost HTTP connectivity...');
    try {
      const localHttp = await execAsync('curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5001/health', { timeout: 10000 });
      const httpCode = parseInt(localHttp.stdout.trim());
      if (httpCode >= 200 && httpCode < 400) {
        console.log('✅ Localhost HTTP connectivity successful (HTTP ' + httpCode + ')');
      } else {
        console.log('⚠️ Localhost HTTP connectivity failed (HTTP ' + httpCode + ')');
      }
    } catch (error) {
      console.log('⚠️ Localhost HTTP connectivity failed:', error.message);
    }
    
    // Test Google connectivity check
    console.log('\n📍 Testing Google connectivity check...');
    try {
      const googleHttp = await execAsync('curl -sS -o /dev/null -w "%{http_code}\n" https://connectivitycheck.gstatic.com/generate_204', { timeout: 10000 });
      const httpCode = parseInt(googleHttp.stdout.trim());
      if (httpCode === 204) {
        console.log('✅ Google connectivity check successful (HTTP 204)');
      } else {
        console.log('⚠️ Google connectivity check failed (HTTP ' + httpCode + ')');
      }
    } catch (error) {
      console.log('❌ Google connectivity check failed:', error.message);
    }
    
    // Test unreachable domain
    console.log('\n📍 Testing unreachable domain...');
    try {
      await execAsync('curl -sS -o /dev/null -w "%{http_code}\n" https://unreachable-domain-12345.com', { timeout: 10000 });
      console.log('⚠️ Unexpected: Unreachable domain responded');
    } catch (error) {
      console.log('✅ Unreachable domain failed as expected');
      console.log('   Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ HTTP connectivity test failed:', error.message);
  }
}

/**
 * Test port connectivity
 */
async function testPortConnectivity() {
  console.log('\n🔌 Testing port connectivity...\n');
  
  try {
    // Test localhost port 80 (usually not open)
    console.log('📍 Testing localhost port 80...');
    try {
      await execAsync('nc -z -w 2 127.0.0.1 80', { timeout: 5000 });
      console.log('✅ Port 80 is open on localhost');
    } catch (error) {
      console.log('✅ Port 80 is closed on localhost (expected)');
    }
    
    // Test localhost port 22 (SSH, usually open)
    console.log('\n📍 Testing localhost port 22 (SSH)...');
    try {
      await execAsync('nc -z -w 2 127.0.0.1 22', { timeout: 5000 });
      console.log('✅ Port 22 (SSH) is open on localhost');
    } catch (error) {
      console.log('⚠️ Port 22 (SSH) is closed on localhost');
    }
    
  } catch (error) {
    console.error('❌ Port connectivity test failed:', error.message);
  }
}

/**
 * Test the API endpoint (if server is running)
 */
async function testAPIEndpoint() {
  console.log('\n🌐 Testing API endpoint...\n');
  
  try {
    const fetch = require('node-fetch');
    
    // Test localhost connectivity
    console.log('📍 Testing API endpoint with localhost...');
    const response = await fetch('http://localhost:5001/api/connectivity/test-connectivity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_CONFIG.localTest)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API test successful');
      console.log('   Result:', JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️ API test failed with status:', response.status);
      const errorText = await response.text();
      console.log('   Error:', errorText);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️ Server not running on localhost:5001');
      console.log('   Start the server first with: npm start');
    } else {
      console.error('❌ API test failed:', error.message);
    }
  }
}

/**
 * Parse ping output (same function as in the route)
 */
function parsePingOutput(pingOutput) {
  try {
    const lines = pingOutput.split('\n');
    
    // Extract packet statistics
    const statsLine = lines.find(line => line.includes('packets transmitted'));
    const rttLine = lines.find(line => line.includes('rtt min/avg/max'));
    
    let packetsSent = 0, packetsReceived = 0, packetLoss = 0;
    let avgRtt = 0;
    
    if (statsLine) {
      const statsMatch = statsLine.match(/(\d+) packets transmitted, (\d+) received/);
      if (statsMatch) {
        packetsSent = parseInt(statsMatch[1]);
        packetsReceived = parseInt(statsMatch[2]);
        packetLoss = packetsSent > 0 ? ((packetsSent - packetsReceived) / packetsSent * 100).toFixed(1) : 0;
      }
    }
    
    if (rttLine) {
      const rttMatch = rttLine.match(/rtt min\/avg\/max\/mdev = [\d.]+ \/([\d.]+) \/[\d.]+ \/[\d.]+ ms/);
      if (rttMatch) {
        avgRtt = parseFloat(rttMatch[1]);
      }
    }
    
    return {
      packetsSent,
      packetsReceived,
      packetLoss: parseFloat(packetLoss),
      avgRtt
    };
    
  } catch (error) {
    console.error('Error parsing ping output:', error);
    return {
      packetsSent: 0,
      packetsReceived: 0,
      packetLoss: 100,
      avgRtt: 0
    };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Connectivity Testing Verification...\n');
  
  try {
    // Test 1: Direct ping functionality
    await testHttpConnectivityDirectly();
    
    // Test 2: Port connectivity
    await testPortConnectivity();
    
    // Test 3: API endpoint (if server running)
    await testAPIEndpoint();
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testHttpConnectivityDirectly,
  testPortConnectivity,
  testAPIEndpoint,
  parsePingOutput
};
