require('dotenv').config();
const natsClient = require('./src/services/nats/natsClient');

const rand = (min, max, dp = 0) =>
  Number((Math.random() * (max - min) + min).toFixed(dp));

const shouldSendZero = () => Math.random() < 0.05; // ~5% zero value chance

// === REGISTER MAKERS (with optional zero case) ===
const makeSolarRegisters = () => {
  return shouldSendZero() ? { W: "0" } : { W: String(rand(500, 4500)) };
};

const makeGridRegisters = () => {
  if (shouldSendZero()) return { W: "0" };

  return Math.random() < 0.5
    ? { W: String(rand(1000, 6000)) }
    : {
        WphA: String(rand(300, 2000)),
        WphB: String(rand(300, 2000)),
        WphC: String(rand(300, 2000))
      };
};

const makeGensetRegisters = () => {
  if (shouldSendZero()) return { W: "0" };

  return Math.random() < 0.5
    ? { W: String(rand(1000, 3500)) }
    : {
        WphA: String(rand(300, 1200)),
        WphB: String(rand(300, 1200)),
        WphC: String(rand(300, 1200))
      };
};


const deviceTypes = [
  {
    device_type: "solar_inverter",
    reference: "SOLAR-INVERTER-001",
    registerFn: makeSolarRegisters
  },
  {
    device_type: "power_meter",
    reference: "POWER-METER-001",
    registerFn: makeGridRegisters
  },
  {
    device_type: "genset_controller",
    reference: "GENSET-CONTROLLER-001",
    registerFn: makeGensetRegisters
  }
];


(async () => {
  const connected = await natsClient.connect();
  if (!connected) {
    console.error("❌ Could not connect to NATS server. Aborting...");
    process.exit(1);
  }

  console.log("✅ Connected to NATS");

  setInterval(async () => {
    const deviceBatch = deviceTypes.map((typeDef) => {
      const deviceName =
        typeDef.device_type + "_" + (1000 + Math.floor(Math.random() * 9000));

      return {
        deviceMataData: {
          device_name: deviceName,
          device_type: typeDef.device_type,
          interface: "eth1",
          protocol: "modbus_tcp",
          reference: typeDef.reference
        },
        register: typeDef.registerFn()
      };
    });

    const payload = {
      data: deviceBatch,
      metadata: {
        batch_id: Date.now().toString(),
        timestamp: Date.now()
      }
    };

    const result = await natsClient.publish('sensor.data', payload);
    if (!result) {
      console.error("⚠️ Failed to publish data.");
    } else {
      const deviceList = deviceBatch.map(d => d.deviceMataData.device_type).join(' + ');
      console.log(`→ Published batch: ${deviceList}`);
    }
  }, 5000);

  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping publisher...");
    await natsClient.disconnect();
    process.exit(0);
  });
})();
