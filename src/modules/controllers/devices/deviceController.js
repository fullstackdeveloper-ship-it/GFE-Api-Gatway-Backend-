const DeviceTableService = require('../../services/devices/deviceTableService');
const { validateDeviceSchema } = require('../../../api/middleware/validateDevice');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

class DeviceController {
  constructor() {
    this.deviceTableService = new DeviceTableService();
    this.fsp = fs.promises;
    this.DEVICE_LIST_PATH = process.env.DEVICE_LIST_PATH;
    this.BLUEPRINTS_DIR = process.env.BLUEPRINTS_DIR;
    this.REFERENCE_CATALOG_PATH = process.env.REFERENCE_CATALOG_PATH || null;
  }

  async getReferencesFromCatalog() {
    if (!this.REFERENCE_CATALOG_PATH) {
      console.error('REFERENCE_CATALOG_PATH is not set');
      return [];
    }

    try {
      const raw = await this.fsp.readFile(this.REFERENCE_CATALOG_PATH, 'utf8');
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

  async getPowerMeterDevices() {
    return new Promise((resolve, reject) => {
      const query = `SELECT device_name FROM device_tables WHERE device_type = 'power_meter'`;
      
      this.deviceTableService.db.all(query, (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject({ error: 'Database error', details: err.message });
          return;
        }
        
        // Extract just the device names
        const deviceNames = rows ? rows.map(row => row.device_name) : [];
        
        resolve({
          success: true,
          data: deviceNames
        });
      });
    });
  }

  async getActivePowerData(deviceName, hours = 24) {
    return new Promise((resolve, reject) => {
      // 1) Look up the registered table for this device
      const tableQuery = `SELECT table_name FROM device_tables WHERE device_name = ?`;
      this.deviceTableService.db.get(tableQuery, [deviceName], (metaErr, deviceRow) => {
        if (metaErr) {
          console.error('❌ [active-power] Metadata DB error:', metaErr);
          reject({ error: 'Database error (metadata lookup)', details: metaErr.message });
          return;
        }

        if (!deviceRow) {
          const msg = `Device "${deviceName}" not found in device_tables.`;
          console.error('❌ [active-power]', msg);
          reject({ error: msg, status: 404 });
          return;
        }

        const tableName = deviceRow.table_name;
        console.log(`🔍 [active-power] Registered table for ${deviceName}: ${tableName}`);

        // 2) Verify the physical table exists
        const existsQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
        this.deviceTableService.db.get(existsQuery, [tableName], (existsErr, existsRow) => {
          if (existsErr) {
            console.error('❌ [active-power] Error checking table existence:', existsErr);
            reject({ error: 'Database error (existence check)', details: existsErr.message });
            return;
          }

          if (!existsRow) {
            const msg = `Table "${tableName}" for device "${deviceName}" is missing in the database.`;
            console.error('❌ [active-power]', msg);
            reject({ error: msg, status: 500 });
            return;
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

          this.deviceTableService.db.all(dataQuery, (dataErr, dataRows) => {
            if (dataErr) {
              console.error('❌ [active-power] Data fetch error:', dataErr);
              reject({ error: 'Failed to fetch data', details: dataErr.message });
              return;
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

            resolve({
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
    });
  }

  async getDebugDeviceTables() {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM device_tables`;
      
      this.deviceTableService.db.all(query, (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject({ error: 'Database error', details: err.message });
          return;
        }
        
        resolve({
          success: true,
          count: rows ? rows.length : 0,
          devices: rows || []
        });
      });
    });
  }

  async getAllDevices() {
    try {
      const data = yaml.load(fs.readFileSync(this.DEVICE_LIST_PATH, 'utf8'));
      const devices = data.devices_list || [];
      console.log(`Loaded ${devices.length} devices from ${this.DEVICE_LIST_PATH}`);

      // Load all blueprints once
      let referenceMap = {};
      try {
        const files = await fs.promises.readdir(this.BLUEPRINTS_DIR);
        const yamlFiles = files.filter(f => f.endsWith('.yaml'));

        for (const file of yamlFiles) {
          const blueprint = yaml.load(fs.readFileSync(path.join(this.BLUEPRINTS_DIR, file)));
          const ref = blueprint?.header?.reference;
          const type = blueprint?.header?.device_type;
          if (ref && type) {
            referenceMap[ref] = type;
          }
        }
      } catch (err) {
        console.error('Error reading blueprint files:', err.message);
      }

      const refsFromJson = await this.getReferencesFromCatalog();

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
      return {
        success: true,
        devices: grouped,
        references: refsFromJson,
        batch_id: Date.now().toString(),
        time_stamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
    } catch (err) {
      console.error('Device list error:', err.message);
      throw { error: 'Failed to load devices', details: err.message };
    }
  }

  async getDevicesByInterface(interfaceName) {
    try {
      const data = yaml.load(fs.readFileSync(this.DEVICE_LIST_PATH, 'utf8'));
      const filtered = data.devices_list.filter(d => d.interface === interfaceName);
      return { success: true, devices: filtered };
    } catch (err) {
      throw { error: 'Failed to retrieve devices for the specified interface.', details: err.message };
    }
  }

  async addDevice(deviceData) {
    try {
      const data = yaml.load(fs.readFileSync(this.DEVICE_LIST_PATH, 'utf8'));

      const { error } = validateDeviceSchema(deviceData, data.devices_list);
      if (error) throw { error: error.message, status: 400 };

      const exists = data.devices_list.find(d => d.device_name === deviceData.device_name);
      if (exists) throw { error: `Device "${deviceData.device_name}" already exists.`, status: 400 };

      // Create device table in database
      try {
        await this.deviceTableService.createDeviceTable(deviceData.device_name, deviceData.reference);
        console.log(`✅ Device table created for ${deviceData.device_name}`);
      } catch (tableError) {
        console.error(`❌ Failed to create device table for ${deviceData.device_name}:`, tableError.message);
        throw { 
          error: 'Device added but failed to create database table', 
          details: tableError.message,
          status: 500
        };
      }

      data.devices_list.push(deviceData);
      fs.writeFileSync(this.DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

      return {
        success: true,
        message: `Device "${deviceData.device_name}" added successfully with database table.`,
        device_name: deviceData.device_name
      };
    } catch (err) {
      if (err.status) throw err;
      throw { error: 'Failed to add new device.', details: err.message };
    }
  }

  async updateDevice(deviceName, updateData) {
    try {
      const data = yaml.load(fs.readFileSync(this.DEVICE_LIST_PATH, 'utf8'));
      const index = data.devices_list.findIndex(d => d.device_name === deviceName);
      if (index === -1) throw { error: `Device "${deviceName}" not found.`, status: 404 };

      const originalDevice = data.devices_list[index];

      // Support renaming device_name
      const newDeviceName = updateData.device_name || originalDevice.device_name;

      // Build updated device object
      let updatedDevice = { ...originalDevice, ...updateData, device_name: newDeviceName };

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
      if (error) throw { error: error.message, status: 400 };

      // Handle device table updates if device name changed
      if (originalDevice.device_name !== newDeviceName) {
        try {
          // Delete old table and create new one with new name
          await this.deviceTableService.deleteDeviceTable(originalDevice.device_name);
          await this.deviceTableService.createDeviceTable(newDeviceName, updatedDevice.reference);
          console.log(`✅ Device table updated for ${originalDevice.device_name} → ${newDeviceName}`);
        } catch (tableError) {
          console.error(`❌ Failed to update device table for ${originalDevice.device_name}:`, tableError.message);
          // Continue with device update even if table update fails
        }
      }

      // ✅ Apply update
      data.devices_list[index] = updatedDevice;
      fs.writeFileSync(this.DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

      return {
        success: true,
        message: `Device "${deviceName}" updated successfully.`,
        updated_device: updatedDevice.device_name
      };
    } catch (err) {
      if (err.status) throw err;
      throw { error: 'Failed to update device.', details: err.message };
    }
  }

  async deleteDevice(deviceName) {
    try {
      const data = yaml.load(fs.readFileSync(this.DEVICE_LIST_PATH, 'utf8'));
      const filtered = data.devices_list.filter(d => d.device_name !== deviceName);

      if (filtered.length === data.devices_list.length) {
        throw { error: `Device "${deviceName}" not found.`, status: 404 };
      }

      // Delete device table from database
      try {
        await this.deviceTableService.deleteDeviceTable(deviceName);
        console.log(`✅ Device table deleted for ${deviceName}`);
      } catch (tableError) {
        console.error(`❌ Failed to delete device table for ${deviceName}:`, tableError.message);
        // Continue with device deletion even if table deletion fails
      }

      data.devices_list = filtered;
      fs.writeFileSync(this.DEVICE_LIST_PATH, yaml.dump(data, { spacing: 2 }));

      return {
        success: true,
        message: `Device "${deviceName}" deleted successfully.`,
        device_name: deviceName
      };
    } catch (err) {
      if (err.status) throw err;
      throw { error: 'Failed to delete device.', details: err.message };
    }
  }

  async getBlueprintByReference(reference) {
    try {
      const blueprintFiles = await fs.promises.readdir(this.BLUEPRINTS_DIR);
      const yamlFiles = blueprintFiles.filter(file => file.endsWith('.yaml'));

      for (const file of yamlFiles) {
        const fullPath = path.join(this.BLUEPRINTS_DIR, file);
        const blueprint = yaml.load(fs.readFileSync(fullPath));

        if (blueprint?.header?.reference === reference) {
          return { success: true, data: blueprint };
        }
      }

      // If no matching reference was found
      throw { error: `Blueprint with reference "${reference}" not found.`, status: 404 };
    } catch (err) {
      if (err.status) throw err;
      console.error('Blueprint search error:', err.message);
      throw { error: 'Failed to search blueprints', details: err.message };
    }
  }

  async getDeviceTableInfo(deviceName) {
    try {
      const tableName = await this.deviceTableService.getDeviceTableName(deviceName);
      
      if (!tableName) {
        throw { error: `No table found for device: ${deviceName}`, status: 404 };
      }

      return {
        success: true,
        device_name: deviceName,
        table_name: tableName,
        message: `Table found for device ${deviceName}`
      };
    } catch (err) {
      if (err.status) throw err;
      throw { error: 'Failed to get device table info.', details: err.message };
    }
  }
}

module.exports = DeviceController;
