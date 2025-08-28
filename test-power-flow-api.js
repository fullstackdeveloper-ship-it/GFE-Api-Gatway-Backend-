const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/power-flow';

async function testPowerFlowAPI() {
  console.log('🧪 Testing Power Flow API Endpoints...\n');

  try {
    // Test 1: Get power flow history
    console.log('1️⃣ Testing /history endpoint...');
    const historyResponse = await axios.get(`${BASE_URL}/history?hours=24`);
    console.log('✅ History endpoint:', {
      success: historyResponse.data.success,
      count: historyResponse.data.count,
      message: historyResponse.data.message
    });

    // Test 2: Get latest power flow data
    console.log('\n2️⃣ Testing /latest endpoint...');
    const latestResponse = await axios.get(`${BASE_URL}/latest`);
    console.log('✅ Latest endpoint:', {
      success: latestResponse.data.success,
      hasData: !!latestResponse.data.data,
      message: latestResponse.data.message
    });

    // Test 3: Get power flow statistics
    console.log('\n3️⃣ Testing /stats endpoint...');
    const statsResponse = await axios.get(`${BASE_URL}/stats?hours=24`);
    console.log('✅ Stats endpoint:', {
      success: statsResponse.data.success,
      hasData: !!statsResponse.data.data,
      message: statsResponse.data.message
    });

    // Test 4: Get chart data
    console.log('\n4️⃣ Testing /chart endpoint...');
    const chartResponse = await axios.get(`${BASE_URL}/chart?hours=24`);
    console.log('✅ Chart endpoint:', {
      success: chartResponse.data.success,
      hasData: !!chartResponse.data.data,
      datasets: chartResponse.data.data?.datasets?.length || 0,
      labels: chartResponse.data.data?.labels?.length || 0,
      message: chartResponse.data.message
    });

    // Test 5: Get data by time range
    console.log('\n5️⃣ Testing /range endpoint...');
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const rangeResponse = await axios.get(`${BASE_URL}/range?startTime=${oneHourAgo}&endTime=${now}`);
    console.log('✅ Range endpoint:', {
      success: rangeResponse.data.success,
      count: rangeResponse.data.count,
      message: rangeResponse.data.message
    });

    console.log('\n🎉 All Power Flow API tests completed successfully!');
    console.log('\n📊 Sample data structure:');
    if (latestResponse.data.data) {
      console.log(JSON.stringify(latestResponse.data.data, null, 2));
    }

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your backend server is running:');
      console.log('   npm start');
    }
  }
}

// Run the test
testPowerFlowAPI();
