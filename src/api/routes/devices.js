const express = require('express');
const DeviceController = require('../../modules/controllers/devices/deviceController');

const router = express.Router();

// Initialize device controller
const deviceController = new DeviceController(); 



// --- GET power meter devices from database ---
router.get('/power-meters', async (req, res) => {
  try {
    const result = await deviceController.getPowerMeterDevices();
    res.status(200).json(result);
  } catch (err) {
    console.error('Power meter devices error:', err.message);
    res.status(500).json({ error: 'Failed to load power meter devices', details: err.message });
  }
});

router.get('/:deviceName/active-power', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const hours = parseInt(req.query.hours) || 24; // Default to 24 hours

    const result = await deviceController.getActivePowerData(deviceName, hours);
    res.status(200).json(result);
  } catch (err) {
    console.error(`❌ [active-power] Unexpected error for ${req.params.deviceName}:`, err.message);
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to fetch active power data', details: err.details || err.message });
  }
});

// --- DEBUG: Check device_tables content ---
router.get('/debug/device-tables', async (req, res) => {
  try {
    const result = await deviceController.getDebugDeviceTables();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Debug error', details: err.message });
  }
});

// --- GET all devices grouped by interface + blueprint references ---
router.get('/', async (req, res) => {
  try {
    const result = await deviceController.getAllDevices();
    res.status(200).json(result);
  } catch (err) {
    console.error('Device list error:', err.message);
    res.status(500).json({ error: err.error || 'Failed to load devices', details: err.details || err.message });
  }
});

// --- GET devices by interface ---
router.get('/:interface', async (req, res) => {
  try {
    const result = await deviceController.getDevicesByInterface(req.params.interface);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.error || 'Failed to retrieve devices for the specified interface.', details: err.details || err.message });
  }
});

// --- POST add device ---
router.post('/', async (req, res) => {
  try {
    const result = await deviceController.addDevice(req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to add new device.', details: err.details || err.message });
  }
});

// --- PUT update device ---
router.put('/:deviceName', async (req, res) => {
  try {
    const result = await deviceController.updateDevice(req.params.deviceName, req.body);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to update device.', details: err.details || err.message });
  }
});

// --- DELETE device ---
router.delete('/:deviceName', async (req, res) => {
  try {
    const result = await deviceController.deleteDevice(req.params.deviceName);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to delete device.', details: err.details || err.message });
  }
});

// --- GET blueprint by reference ---
router.get('/blueprint/:reference', async (req, res) => {
  try {
    const result = await deviceController.getBlueprintByReference(req.params.reference);
    res.status(200).json(result.data);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to search blueprints', details: err.details || err.message });
  }
});

// --- GET device table info ---
router.get('/:deviceName/table', async (req, res) => {
  try {
    const result = await deviceController.getDeviceTableInfo(req.params.deviceName);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.error || 'Failed to get device table info.', details: err.details || err.message });
  }
});

module.exports = router;
