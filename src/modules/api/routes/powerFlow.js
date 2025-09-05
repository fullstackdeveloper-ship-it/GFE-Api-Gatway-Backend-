const express = require('express');
const router = express.Router();
const SQLiteService = require('../../services/database/sqliteService');

const sqliteService = new SQLiteService();

// Get power flow historical data (10 minutes to 2 hours by default)
router.get('/history', async (req, res) => {
  try {
    const hours = parseFloat(req.query.hours) || 1/6; // Default: 10 minutes
    const result = await sqliteService.getPowerFlowHistory(hours);
    
    if (result.success) {
      // Create human-readable time description
      let timeDescription;
      if (hours < 1) {
        const minutes = Math.round(hours * 60);
        timeDescription = `last ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else if (hours === 1) {
        timeDescription = 'last 1 hour';
      } else {
        timeDescription = `last ${hours} hours`;
      }
      
      res.json({
        success: true,
        message: `Power flow history for ${timeDescription}`,
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
