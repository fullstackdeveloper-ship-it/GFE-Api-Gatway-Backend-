// sensor-publisher.js
require('dotenv').config();
const natsClient = require('./src/modules/services/nats/natsClient');

/**
 * Helper utilities
 */
const rand = (min, max, dp = 0) =>
  Number((Math.random() * (max - min) + min).toFixed(dp));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const s = (n, dp = null) =>
  String(typeof n === 'number' ? (dp === null ? n : Number(n.toFixed(dp))) : n);

// Persist per-device state so counters (WH*, etc.) only go up
const state = Object.create(null);

/**
 * Device definitions — names/types MUST match your sample payload
 */
const DEVICES = [
  // Inverters
  {
    device_name: 'Inv1',
    device_type: 'solar_inverter',
    reference: 'GFE-100KTL',
  },
  {
    device_name: 'Inv2',
    device_type: 'solar_inverter',
    reference: 'GFE-100KTL',
  },
  {
    device_name: 'Inv3',
    device_type: 'solar_inverter',
    reference: 'GFE-100KTL',
  },

  // Power meters
  {
    device_name: 'Gen1',
    device_type: 'power_meter',
    reference: 'EMPro',
  },
  {
    device_name: 'Generator 2',
    device_type: 'power_meter',
    reference: 'EMPro',
  },
  {
    device_name: 'Grid',
    device_type: 'power_meter',
    reference: 'EMPro',
  },
];

/**
 * Initialize device state
 */
const ensureState = (name, kind) => {
  if (!state[name]) {
    state[name] = {
      // energy counters (Wh)
      WHPos: 0,
      WHNeg: 0,
      WHToday: 0,
      WHMonth: 0,
      // last update timestamp (ms)
      t: Date.now(),
      // small per-device drift so values feel unique
      drift: rand(-0.5, 0.5, 3),
      // remember last W to integrate energy smoothly
      lastW: 0,
      // device kind for conditional fields
      kind,
    };
  }
  return state[name];
};

/**
 * Integrate energy counters using trapezoid rule (approx)
 * dt in seconds, P in watts => dE (Wh) = P * dt / 3600
 */
const integrateEnergy = (st, W, dtSec) => {
  const avgW = (W + st.lastW) / 2;
  const dWh = (avgW * dtSec) / 3600;
  st.WHPos = Math.max(0, st.WHPos + Math.max(0, dWh)); // positive import
  st.WHNeg = Math.max(0, st.WHNeg + Math.max(0, -dWh)); // negative (if any)
  st.WHToday = Math.max(0, st.WHToday + Math.max(0, dWh));
  st.WHMonth = Math.max(0, st.WHMonth + Math.max(0, dWh));
  st.lastW = W;
};

/**
 * Build registers for SOLAR INVERTER (matches ALL keys in your sample)
 * - Includes DCA1..DCA16, DCVMPPT1..8, DCWMPPT1..8
 * - AC side voltages, powers, PF, Hz, etc.
 * - Energy counters: WHPos, WHToday, WHMonth (monotonic increasing)
 */
