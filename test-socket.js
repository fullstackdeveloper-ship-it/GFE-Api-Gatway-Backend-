#!/usr/bin/env node
/**
 * Test Socket.IO broadcasting
 */

const io = require('socket.io-client');

async function testSocketConnection() {
  console.log('🧪 Testing Socket.IO connection and broadcasting...\n');
  
  const socket = io('http://localhost:5001');
  
  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Listen for sensor data
    socket.on('sensor-data', (data) => {
      console.log('📨 Received sensor data:');
      console.log(JSON.stringify(data, null, 2));
    });
    
    // Listen for welcome message
    socket.on('welcome', (data) => {
      console.log('👋 Welcome message received:', data.message);
    });
    
    // Test after 2 seconds
    setTimeout(() => {
      console.log('\n🧪 Testing broadcast endpoint...');
      fetch('http://localhost:5001/test-broadcast')
        .then(response => response.json())
        .then(data => {
          console.log('📡 Test broadcast response:', data);
        })
        .catch(error => {
          console.error('❌ Test broadcast failed:', error.message);
        });
    }, 2000);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Disconnected from Socket.IO server');
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
  });
  
  // Keep the connection alive for 10 seconds
  setTimeout(() => {
    console.log('\n🏁 Test completed');
    socket.disconnect();
    process.exit(0);
  }, 10000);
}

testSocketConnection().catch(console.error);
