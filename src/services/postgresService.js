const { Pool } = require('pg');

class PostgresService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'gfe_iot_db',
      user: process.env.DB_USER || 'gfe_user',
      password: process.env.DB_PASSWORD || 'gfe_pass',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    this.pool.on('connect', () => {
      console.log('✅ Backend connected to PostgreSQL database');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Backend PostgreSQL connection error:', err);
    });
  }

  async getPowerFlowHistory(hours = 24) {
    try {
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
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY created_at ASC
      `;
      
      const result = await this.pool.query(query);
      
      // Format data for frontend chart
      const formattedData = result.rows.map(row => {
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

      return {
        success: true,
        data: formattedData,
        count: formattedData.length
      };
    } catch (error) {
      console.error('❌ Error fetching power flow history:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }



  async close() {
    await this.pool.end();
  }
}

module.exports = PostgresService;
