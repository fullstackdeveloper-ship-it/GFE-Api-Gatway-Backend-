const Joi = require('joi');

// Common fields for all devices
const commonFields = {
  device_name: Joi.string().required().label('device_name'),
  reference: Joi.string().required().label('reference'),
  protocol: Joi.string().valid('modbus_tcp', 'modbus_rtu').required().label('protocol'),
  interface: Joi.string().required().label('interface'),
  device_id: Joi.number().required().label('device_id'),
  response_timeout: Joi.number().required().label('response_timeout'),
  role: Joi.string().valid('grid_power_meter', 'generator_power_meter', 'other_power_meter').optional().label('role')
};

// TCP-specific schema
const tcpSchema = Joi.object({
  ...commonFields,
  device_ip: Joi.string().ip().required().label('device_ip'),
  tcp_port: Joi.number().port().required().label('tcp_port'),
  keep_tcp_session_open: Joi.boolean().required().label('keep_tcp_session_open'),
  concurrent_access: Joi.boolean().required().label('concurrent_access'),
  byte_timeout: Joi.forbidden().label('byte_timeout') // explicitly disallowed
});

// RTU-specific schema
const rtuSchema = Joi.object({
  ...commonFields,
  byte_timeout: Joi.number().required().label('byte_timeout'),
  device_ip: Joi.forbidden().label('device_ip'),
  tcp_port: Joi.forbidden().label('tcp_port'),
  keep_tcp_session_open: Joi.forbidden().label('keep_tcp_session_open'),
  concurrent_access: Joi.forbidden().label('concurrent_access')
});

// Schema validator
const validateDeviceSchema = (device, existingDevices = []) => {
  const baseValidation = (
    device.protocol === 'modbus_tcp' ? tcpSchema :
    device.protocol === 'modbus_rtu' ? rtuSchema :
    Joi.object().forbidden()
  );

  const { error } = baseValidation.validate(device);
  if (error) return { error };

  // Check if role is required for power meter devices
  if (device.reference && device.reference.toLowerCase().startsWith('power_meter-model')) {
    if (!device.role) {
      return {
        error: new Error('Role is required for Power Meter devices. Please select Grid Power Meter, Generator Power Meter, or Other Power Meter.')
      };
    }
  }

  // Check for duplicate device_id (should be unique across all devices)
  const duplicateDeviceId = existingDevices.find(d => 
    d.device_id === device.device_id && 
    d.device_name !== device.device_name
  );
  if (duplicateDeviceId) {
    return {
      error: new Error(`Device ID "${device.device_id}" already exists for device "${duplicateDeviceId.device_name}". Device ID must be unique.`)
    };
  }

  // Note: Multiple devices can have the same IP address
  // IP uniqueness check removed to allow multiple devices per IP

  return { value: device };
};

module.exports = { validateDeviceSchema };
