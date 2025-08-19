// pushData.js
require('dotenv').config();
const natsClient = require('./src/services/nats/natsClient');

// Your payload
const payload = {
  data: [
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
    }
  ],
  metadata: {
    batch_id: "587142",
    timestamp: "1755587142"
  }
};

(async () => {
  const connected = await natsClient.connect();
  if (!connected) {
    console.error("❌ Could not connect to NATS server. Aborting...");
    process.exit(1);
  }

  const result = await natsClient.publish('sensor.data', payload);
  if (!result) {
    console.error("❌ Failed to publish data.");
  }

  await natsClient.disconnect();
})();
