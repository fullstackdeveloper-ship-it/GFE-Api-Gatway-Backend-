const express = require('express');
const router = express.Router();
const PostgresService = require('../../services/postgresService');

const postgresService = new PostgresService();

// Get power flow historical data (last 24 hours by default)
router.get('/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const result = await postgresService.getPowerFlowHistory(hours);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Power flow history for last ${hours} hours`,
        data: result.data,
        count: result.count
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch power flow history',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in power flow history endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
