const SQLiteService = require('../../services/database/sqliteService');

class PowerFlowController {
  constructor() {
    this.sqliteService = new SQLiteService();
  }

  async getPowerFlowHistory(hours = 1/6) {
    try {
      const result = await this.sqliteService.getPowerFlowHistory(hours);
      
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
        
        return {
          success: true,
          message: `Power flow history for ${timeDescription}`,
          data: result.data,
          count: result.count,
          status: 200
        };
      } else {
        return {
          success: false,
          message: 'Failed to fetch power flow history',
          error: result.error,
          status: 500
        };
      }
    } catch (error) {
      console.error('❌ Error in power flow history endpoint:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: error.message,
        status: 500
      };
    }
  }
}

module.exports = PowerFlowController;
