/**
 * Controllers Index
 * Central export for all controllers
 */

module.exports = {
  config: require('./config/configController'),
  network: require('./network/networkController'),
  serial: require('./serial/serialController'),
  system: require('./system/systemController')
};
