const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteService {
  constructor() {
    const dbPath = process.env.DB_PATH || '../../data/sqlite/power_flow.db';
    
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Backend SQLite connection error:', err);
      } else {
        console.log('✅ Backend connected to SQLite database');
      }
    });
    
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

  async getPowerFlowHistory(hours = 24) {
    return new Promise((resolve, reject) => {
      // Convert hours to minutes for more precise time calculations
      const minutes = Math.round(hours * 60);
      
      const query = `
        SELECT 
          id,
          solar,
          grid,
          genset,
          load,
          timestamp,
          batch_id,
          received_devices,
          created_at
        FROM power_flow_analysis 
        WHERE created_at >= datetime('now', '-${minutes} minutes')
        ORDER BY created_at ASC
      `;
      
      // Add retry logic for database locks
      const attemptQuery = (retryCount = 0) => {
        this.db.all(query, (err, rows) => {
          if (err) {
            if (err.code === 'SQLITE_BUSY' && retryCount < 3) {
              console.log(`⏳ Database busy, retrying in 1s... (attempt ${retryCount + 1}/3)`);
              setTimeout(() => attemptQuery(retryCount + 1), 1000);
              return;
            }
            console.error('❌ Error fetching power flow history:', err);
            resolve({
              success: false,
              error: err.message,
              data: []
            });
            return;
          }
        
        // Format data for frontend chart
        const formattedData = rows.map(row => {
          try {
            return {
              solar: parseFloat(row.solar || 0),
              grid: parseFloat(row.grid || 0),
              genset: parseFloat(row.genset || 0),
              load: parseFloat(row.load || 0),
              batchId: row.batch_id,
              time: new Date(parseInt(row.timestamp)).toISOString()
            };
          } catch (parseError) {
            console.error('❌ Error parsing row:', row, parseError);
            return null;
          }
        }).filter(item => item !== null);

        resolve({
          success: true,
          data: formattedData,
          count: formattedData.length
        });
      });
    };
    
    attemptQuery();
  });
}



  async close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Error closing SQLite database:', err);
        } else {
          console.log('✅ SQLite database connection closed');
        }
        resolve();
      });
    });
  }
}

module.exports = SQLiteService;