const buildSolarRegisters = (name) => {
  const st = ensureState(name, 'inverter');
  const now = Date.now();
  const dtSec = Math.max(1, (now - st.t) / 1000);
  st.t = now;

  // Simulate DC side
  const DCA = Array.from({ length: 16 }, () => rand(0, 14, 2)); // 0–14 A per string
  const DCV = Array.from({ length: 8 }, () => rand(450, 780, 1)); // 450–780 V per MPPT
  const MPPTPairs = Array.from({ length: 8 }, (_, i) => DCA[i * 2] + DCA[i * 2 + 1]);
  const DCW = MPPTPairs.map((iSum, idx) => iSum * DCV[idx]); // ~V*I (W)

  // AC side — three phase outputs
  const Hz = rand(49.8, 50.2, 3);
  const PhVphA = rand(228, 242, 1);
  const PhVphB = rand(228, 242, 1);
  const PhVphC = rand(228, 242, 1);
  const PPVphAB = PhVphA * Math.sqrt(3);
  const PPVphBC = PhVphB * Math.sqrt(3);
  const PPVphCA = PhVphC * Math.sqrt(3);

  // phase active power (W)
  const WphA = rand(1000, 45000);
  const WphB = rand(1000, 45000);
  const WphC = rand(1000, 45000);
  const W = WphA + WphB + WphC;

  // apparent/var per phase (very rough)
  const PFphA = rand(0.96, 1, 3);
  const PFphB = rand(0.96, 1, 3);
  const PFphC = rand(0.96, 1, 3);
  const PF = clamp(((PFphA + PFphB + PFphC) / 3) + st.drift * 0.01, 0.95, 1);

  const VAphA = WphA / PFphA;
  const VAphB = WphB / PFphB;
  const VAphC = WphC / PFphC;
  const VA = VAphA + VAphB + VAphC;

  // Q = sqrt(S^2 - P^2) but phase wise (avoid NaN with clamp)
  const VARphA = Math.sqrt(Math.max(0, VAphA * VAphA - WphA * WphA));
  const VARphB = Math.sqrt(Math.max(0, VAphB * VAphB - WphB * WphB));
  const VARphC = Math.sqrt(Math.max(0, VAphC * VAphC - WphC * WphC));
  const VAR = VARphA + VARphB + VARphC;

  // monotonically increase energy counters
  integrateEnergy(st, W, dtSec);

  return {
    // DCA1..16
    ...Object.fromEntries(DCA.map((v, i) => [`DCA${i + 1}`, s(v, 2)])),
    // DCVMPPT1..8
    ...Object.fromEntries(DCV.map((v, i) => [`DCVMPPT${i + 1}`, s(v, 1)])),
    // DCWMPPT1..8
    ...Object.fromEntries(DCW.map((v, i) => [`DCWMPPT${i + 1}`, s(v, 0)])),

    // AC + powers
    Hz: s(Hz, 3),
    PF: s(PF, 3),
    PFphA: s(PFphA, 3),
    PFphB: s(PFphB, 3),
    PFphC: s(PFphC, 3),

    PPVphAB: s(PPVphAB, 2),
    PPVphBC: s(PPVphBC, 2),
    PPVphCA: s(PPVphCA, 2),

    PhVphA: s(PhVphA, 2),
    PhVphB: s(PhVphB, 2),
    PhVphC: s(PhVphC, 2),

    VA: s(VA, 0),
    VAR: s(VAR, 0),

    VARphA: s(VARphA, 0),
    VARphB: s(VARphB, 0),
    VARphC: s(VARphC, 0),

    VAphA: s(VAphA, 0),
    VAphB: s(VAphB, 0),
    VAphC: s(VAphC, 0),

    W: s(W, 0),

    // energy counters (strings!)
    WHMonth: s(st.WHMonth, 3),
    WHPos: s(st.WHPos, 3),
    WHToday: s(st.WHToday, 3),

    WphA: s(WphA, 0),
    WphB: s(WphB, 0),
    WphC: s(WphC, 0),

    status: 1001,
  };
};

/**
 * Build registers for EMPro power meters (matches keys in your sample)
 * - No DC fields here
 * - Includes WHPos and WHNeg (both monotonic; one will barely change)
 */
