// continuous-push.js - Simulate continuous sensor data streaming
require('dotenv').config();
const natsClient = require('./src/services/nats/natsClient');

// Sample sensor data for multiple devices
const sensorDevices = [
  {
    deviceMataData: {
      device_name: "test",
      device_type: "test",
      interface: "eth1",
      protocol: "modbus_tcp",
      reference: "TEST-MODEL-001"
    },
    register: {
      AphA: "0",
      AphB: "0",
      AphC: "0",
      Hz: "50",
      PF: "1",
      PFPhA: "1",
      PFPhB: "1",
      PFPhC: "1",
      PPVphAB: "415",
      PPVphBC: "415",
      PPVphCA: "415",
      PhVphA: "240",
      PhVphB: "240",
      PhVphC: "240",
      VA: "0",
      VAR: "0",
      VARphA: "0",
      VARphB: "0",
      VARphC: "0",
      VAphA: "0",
      VAphB: "0",
      VAphC: "0",
      W: "0",
      WH: "0",
      WphA: "0",
      WphB: "0",
      WphC: "0"
    }
  },
  {
    deviceMataData: {
      device_name: "bms-001",
      device_type: "bms",
      interface: "serial_1",
      protocol: "modbus_rtu",
      reference: "BMS-MODEL-001"
    },
    register: {
      DCA: "10.5",
      DCV: "48.2",
      DCW: "506.1",
      Tmp: "25.3",
      Eff: "95.2",
      VA: "120.5",
      VAR: "15.2",
      VAphA: "40.1",
      VAphB: "40.2",
      VAphC: "40.2",
      VARphA: "5.1",
      VARphB: "5.0",
      VARphC: "5.1",
      W: "115.3",
      WphA: "38.4",
      WphB: "38.5",
      WphC: "38.4",
      WMax: "80.0",
      VARSet: "20.0",
      WHPos: "1250.5",
      WHPosDaily: "45.2",
      WHNeg: "0.0",
      WHNegDaily: "0.0"
    }
  }
];

// Function to generate random variations in sensor data
function generateRandomVariation(baseValue, variationPercent = 5) {
  const base = parseFloat(baseValue);
  const variation = (base * variationPercent) / 100;
  const randomChange = (Math.random() - 0.5) * 2 * variation;
  return (base + randomChange).toFixed(1);
}

// Function to update sensor data with random variations
function updateSensorData() {
  return sensorDevices.map(device => ({
    ...device,
    register: Object.fromEntries(
      Object.entries(device.register).map(([key, value]) => [
        key,
        generateRandomVariation(value, 3) // 3% variation
      ])
    )
  }));
}

// Function to send sensor data
async function sendSensorData() {
  try {
    const updatedDevices = updateSensorData();
    const payload = {
      data: updatedDevices,
      metadata: {
        batch_id: Date.now().toString(),
        timestamp: Date.now() // Send as number, not string
      }
    };

    console.log(`📤 Sending continuous sensor data at ${new Date().toLocaleTimeString()}`);
    console.log(`   Devices: ${updatedDevices.map(d => d.deviceMataData.device_name).join(', ')}`);
    
    const result = await natsClient.publish('sensor.data', payload);
    if (result) {
      console.log(`✅ Data sent successfully`);
    } else {
      console.log(`❌ Failed to send data`);
    }
  } catch (error) {
    console.error('Error sending sensor data:', error);
  }
}

// Main function to start continuous streaming
async function startContinuousStreaming() {
  console.log('🚀 Starting continuous sensor data streaming...');
  
  // Connect to NATS
  const connected = await natsClient.connect();
  if (!connected) {
    console.error("❌ Could not connect to NATS server. Aborting...");
    process.exit(1);
  }

  console.log('✅ Connected to NATS server');
  console.log('📡 Starting continuous data stream every 5 seconds...');
  console.log('   Press Ctrl+C to stop');

  // Send initial data
  await sendSensorData();

  // Set up continuous streaming every 5 seconds
  const intervalId = setInterval(async () => {
    await sendSensorData();
  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping continuous streaming...');
    clearInterval(intervalId);
    await natsClient.disconnect();
    console.log('✅ Disconnected from NATS');
    process.exit(0);
  });
}

// Start the continuous streaming
startContinuousStreaming().catch(error => {
  console.error('❌ Error in continuous streaming:', error);
  process.exit(1);
});
