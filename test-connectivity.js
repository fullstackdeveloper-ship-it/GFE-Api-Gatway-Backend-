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
 * Test ping functionality directly
 */
async function testPingDirectly() {
  console.log('🧪 Testing ping functionality directly...\n');
  
  try {
    // Test localhost ping
    console.log('📍 Testing localhost ping...');
    const localPing = await execAsync('ping -c 3 -W 2 127.0.0.1', { timeout: 10000 });
    console.log('✅ Localhost ping successful');
    console.log('   Output:', localPing.stdout.split('\n').slice(-3).join('\n   '));
    
    // Test Google DNS ping
    console.log('\n📍 Testing Google DNS ping...');
    const googlePing = await execAsync('ping -c 3 -W 2 8.8.8.8', { timeout: 10000 });
    console.log('✅ Google DNS ping successful');
    console.log('   Output:', googlePing.stdout.split('\n').slice(-3).join('\n   '));
    
    // Test unreachable IP
    console.log('\n📍 Testing unreachable IP ping...');
    try {
      await execAsync('ping -c 3 -W 2 192.168.254.254', { timeout: 10000 });
      console.log('⚠️ Unexpected: Unreachable IP responded');
    } catch (error) {
      console.log('✅ Unreachable IP ping failed as expected');
      console.log('   Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Ping test failed:', error.message);
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
    await testPingDirectly();
    
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
  testPingDirectly,
  testPortConnectivity,
  testAPIEndpoint,
  parsePingOutput
};
