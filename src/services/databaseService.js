const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config/settings');

class DatabaseService {
  constructor() {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }

    this.globalDbPath = process.env.GLOBAL_DB_PATH || config.GLOBAL_DB_PATH || '/home/gfe/Desktop/Project/Green_Project/data/sqlite/power_flow.db';
    this.db = null;
    this.isConnected = false;
    
    this.ensureDataDirectory();
    this.initializeDatabase();
    
    DatabaseService.instance = this;
  }

  static getInstance() {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
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
        this.isConnected = false;
      } else {
        console.log('✅ Connected to global database: ' + this.globalDbPath);
        this.isConnected = true;
        this.setupPragmas();
        this.initializeTables();
      }
    });
  }

  setupPragmas() {
    // Enable resource-optimized performance for Debian 11 with 1GB RAM
    this.db.run('PRAGMA foreign_keys = OFF'); // Disable for performance
    this.db.run('PRAGMA journal_mode = WAL'); // Use WAL mode for better concurrency
    this.db.run('PRAGMA synchronous = NORMAL'); // Good balance of performance/reliability
    this.db.run('PRAGMA cache_size = 2000'); // Reduced cache for 1GB RAM (2MB)
    this.db.run('PRAGMA temp_store = MEMORY'); // Use memory for temp tables
    this.db.run('PRAGMA mmap_size = 268435456'); // 256MB memory mapping
    this.db.run('PRAGMA page_size = 4096'); // Standard page size
    this.db.run('PRAGMA auto_vacuum = INCREMENTAL'); // Incremental vacuum for efficiency
    this.db.run('PRAGMA busy_timeout = 30000'); // Wait up to 30 seconds for locks
    this.db.run('PRAGMA locking_mode = NORMAL'); // Use normal locking mode
  }

  initializeTables() {
    // Create device_tables metadata table
    const deviceTablesQuery = `
      CREATE TABLE IF NOT EXISTS device_tables (
        device_name TEXT PRIMARY KEY,
        device_type TEXT NOT NULL,
        reference TEXT NOT NULL,
        table_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create power_flow_analysis table
    const powerFlowTableQuery = `
      CREATE TABLE IF NOT EXISTS power_flow_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solar REAL DEFAULT 0,
        grid REAL DEFAULT 0,
        genset REAL DEFAULT 0,
        load REAL DEFAULT 0,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        batch_id TEXT,
        received_devices TEXT
      )
    `;

    // Create index for timestamp for better query performance
    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_power_flow_timestamp 
      ON power_flow_analysis(timestamp);
    `;

    this.db.run(deviceTablesQuery, (err) => {
      if (err) {
        console.error('❌ Error creating device_tables:', err);
      } else {
        console.log('✅ Device tables metadata table ready');
      }
    });

    this.db.run(powerFlowTableQuery, (err) => {
      if (err) {
        console.error('❌ Error creating power_flow_analysis table:', err);
      } else {
        console.log('✅ Power flow analysis table ready');
      }
    });

    this.db.run(indexQuery, (err) => {
      if (err) {
        console.error('❌ Error creating power flow index:', err);
      } else {
        console.log('✅ Power flow index ready');
      }
    });
  }

  getConnection() {
    if (!this.isConnected) {
      console.warn('⚠️ Database not yet connected, waiting for connection...');
      // Return the db object anyway, as the connection will be established
      // The actual database operations will wait for the connection
      return this.db;
    }
    return this.db;
  }

  isDatabaseConnected() {
    return this.isConnected;
  }

  // Wrapper methods for common database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  serialize(callback) {
    this.db.serialize(callback);
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Error closing global database:', err);
          } else {
            console.log('✅ Global database connection closed');
          }
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DatabaseService;
