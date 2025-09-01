const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const sqlite3 = require('sqlite3').verbose();

class DeviceTableService {
  constructor() {
    this.blueprintPath = process.env.BLUEPRINT_PATH || './gfe-iot/blueprints';
    this.globalDbPath = process.env.GLOBAL_DB_PATH || '/home/gfe/Desktop/Project/Green_Project/data/sqlite/power_flow.db';
    this.blueprintCache = new Map();
    
    this.ensureDataDirectory();
    this.initializeDatabase();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.globalDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  initializeDatabase() {
    this.db = new sqlite3.Database(this.globalDbPath, (err) => {
      if (err) {
        console.error('❌ Global database connection error:', err);
      } else {
        console.log('✅ Connected to global database: ' + this.globalDbPath);
        this.setupPragmas();
        this.createDeviceTablesTable();
      }
    });
  }

  setupPragmas() {
    this.db.run('PRAGMA foreign_keys = OFF');
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA cache_size = 2000');
    this.db.run('PRAGMA temp_store = MEMORY');
    this.db.run('PRAGMA mmap_size = 268435456');
    this.db.run('PRAGMA page_size = 4096');
    this.db.run('PRAGMA auto_vacuum = INCREMENTAL');
    this.db.run('PRAGMA busy_timeout = 30000');
    this.db.run('PRAGMA locking_mode = NORMAL');
  }

  createDeviceTablesTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS device_tables (
        device_name TEXT PRIMARY KEY,
        device_type TEXT NOT NULL,
        reference TEXT NOT NULL,
        table_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.db.run(query, (err) => {
      if (err) {
        console.error('❌ Error creating device_tables:', err);
      } else {
        console.log('✅ Device tables metadata table ready');
      }
    });
  }

  async loadBlueprint(reference) {
    if (this.blueprintCache.has(reference)) {
      return this.blueprintCache.get(reference);
    }

    try {
      const files = fs.readdirSync(this.blueprintPath);
      const blueprintFile = files.find(file => file.includes(reference.replace('-', '_')));
      
      if (!blueprintFile) {
        throw new Error(`Blueprint file not found for reference: ${reference}`);
      }

      const blueprintPath = path.join(this.blueprintPath, blueprintFile);
      const fileContent = fs.readFileSync(blueprintPath, 'utf8');
      const blueprint = yaml.load(fileContent);
      
      this.blueprintCache.set(reference, blueprint);
      console.log(`✅ Loaded blueprint for reference: ${reference}`);
      
      return blueprint;
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

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Error closing global database:', err);
        } else {
          console.log('✅ Global database connection closed');
        }
      });
    }
  }
}

module.exports = DeviceTableService;
