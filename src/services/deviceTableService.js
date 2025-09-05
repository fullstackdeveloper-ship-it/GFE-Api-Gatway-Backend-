const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const DatabaseService = require('./databaseService');

class DeviceTableService {
  constructor() {
    this.blueprintPath = process.env.BLUEPRINT_PATH || './gfe-iot/blueprints';
    this.blueprintCache = new Map();
    
    // Use singleton database service
    this.databaseService = DatabaseService.getInstance();
    this.db = this.databaseService.getConnection();
  }

  // Ensure database connection is ready
  ensureConnection() {
    if (!this.databaseService.isDatabaseConnected()) {
      throw new Error('Database not connected. Please wait for database initialization.');
    }
    return this.db;
  }

  async loadBlueprint(reference) {
    if (this.blueprintCache.has(reference)) {
      return this.blueprintCache.get(reference);
    }

    try {
      const files = fs.readdirSync(this.blueprintPath);
      const yamlFiles = files.filter(file => file.endsWith('.yaml'));
      
      // Loop through all YAML files to find the one with matching reference
      for (const file of yamlFiles) {
        try {
          const blueprintPath = path.join(this.blueprintPath, file);
          const fileContent = fs.readFileSync(blueprintPath, 'utf8');
          const blueprint = yaml.load(fileContent);
          
          // Check if this blueprint has the matching reference
          if (blueprint && blueprint.header && blueprint.header.reference === reference) {
            this.blueprintCache.set(reference, blueprint);
            console.log(`✅ Loaded blueprint for reference: ${reference} from file: ${file}`);
            return blueprint;
          }
        } catch (fileError) {
          console.warn(`⚠️ Warning: Could not read blueprint file ${file}:`, fileError.message);
          continue; // Skip to next file if there's an error reading this one
        }
      }
      
      throw new Error(`Blueprint file not found for reference: ${reference}`);
    } catch (error) {
      console.error(`❌ Error loading blueprint for reference ${reference}:`, error.message);
      throw error;
    }
  }

  async createDeviceTable(deviceName, reference) {
    try {
      const blueprint = await this.loadBlueprint(reference);
      const deviceType = blueprint.header.device_type;
      
      if (!blueprint.registers || blueprint.registers.length === 0) {
        throw new Error(`No parameters found for reference: ${reference}`);
      }

      const tableName = `device_${deviceName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      
      const columns = blueprint.registers.map(register => `${register.short_name} REAL`).join(', ');
      const query = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          timestamp INTEGER PRIMARY KEY,
          ${columns},
          sample_count INTEGER
        )
      `;

      return new Promise((resolve, reject) => {
        this.db.run(query, (err) => {
          if (err) {
            console.error(`❌ Error creating table ${tableName}:`, err);
            reject(err);
          } else {
            console.log(`✅ Created table ${tableName} for device ${deviceName}`);
            
            this.registerDeviceTable(deviceName, deviceType, reference, tableName);
            resolve(tableName);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error creating device table for ${deviceName}:`, error.message);
      throw error;
    }
  }

  registerDeviceTable(deviceName, deviceType, reference, tableName) {
    const query = `
      INSERT OR REPLACE INTO device_tables (device_name, device_type, reference, table_name)
      VALUES (?, ?, ?, ?)
    `;
    
    this.db.run(query, [deviceName, deviceType, reference, tableName], (err) => {
      if (err) {
        console.error(`❌ Error registering device table for ${deviceName}:`, err);
      }
    });
  }

  async deleteDeviceTable(deviceName) {
    try {
      const tableName = await this.getDeviceTableName(deviceName);
      if (!tableName) {
        console.log(`ℹ️ No table found for device ${deviceName}`);
        return;
      }

      const dropQuery = `DROP TABLE IF EXISTS ${tableName}`;
      const deleteQuery = `DELETE FROM device_tables WHERE device_name = ?`;

      return new Promise((resolve, reject) => {
        this.db.serialize(() => {
          this.db.run(dropQuery, (err) => {
            if (err) {
              console.error(`❌ Error dropping table ${tableName}:`, err);
              reject(err);
              return;
            }
            
            this.db.run(deleteQuery, [deviceName], (err) => {
              if (err) {
                console.error(`❌ Error removing device registration for ${deviceName}:`, err);
                reject(err);
              } else {
                console.log(`✅ Deleted table ${tableName} for device ${deviceName}`);
                resolve();
              }
            });
          });
        });
      });
    } catch (error) {
      console.error(`❌ Error deleting device table for ${deviceName}:`, error.message);
      throw error;
    }
  }

  getDeviceTableName(deviceName) {
    return new Promise((resolve, reject) => {
      const query = `SELECT table_name FROM device_tables WHERE device_name = ?`;
      this.db.get(query, [deviceName], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.table_name : null);
        }
      });
    });
  }

  async tableExists(deviceName) {
    try {
      const tableName = await this.getDeviceTableName(deviceName);
      if (!tableName) {
        return false;
      }

      // Check if the actual table exists in the database
      const checkQuery = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
      return new Promise((resolve, reject) => {
        this.db.get(checkQuery, [tableName], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        });
      });
    } catch (error) {
      console.error(`Error checking if table exists for device ${deviceName}:`, error.message);
      return false;
    }
  }

  close() {
    // No need to close database connection as it's managed by singleton
    // The singleton will handle connection lifecycle
    console.log('✅ DeviceTableService closed (database connection managed by singleton)');
  }
}

module.exports = DeviceTableService;
