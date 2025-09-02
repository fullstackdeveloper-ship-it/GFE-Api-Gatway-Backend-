const express = require('express');
const DeviceTableService = require('../../services/deviceTableService');
const { validateDeviceSchema } = require('../middleware/validateDevice');
const yaml = require('js-yaml');
const fs = require('fs'); 
const path = require('path');

const router = express.Router();

const DEVICE_LIST_PATH = process.env.DEVICE_LIST_PATH;
const BLUEPRINTS_DIR = process.env.BLUEPRINTS_DIR;
const REFERENCE_CATALOG_PATH = process.env.REFERENCE_CATALOG_PATH || null;

// Initialize device table service
const deviceTableService = new DeviceTableService();
const fsp = fs.promises; 


async function getReferencesFromCatalog() {
  if (!REFERENCE_CATALOG_PATH) {
    console.error('REFERENCE_CATALOG_PATH is not set');
    return [];
  }

  try {
  
    const raw = await fsp.readFile(REFERENCE_CATALOG_PATH, 'utf8');
    const json = JSON.parse(raw);

    console.log('Loaded reference catalog:', json);

    // Normalize json.data → always an array of plain objects
    let data = json?.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {/* ignore parse error */}
    }
    if (data && !Array.isArray(data) && typeof data === 'object') {
      data = [data];
    }
    if (!Array.isArray(data)) return [];

    // Transform data to have device types as keys
    const transformedData = {};
    
    // Process each entry in the data array
    for (const entry of data) {
      if (entry && typeof entry === 'object') {
        // Each entry should have device types as keys
        for (const [deviceType, deviceInfo] of Object.entries(entry)) {
          if (deviceInfo && typeof deviceInfo === 'object' && deviceInfo.reference) {
            transformedData[deviceType] = {
              device_vendor: deviceInfo.device_vendor || 'Unknown',
              reference: deviceInfo.reference,
              protocol: deviceInfo.protocol || 'modbus_tcp'
            };
          }
        }
      }
    }

    return transformedData;
  } catch (e) {
    console.error('Error reading reference catalog:', e.message);
    return {};
  }
}

// --- GET power meter devices from database ---
router.get('/power-meters', async (req, res) => {
  try {
    // Query device_tables for power meter devices - only return device names
    const query = `SELECT device_name FROM device_tables WHERE device_type = 'power_meter'`;
    
    deviceTableService.db.all(query, (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
        return;
      }
      
      // Extract just the device names
      const deviceNames = rows ? rows.map(row => row.device_name) : [];
      
      res.json({
        success: true,
        data: deviceNames
      });
    });
    
  } catch (err) {
    console.error('Power meter devices error:', err.message);
    res.status(500).json({ error: 'Failed to load power meter devices', details: err.message });
  }
});

