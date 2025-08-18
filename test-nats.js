#!/usr/bin/env node
/**
 * Simple NATS connection test script
 * This will help debug the NATS connection issue
 */

const { connect } = require('nats');

async function testNatsConnection() {
  const natsUrl = "nats://edge:CHANGE_ME_STRONG@192.168.100.187:4222";
  
  console.log('🧪 Testing NATS Connection');
  console.log('========================');
  console.log(`NATS URL: ${natsUrl}`);
  
  // Method 1: Direct URL
  try {
    console.log('\n📡 Method 1: Direct URL connection...');
    const nc1 = await connect({
      servers: natsUrl,
      timeout: 5000
    });
    console.log('✅ Method 1: Direct URL connection succeeded!');
    await nc1.close();
  } catch (error) {
    console.log(`❌ Method 1 failed: ${error.message}`);
  }
  
  // Method 2: Parsed URL
  try {
    console.log('\n📡 Method 2: Parsed URL connection...');
    const url = new URL(natsUrl);
    const host = `${url.protocol}//${url.host}`;
    const user = url.username;
    const pass = url.password;
    
    console.log(`   Host: ${host}`);
    console.log(`   User: ${user || 'none'}`);
    console.log(`   Pass: ${pass ? '***' : 'none'}`);
    
    const nc2 = await connect({
      servers: host,
      user: user || undefined,
      pass: pass || undefined,
      timeout: 5000
    });
    console.log('✅ Method 2: Parsed URL connection succeeded!');
    await nc2.close();
  } catch (error) {
    console.log(`❌ Method 2 failed: ${error.message}`);
  }
  
  // Method 3: Alternative format
  try {
    console.log('\n📡 Method 3: Alternative format...');
    const nc3 = await connect({
      servers: "nats://192.168.100.187:4222",
      user: "edge",
      pass: "CHANGE_ME_STRONG",
      timeout: 5000
    });
    console.log('✅ Method 3: Alternative format connection succeeded!');
    await nc3.close();
  } catch (error) {
    console.log(`❌ Method 3 failed: ${error.message}`);
  }
  
  console.log('\n🎯 Test completed!');
}

// Run the test
testNatsConnection().catch(console.error);