const buildEmproRegisters = (name) => {
  const st = ensureState(name, 'empro');
  const now = Date.now();
  const dtSec = Math.max(1, (now - st.t) / 1000);
  st.t = now;

  const Hz = rand(49.8, 50.2, 3);

  const PhVphA = rand(228, 242, 1);
  const PhVphB = rand(228, 242, 1);
  const PhVphC = rand(228, 242, 1);
  const PPVphAB = PhVphA * Math.sqrt(3);
  const PPVphBC = PhVphB * Math.sqrt(3);
  const PPVphCA = PhVphC * Math.sqrt(3);

  // Simulate direction on Grid: sometimes export (negative W)
  // For Gen1 / Generator 2 we keep positive generation.
  const allowNegative = name === 'Grid';

  let WphA = rand(500, 20000);
  let WphB = rand(500, 20000);
  let WphC = rand(500, 20000);

  if (allowNegative && Math.random() < 0.25) {
    // 25% chance the site exports to grid
    WphA *= -1;
    WphB *= -1;
    WphC *= -1;
  }

  const W = WphA + WphB + WphC;

  const PFphA = rand(0.92, 1, 3);
  const PFphB = rand(0.92, 1, 3);
  const PFphC = rand(0.92, 1, 3);
  const PF = clamp(((PFphA + PFphB + PFphC) / 3) + st.drift * 0.01, 0.9, 1);

  const VAphA = Math.abs(WphA) / PFphA;
  const VAphB = Math.abs(WphB) / PFphB;
  const VAphC = Math.abs(WphC) / PFphC;
  const VA = VAphA + VAphB + VAphC;

  const VARphA = Math.sqrt(Math.max(0, VAphA * VAphA - WphA * WphA));
  const VARphB = Math.sqrt(Math.max(0, VAphB * VAphB - WphB * WphB));
  const VARphC = Math.sqrt(Math.max(0, VAphC * VAphC - WphC * WphC));
  const VAR = VARphA + VARphB + VARphC;

  // Integrate energy; split into WHPos/WHNeg depending on sign
  // integrateEnergy adds to WHPos for positive and WHNeg for negative
  integrateEnergy(st, W, dtSec);

  return {
    Hz: s(Hz, 3),
    PF: s(PF, 3),
    PFphA: s(PFphA, 3),
    PFphB: s(PFphB, 3),
    PFphC: s(PFphC, 3),

    PPVphAB: s(PPVphAB, 2),
    PPVphBC: s(PPVphBC, 2),
    PPVphCA: s(PPVphCA, 2),

    PhVphA: s(PhVphA, 2),
    PhVphB: s(PhVphB, 2),
    PhVphC: s(PhVphC, 2),

    VA: s(VA, 0),
    VAR: s(VAR, 0),

    VARphA: s(VARphA, 0),
    VARphB: s(VARphB, 0),
    VARphC: s(VARphC, 0),

    VAphA: s(VAphA, 0),
    VAphB: s(VAphB, 0),
    VAphC: s(VAphC, 0),

    W: s(W, 0),

    // EMPro energy keys (strings!)
    WHNeg: s(st.WHNeg, 3),
    WHPos: s(st.WHPos, 3),

    WphA: s(WphA, 0),
    WphB: s(WphB, 0),
    WphC: s(WphC, 0),

    status: 1000,
  };
};

/**
 * Build one device payload object with EXACT metadata key spelling
 * ("deviceMataData" intentionally kept to match your sample)
 */
const buildDevicePayload = (def) => {
  const register =
    def.device_type === 'solar_inverter'
      ? buildSolarRegisters(def.device_name)
      : buildEmproRegisters(def.device_name);

  return {
    deviceMataData: {
      device_name: def.device_name,
      device_type: def.device_type,
      interface: 'eth1',
      protocol: 'modbus_tcp',
      reference: def.reference,
    },
    register,
  };
};

(async () => {
  const connected = await natsClient.connect();
  if (!connected) {
    console.error('❌ Could not connect to NATS server. Aborting...');
    process.exit(1);
  }
  console.log('✅ Connected to NATS');

  const INTERVAL_MS = 5000;

  const publishOnce = async () => {
    const data = DEVICES.map(buildDevicePayload);
    const payload = {
      data,
      metadata: {
        batch_id: String(Date.now()), // string, as in your sample
        timestamp: Date.now(),        // ms epoch (number)
      },
    };

    const ok = await natsClient.publish('sensor.data', payload);
    if (!ok) {
      console.error('⚠️ Failed to publish data.');
    } else {
      const names = data.map(d => d.deviceMataData.device_name).join(', ');
      console.log(`→ Published batch for: ${names} @ ${new Date(payload.metadata.timestamp).toISOString()}`);
    }
  };

  // first publish immediately, then on interval
  await publishOnce();
  const timer = setInterval(publishOnce, INTERVAL_MS);

  process.on('SIGINT', async () => {
    clearInterval(timer);
    console.log('\n🛑 Stopping publisher...');
    await natsClient.disconnect();
    process.exit(0);
  });
})();
