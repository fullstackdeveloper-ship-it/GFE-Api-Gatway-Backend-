const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { readYaml, writeYaml } = require('../../utils/yamlManager');
const { validateDeviceSchema } = require('../middleware/validateDevice');

const router = express.Router();

const DEVICE_LIST_PATH = process.env.DEVICE_LIST_PATH;
const BLUEPRINTS_DIR = process.env.BLUEPRINTS_DIR;

// --- GET all devices grouped by interface + blueprint references ---
router.get('/', async (req, res) => {
  try {
    const data = await readYaml(DEVICE_LIST_PATH);

    const grouped = {};
    for (const dev of data.devices_list) {
      grouped[dev.interface] = grouped[dev.interface] || [];
      grouped[dev.interface].push(dev);
    }

    let references = [];
    try {
      const files = await fs.readdir(BLUEPRINTS_DIR);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      for (const file of yamlFiles) {
        const blueprint = await readYaml(path.join(BLUEPRINTS_DIR, file));
        if (blueprint?.header?.reference) {
          references.push(blueprint.header.reference);
        }
      }
    } catch (err) {
      console.error('Blueprint read error:', err.message);
    }

    res.json({ devices: grouped, references });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read devices list', details: err.message });
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
      delete updatedDevice.keep_tcp_seasion_open;
      delete updatedDevice.cocurrent_access;
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
    const file = path.join(BLUEPRINTS_DIR, `${req.params.reference}.yaml`);
    const data = await readYaml(file);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: `Blueprint "${req.params.reference}" not found.` });
  }
});

module.exports = router;
