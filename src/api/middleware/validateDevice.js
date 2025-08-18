const Joi = require('joi');

// Common fields for all devices
const commonFields = {
  device_name: Joi.string().required().label('device_name'),
  reference: Joi.string().required().label('reference'),
  protocol: Joi.string().valid('modbus_tcp', 'modbus_rtu').required().label('protocol'),
  interface: Joi.string().required().label('interface'),
  device_id: Joi.number().required().label('device_id'),
  response_timeout: Joi.number().required().label('response_timeout')
};

// TCP-specific schema
const tcpSchema = Joi.object({
  ...commonFields,
  device_ip: Joi.string().ip().required().label('device_ip'),
  tcp_port: Joi.number().port().required().label('tcp_port'),
  keep_tcp_seasion_open: Joi.boolean().required().label('keep_tcp_seasion_open'),
  cocurrent_access: Joi.boolean().required().label('cocurrent_access'),
  byte_timeout: Joi.forbidden().label('byte_timeout') // explicitly disallowed
});

// RTU-specific schema
const rtuSchema = Joi.object({
  ...commonFields,
  byte_timeout: Joi.number().required().label('byte_timeout'),
  device_ip: Joi.forbidden().label('device_ip'),
  tcp_port: Joi.forbidden().label('tcp_port'),
  keep_tcp_seasion_open: Joi.forbidden().label('keep_tcp_seasion_open'),
  cocurrent_access: Joi.forbidden().label('cocurrent_access')
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

  // Additional check: no duplicate IP for TCP
  if (device.protocol === 'modbus_tcp') {
    const duplicate = existingDevices.find(d =>
      d.device_ip === device.device_ip &&
      d.protocol === 'modbus_tcp' &&
      d.device_name !== device.device_name
    );
    if (duplicate) {
      return {
        error: new Error(`IP address "${device.device_ip}" already exists for another TCP device.`)
      };
    }
  }

  return { value: device };
};

module.exports = { validateDeviceSchema };
