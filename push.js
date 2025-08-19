// pushData.js
require('dotenv').config();
const natsClient = require('./src/services/nats/natsClient');

const rand = (min, max, dp = 0) =>
  Number((Math.random() * (max - min) + min).toFixed(dp));

const makeRegisters = () => ({
  AphA: String(rand(0, 40, 1)),
  AphB: String(rand(0, 40, 1)),
  AphC: String(rand(0, 40, 1)),
  Hz: String(rand(49.8, 50.2, 2)),
  PF: String(rand(0.85, 1, 2)),
  PFPhA: String(rand(0.85, 1, 2)),
  PFPhB: String(rand(0.85, 1, 2)),
  PFPhC: String(rand(0.85, 1, 2)),
  PPVphAB: String(rand(200, 500)),
  PPVphBC: String(rand(200, 500)),
  PPVphCA: String(rand(200, 500)),
  PhVphA: String(rand(220, 242)),
  PhVphB: String(rand(220, 242)),
  PhVphC: String(rand(220, 242)),
  VA: String(rand(0, 5000)),
  VAR: String(rand(0, 2000)),
  VARphA: String(rand(0, 1000)),
  VARphB: String(rand(0, 1000)),
  VARphC: String(rand(0, 1000)),
  VAphA: String(rand(0, 2000)),
  VAphB: String(rand(0, 2000)),
  VAphC: String(rand(0, 2000)),
  W: String(rand(0, 3000)),
  WH: String(rand(0, 100000)),
  WphA: String(rand(0, 1000)),
  WphB: String(rand(0, 1000)),
  WphC: String(rand(0, 1000)),
});

(async () => {
  const connected = await natsClient.connect();
  if (!connected) {
    console.error("❌ Could not connect to NATS server. Aborting...");
    process.exit(1);
  }

  console.log("✅ Connected to NATS");

  setInterval(async () => {
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
          register: makeRegisters(),
        }
      ],
      metadata: {
        batch_id: Date.now().toString(),
        timestamp: Date.now()
      }
    };

    const result = await natsClient.publish('sensor.data', payload);
    if (!result) {
      console.error("⚠️ Failed to publish data.");
    } else {
      console.log("→ Published random payload");
    }
  }, 1000);

  // Handle exit
  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping publisher...");
    await natsClient.disconnect();
    process.exit(0);
  });
})();
