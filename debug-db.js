const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gfe_iot_db',
  user: 'gfe_user',
  password: 'gfe_pass'
});

async function debugDatabase() {
  try {
    console.log('🔍 Debugging PostgreSQL Database...\n');

    // Check table structure
    console.log('1️⃣ Table Structure:');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'power_flow_analysis'
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await pool.query(structureQuery);
    console.log('Columns:', structureResult.rows);

    // Check sample data
    console.log('\n2️⃣ Sample Data (first 3 rows):');
    const sampleQuery = `
      SELECT * FROM power_flow_analysis 
      ORDER BY created_at DESC 
      LIMIT 3;
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    console.log('Sample rows:', JSON.stringify(sampleResult.rows, null, 2));

    // Check data types
    console.log('\n3️⃣ Data Type Analysis:');
    sampleResult.rows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`);
      console.log(`  timestamp: ${typeof row.timestamp} = ${row.timestamp}`);
      console.log(`  created_at: ${typeof row.created_at} = ${row.created_at}`);
      console.log(`  solar: ${typeof row.solar} = ${row.solar}`);
    });

    // Test the actual query
    console.log('\n4️⃣ Testing History Query:');
    const historyQuery = `
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
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
      LIMIT 5;
    `;
    
    const historyResult = await pool.query(historyQuery);
    console.log('History query result:', JSON.stringify(historyResult.rows, null, 2));

  } catch (error) {
    console.error('❌ Database debug error:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();