router.get('/:deviceName/active-power', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const hours = parseInt(req.query.hours) || 24; // Default to 24 hours

    // 1) Look up the registered table for this device
    const tableQuery = `SELECT table_name FROM device_tables WHERE device_name = ?`;
    deviceTableService.db.get(tableQuery, [deviceName], (metaErr, deviceRow) => {
      if (metaErr) {
        console.error('❌ [active-power] Metadata DB error:', metaErr);
        return res.status(500).json({ error: 'Database error (metadata lookup)', details: metaErr.message });
      }

      if (!deviceRow) {
        const msg = `Device "${deviceName}" not found in device_tables.`;
        console.error('❌ [active-power]', msg);
        return res.status(404).json({ error: msg });
      }

      const tableName = deviceRow.table_name;
      console.log(`🔍 [active-power] Registered table for ${deviceName}: ${tableName}`);

      // 2) Verify the physical table exists
      const existsQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
      deviceTableService.db.get(existsQuery, [tableName], (existsErr, existsRow) => {
        if (existsErr) {
          console.error('❌ [active-power] Error checking table existence:', existsErr);
          return res.status(500).json({ error: 'Database error (existence check)', details: existsErr.message });
        }

        if (!existsRow) {
          const msg = `Table "${tableName}" for device "${deviceName}" is missing in the database.`;
          console.error('❌ [active-power]', msg);
          return res.status(500).json({ error: msg });
        }

        // 3) Fetch data with time filter (last N hours)
        const quotedTable = `"${String(tableName).replace(/"/g, '""')}"`;
        
        // Calculate the cutoff timestamp (N hours ago in milliseconds)
        const now = Date.now();
        const cutoffTime = now - (hours * 60 * 60 * 1000); // Convert hours to milliseconds
        
        const dataQuery = `
          SELECT
            timestamp,
            W, WphA, WphB, WphC
          FROM ${quotedTable}
          WHERE timestamp >= ${cutoffTime}
          ORDER BY timestamp ASC
        `;

        deviceTableService.db.all(dataQuery, (dataErr, dataRows) => {
          if (dataErr) {
            console.error('❌ [active-power] Data fetch error:', dataErr);
            return res.status(500).json({ error: 'Failed to fetch data', details: dataErr.message });
          }

          console.log(`✅ [active-power] Fetched ${dataRows ? dataRows.length : 0} rows from ${tableName} (last ${hours} hours, cutoff: ${new Date(cutoffTime).toISOString()})`);

          // Format the data with proper timestamp handling
          const formattedData = (dataRows || []).map(row => {
            // Convert Unix timestamp (milliseconds) to simple time format (HH:MM)
            let formattedTime = row.timestamp;
            
            if (typeof row.timestamp === 'number') {
              const date = new Date(row.timestamp);
              formattedTime = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
            } else if (typeof row.timestamp === 'string') {
              // If it's a string, try to parse it as a number first
              const timestampNum = parseInt(row.timestamp);
              if (!isNaN(timestampNum)) {
                const date = new Date(timestampNum);
                formattedTime = date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                });
              } else {
                // Keep original if it's not a number
                formattedTime = row.timestamp;
              }
            }

            return {
              time: formattedTime,
              timestamp: row.timestamp, // Keep original for debugging
              W: parseFloat(row.W) || 0,
              WphA: parseFloat(row.WphA) || 0,
              WphB: parseFloat(row.WphB) || 0,
              WphC: parseFloat(row.WphC) || 0
            };
          });

          return res.json({
            success: true,
            device_name: deviceName,
            table_name: tableName,
            time_filter: `Last ${hours} hours`,
            data_count: formattedData.length,
            cutoff_timestamp: cutoffTime,
            cutoff_time: new Date(cutoffTime).toISOString(),
            data: formattedData
          });
        });
      });
    });

  } catch (err) {
    console.error(`❌ [active-power] Unexpected error for ${req.params.deviceName}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch active power data', details: err.message });
  }
});

// --- DEBUG: Check device_tables content ---
router.get('/debug/device-tables', (req, res) => {
  try {
    const query = `SELECT * FROM device_tables`;
    
    deviceTableService.db.all(query, (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err);
        res.status(500).json({ error: 'Database error', details: err.message });
        return;
      }
      
      res.json({
        success: true,
        count: rows ? rows.length : 0,
        devices: rows || []
      });
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Debug error', details: err.message });
  }
});

// --- GET all devices grouped by interface + blueprint references ---
router.get('/', async (req, res) => {
  try {
    const data = yaml.load(fs.readFileSync(DEVICE_LIST_PATH, 'utf8'));
    const devices = data.devices_list || [];
    console.log(`Loaded ${devices.length} devices from ${DEVICE_LIST_PATH}`);

    // Load all blueprints once
    let referenceMap = {};
    try {
      const files = await fs.promises.readdir(BLUEPRINTS_DIR);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));

      for (const file of yamlFiles) {
        const blueprint = yaml.load(fs.readFileSync(path.join(BLUEPRINTS_DIR, file)));
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

    // Group and enrich devices (keep original device details)
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

    // Return both device details and transformed reference catalog
    res.json({
      devices: grouped,
      references: refsFromJson,
      batch_id: Date.now().toString(),
      time_stamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  } catch (err) {
    console.error('Device list error:', err.message);
    res.status(500).json({ error: 'Failed to load devices', details: err.message });
  }
});

// --- GET devices by interface ---
router.get('/:interface', async (req, res) => {
  try {
    const data = yaml.load(fs.readFileSync(DEVICE_LIST_PATH, 'utf8'));
    const filtered = data.devices_list.filter(d => d.interface === req.params.interface);
    res.json({ devices: filtered });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve devices for the specified interface.', details: err.message });
  }
});

// --- POST add device ---
router.post('/', async (req, res) => {
  try {
    const data = yaml.load(fs.readFileSync(DEVICE_LIST_PATH, 'utf8'));

    const { error } = validateDeviceSchema(req.body, data.devices_list);
    if (error) return res.status(400).json({ error: error.message });

    const exists = data.devices_list.find(d => d.device_name === req.body.device_name);
    if (exists) return res.status(400).json({ error: `Device "${req.body.device_name}" already exists.` });

    // Create device table in database
    try {
      await deviceTableService.createDeviceTable(req.body.device_name, req.body.reference);
      console.log(`✅ Device table created for ${req.body.device_name}`);
    } catch (tableError) {
      console.error(`❌ Failed to create device table for ${req.body.device_name}:`, tableError.message);
      return res.status(500).json({ 
        error: 'Device added but failed to create database table', 
        details: tableError.message 
      });
    }

    data.devices_list.push(req.body);
    fs.writeFileSync(DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

    res.status(201).json({
      message: `Device "${req.body.device_name}" added successfully with database table.`,
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
    const data = yaml.load(fs.readFileSync(DEVICE_LIST_PATH, 'utf8'));
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
    
    // Clean role field if not a power meter device
    if (!updatedDevice.reference || !updatedDevice.reference.toLowerCase().startsWith('power_meter-model')) {
      delete updatedDevice.role;
    }

    // 🔐 Validate - pass original device name to exclude it from duplicate checks
    const { error } = validateDeviceSchema(updatedDevice, data.devices_list, originalDevice.device_name);
    if (error) return res.status(400).json({ error: error.message });

    // Handle device table updates if device name changed
    if (originalDevice.device_name !== newDeviceName) {
      try {
        // Delete old table and create new one with new name
        await deviceTableService.deleteDeviceTable(originalDevice.device_name);
        await deviceTableService.createDeviceTable(newDeviceName, updatedDevice.reference);
        console.log(`✅ Device table updated for ${originalDevice.device_name} → ${newDeviceName}`);
      } catch (tableError) {
        console.error(`❌ Failed to update device table for ${originalDevice.device_name}:`, tableError.message);
        // Continue with device update even if table update fails
      }
    }

    // ✅ Apply update
    data.devices_list[index] = updatedDevice;
    fs.writeFileSync(DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

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
    const data = yaml.load(fs.readFileSync(DEVICE_LIST_PATH, 'utf8'));
    const filtered = data.devices_list.filter(d => d.device_name !== req.params.deviceName);

    if (filtered.length === data.devices_list.length) {
      return res.status(404).json({ error: `Device "${req.params.deviceName}" not found.` });
    }

    // Delete device table from database
    try {
      await deviceTableService.deleteDeviceTable(req.params.deviceName);
      console.log(`✅ Device table deleted for ${req.params.deviceName}`);
    } catch (tableError) {
      console.error(`❌ Failed to delete device table for ${req.params.deviceName}:`, tableError.message);
      // Continue with device deletion even if table deletion fails
    }

    data.devices_list = filtered;
    fs.writeFileSync(DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

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
    const blueprintFiles = await fs.promises.readdir(BLUEPRINTS_DIR);
    const yamlFiles = blueprintFiles.filter(file => file.endsWith('.yaml'));

    for (const file of yamlFiles) {
      const fullPath = path.join(BLUEPRINTS_DIR, file);
      const blueprint = yaml.load(fs.readFileSync(fullPath));

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

// --- GET device table info ---
router.get('/:deviceName/table', async (req, res) => {
  try {
    const deviceName = req.params.deviceName;
    const tableName = await deviceTableService.getDeviceTableName(deviceName);
    
    if (!tableName) {
      return res.status(404).json({ error: `No table found for device: ${deviceName}` });
    }

    res.json({
      success: true,
      device_name: deviceName,
      table_name: tableName,
      message: `Table found for device ${deviceName}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device table info.', details: err.message });
  }
});

module.exports = router;
