const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { readYaml, writeYaml } = require('../../utils/yamlManager');
const { validateDeviceSchema } = require('../middleware/validateDevice');

const router = express.Router();

const DEVICE_LIST_PATH = process.env.DEVICE_LIST_PATH;
const BLUEPRINTS_DIR = process.env.BLUEPRINTS_DIR;
const REFERENCE_CATALOG_PATH = process.env.REFERENCE_CATALOG_PATH || null;


async function getReferencesFromCatalog() {
  if (!REFERENCE_CATALOG_PATH) {
    console.error('REFERENCE_CATALOG_PATH is not set');
    return [];
  }

  try {
    const raw = await fs.readFile(REFERENCE_CATALOG_PATH, 'utf8');
    const json = JSON.parse(raw);

    // Normalize json.data → always an array of plain objects
    let data = json?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {/* ignore parse error */}
    }
    if (data && !Array.isArray(data) && typeof data === 'object') {
      data = [data];
    }
    if (!Array.isArray(data)) return [];

    // Collect all device objects from each entry
    const devices = data.flatMap(entry =>
      entry && typeof entry === 'object' ? Object.values(entry) : []
    ).filter(d => d && typeof d === 'object');

    // Group by vendor → unique references per vendor
    const map = new Map();
    for (const d of devices) {
      const vendor = d.device_vendor || 'Unknown';
      const ref = d.reference;
      if (!ref) continue;
      if (!map.has(vendor)) map.set(vendor, new Set());
      map.get(vendor).add(ref);
    }

    // Build the response: [{ vendor, references: [{reference}, ...] }]
    const result = Array.from(map.entries()).map(([vendor, refSet]) => ({
      vendor,
      references: Array.from(refSet).map(reference => ({ reference }))
    }));

    // Optional: sort vendors and references for stable output
    result.sort((a, b) => a.vendor.localeCompare(b.vendor));
    for (const g of result) g.references.sort((a, b) => a.reference.localeCompare(b.reference));

    return result;
  } catch (e) {
    console.error('Error reading reference catalog:', e.message);
    return [];
  }
}



// --- GET all devices grouped by interface + blueprint references ---
router.get('/', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);
    const devices = data.devices_list || [];

    // Load all blueprints once
    let referenceMap = {};
    try {
      const files = await fs.readdir(BLUEPRINTS_DIR);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      for (const file of yamlFiles) {
        const blueprint = await readYaml(path.join(BLUEPRINTS_DIR, file));
        const ref = blueprint?.header?.reference;
        const type = blueprint?.header?.device_type;
        if (ref && type) {
          referenceMap[ref] = type;
        }
      }
    } catch (err) {
      console.error('Error reading blueprint files:', err.message);
    }

    const refsFromJson = await getReferencesFromCatalog();

    // Group and enrich devices
    const grouped = {};
    for (const dev of devices) {
      const iface = dev.interface || 'unknown';
      const ref = dev.reference;
      const type = referenceMap[ref] || null;

      const enrichedDevice = {
        ...dev,
        device_type: type
      };

      grouped[iface] = grouped[iface] || [];
      grouped[iface].push(enrichedDevice);
    }

    res.json({
      devices: grouped,
      references: refsFromJson
    });
  } catch (err) {
    console.error('Device list error:', err.message);
    res.status(500).json({ error: 'Failed to load devices', details: err.message });
  }
});

// --- GET devices by interface ---
router.get('/:interface', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);
    const filtered = data.devices_list.filter(d => d.interface === req.params.interface);
    res.json({ devices: filtered });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve devices for the specified interface.', details: err.message });
  }
});

// --- POST add device ---
router.post('/', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);

    const { error } = validateDeviceSchema(req.body, data.devices_list);
    if (error) return res.status(400).json({ error: error.message });

    const exists = data.devices_list.find(d => d.device_name === req.body.device_name);
    if (exists) return res.status(400).json({ error: `Device "${req.body.device_name}" already exists.` });

    data.devices_list.push(req.body);
    await writeYaml(DEVICE_LIST_PATH, data, { spacing: 2 });

    res.status(201).json({
      message: `Device "${req.body.device_name}" added successfully.`,
      device_name: req.body.device_name,
      success: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add new device.', details: err.message });
  }
});

// --- PUT update device ---
router.put('/:deviceName', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);
    const index = data.devices_list.findIndex(d => d.device_name === req.params.deviceName);
    if (index === -1) return res.status(404).json({ error: `Device "${req.params.deviceName}" not found.` });

    const originalDevice = data.devices_list[index];

    // Support renaming device_name
    const newDeviceName = req.body.device_name || originalDevice.device_name;

    // Build updated device object
    let updatedDevice = { ...originalDevice, ...req.body, device_name: newDeviceName };

    // 🔍 Clean protocol-specific fields BEFORE validation
    if (updatedDevice.protocol === 'modbus_rtu') {
      delete updatedDevice.device_ip;
      delete updatedDevice.tcp_port;
      delete updatedDevice.keep_tcp_session_open;
      delete updatedDevice.concurrent_access;
    } else if (updatedDevice.protocol === 'modbus_tcp') {
      delete updatedDevice.byte_timeout;
    }

    // 🔐 Validate
    const { error } = validateDeviceSchema(updatedDevice, data.devices_list);
    if (error) return res.status(400).json({ error: error.message });

    // ✅ Apply update
    data.devices_list[index] = updatedDevice;
    await writeYaml(DEVICE_LIST_PATH, data, { spacing: 2 });

    res.json({
      message: `Device "${req.params.deviceName}" updated successfully.`,
      updated_device: updatedDevice.device_name,
      success: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device.', details: err.message });
  }
});


// --- DELETE device ---
router.delete('/:deviceName', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);
    const filtered = data.devices_list.filter(d => d.device_name !== req.params.deviceName);

    if (filtered.length === data.devices_list.length) {
      return res.status(404).json({ error: `Device "${req.params.deviceName}" not found.` });
    }

    data.devices_list = filtered;
    await writeYaml(DEVICE_LIST_PATH, data, { spacing: 2 });

    res.json({
      message: `Device "${req.params.deviceName}" deleted successfully.`,
      device_name: req.params.deviceName,
      success: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete device.', details: err.message });
  }
});

// --- GET blueprint by reference ---
router.get('/blueprint/:reference', async (req, res) => {
  try {
    const blueprintFiles = await fs.readdir(BLUEPRINTS_DIR);
    const yamlFiles = blueprintFiles.filter(file => file.endsWith('.yaml'));

    for (const file of yamlFiles) {
      const fullPath = path.join(BLUEPRINTS_DIR, file);
      const blueprint = await readYaml(fullPath);

      if (blueprint?.header?.reference === req.params.reference) {
        return res.json(blueprint);
      }
    }

    // If no matching reference was found
    return res.status(404).json({ error: `Blueprint with reference "${req.params.reference}" not found.` });
  } catch (err) {
    console.error('Blueprint search error:', err.message);
    res.status(500).json({ error: 'Failed to search blueprints', details: err.message });
  }
});

module.exports = router;
