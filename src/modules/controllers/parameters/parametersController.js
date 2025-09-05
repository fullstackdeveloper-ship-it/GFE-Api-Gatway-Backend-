const natsService = require('../../services/nats/natsClient');

class ParametersController {
  async setParameterValue(parameterData) {
    try {
      const { device_name, device_type, reference, register, value } = parameterData;

      // Validate required fields
      if (!device_name || !device_type || !reference || !register || value === undefined) {
        return {
          success: false,
          error: 'Missing required fields: device_name, device_type, reference, register, and value are required',
          status: 400
        };
      }

      // Validate value is a number
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        return {
          success: false,
          error: 'Value must be a valid number',
          status: 400
        };
      }

      // Prepare the payload for NATS
      const natsPayload = {
        device_name,
        device_type,
        reference,
        register,
        value: numericValue,
        timestamp: new Date().toISOString()
      };

      // Publish to NATS topic (read from environment variable)
      const topic = process.env.NATS_CONTROL_RESPONSE_TOPIC || 'control.response';
      
      try {
        await natsService.publish(topic, natsPayload);
        
        console.log(`✅ Parameter value set successfully for device: ${device_name}, register: ${register}, value: ${numericValue}`);
        console.log(`📡 Published to NATS topic: ${topic}`);
        
        return {
          success: true,
          message: `Parameter value set successfully for ${device_name}`,
          data: {
            device_name,
            register,
            value: numericValue,
            timestamp: natsPayload.timestamp
          },
          status: 200
        };
        
      } catch (natsError) {
        console.error('❌ NATS publish error:', natsError);
        return {
          success: false,
          error: 'Failed to publish parameter value to control system',
          details: natsError.message,
          status: 500
        };
      }

    } catch (error) {
      console.error('❌ Parameter set-value error:', error);
      return {
        success: false,
        error: 'Internal server error while setting parameter value',
        details: error.message,
        status: 500
      };
    }
  }

  async getParameterHistory(deviceName, register) {
    try {
      // This could be implemented to fetch parameter history from a database
      // For now, returning a placeholder response
      
      return {
        success: true,
        message: 'Parameter history endpoint - to be implemented',
        data: {
          device_name: deviceName,
          register,
          history: []
        },
        status: 200
      };
      
    } catch (error) {
      console.error('❌ Parameter history error:', error);
      return {
        success: false,
        error: 'Internal server error while fetching parameter history',
        details: error.message,
        status: 500
      };
    }
  }
}

module.exports = ParametersController;
