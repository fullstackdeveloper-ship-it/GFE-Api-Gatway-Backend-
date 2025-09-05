const express = require('express');
const router = express.Router();
const PowerFlowController = require('../../modules/controllers/powerFlow/powerFlowController');

// Initialize power flow controller
const powerFlowController = new PowerFlowController();

// Get power flow historical data (10 minutes to 2 hours by default)
router.get('/history', async (req, res) => {
  try {
    const hours = parseFloat(req.query.hours) || 1/6; // Default: 10 minutes
    const result = await powerFlowController.getPowerFlowHistory(hours);
    res.status(result.status).json(result);
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
