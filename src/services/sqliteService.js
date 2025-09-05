const DatabaseService = require('./databaseService');

class SQLiteService {
  constructor() {
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
    // No need to close database connection as it's managed by singleton
    // The singleton will handle connection lifecycle
    console.log('✅ SQLiteService closed (database connection managed by singleton)');
    return Promise.resolve();
  }
}

module.exports = SQLiteService;
