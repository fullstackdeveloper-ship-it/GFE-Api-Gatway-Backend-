# Connectivity Testing Service

This service provides comprehensive device connectivity testing capabilities for both TCP/IP and Serial devices using ping and port testing.

## 🚀 Features

### TCP/IP Connectivity Testing
- **Ping Testing**: Tests basic IP reachability with detailed statistics
- **Port Testing**: Tests if specific ports are open and accessible
- **Comprehensive Results**: Provides ping statistics, packet loss, and RTT information

### Serial Connectivity Testing
- **Interface Validation**: Checks if serial interfaces exist and are accessible
- **Permission Checking**: Verifies read/write access to serial devices
- **Device Communication**: Basic serial communication testing

## 📡 API Endpoints

### POST `/api/connectivity/test-connectivity`

Test device connectivity with detailed results.

#### Request Body
```json
{
  "type": "tcp|serial",
  "ip": "192.168.1.100",        // Required for TCP
  "port": 502,                  // Optional for TCP
  "interface": "serial_1",      // Required for Serial
  "device_id": 1,               // Required for Serial
  "timeout": 5000               // Optional, default: 5000ms
}
```

#### Response Examples

**Successful TCP Test:**
```json
{
  "success": true,
  "type": "tcp",
  "ip": "8.8.8.8",
  "port": 53,
  "ping": {
    "success": true,
    "packetsSent": 3,
    "packetsReceived": 3,
    "packetLoss": 0.0,
    "avgRtt": 12.5,
    "details": "IP is reachable"
  },
  "port": {
    "success": true,
    "method": "netcat",
    "details": "Port 53 is open and accessible"
  },
  "summary": "Device at 8.8.8.8 is reachable and port 53 is open"
}
```

**Successful Serial Test:**
```json
{
  "success": true,
  "type": "serial",
  "interface": "serial_1",
  "device_id": 1,
  "interface_status": {
    "exists": true,
    "device_path": "/dev/ttyUSB0",
    "accessible": true,
    "details": "Interface is accessible with read/write permissions"
  },
  "communication": {
    "success": true,
    "method": "interface_check",
    "details": "Serial interface serial_1 is accessible"
  },
  "summary": "Serial interface serial_1 is accessible and device 1 responded"
}
```

**Failed Test:**
```json
{
  "success": false,
  "type": "tcp",
  "ip": "192.168.254.254",
  "error": "Command failed: ping -c 3 -W 2 192.168.254.254",
  "details": "IP ping failed - device may be offline or unreachable"
}
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 14+ 
- Linux/Unix system with ping command
- netcat or telnet for port testing
- Proper permissions for ping and network commands

### Backend Setup
1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   # or
   node src/app.js
   ```

3. **Verify Service**
   ```bash
   curl http://localhost:5001/api/connectivity/health
   ```

### Frontend Integration
The frontend automatically uses the connectivity testing service through the `ApiService.testDeviceConnectivity()` method.

## 🧪 Testing

### Run Test Suite
```bash
cd backend
node test-connectivity.js
```

### Manual Testing
```bash
# Test TCP connectivity
curl -X POST http://localhost:5001/api/connectivity/test-connectivity \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tcp",
    "ip": "8.8.8.8",
    "port": 53,
    "timeout": 5000
  }'

# Test Serial connectivity
curl -X POST http://localhost:5001/api/connectivity/test-connectivity \
  -H "Content-Type: application/json" \
  -d '{
    "type": "serial",
    "interface": "serial_1",
    "device_id": 1,
    "timeout": 5000
  }'
```

## 🔧 Configuration

### Environment Variables
- `PING_TIMEOUT`: Default ping timeout in milliseconds
- `PORT_TEST_TIMEOUT`: Default port test timeout in milliseconds

### Ping Configuration
- **Packet Count**: 3 packets per test
- **Wait Time**: 2 seconds between packets
- **Timeout**: Configurable per request

### Port Testing
- **Primary Method**: netcat (`nc -z`)
- **Fallback Method**: telnet
- **Timeout**: Configurable per request

## 📊 Ping Statistics

The service provides detailed ping statistics:

- **Packets Sent**: Total packets sent
- **Packets Received**: Successfully received packets
- **Packet Loss**: Percentage of lost packets
- **Average RTT**: Average round-trip time in milliseconds

## 🚨 Error Handling

### Common Error Scenarios
1. **Network Unreachable**: Device is offline or network is down
2. **Permission Denied**: Insufficient privileges for ping/port testing
3. **Timeout**: Request exceeded specified timeout
4. **Invalid Input**: Missing required parameters

### Error Response Format
```json
{
  "success": false,
  "error": "Human readable error message",
  "details": "Technical error details",
  "type": "tcp|serial",
  "timestamp": "ISO timestamp"
}
```

## 🔒 Security Considerations

- **Command Injection**: All inputs are validated and sanitized
- **Timeout Limits**: Maximum timeout limits prevent hanging requests
- **Permission Checks**: Serial interface access is verified
- **Error Sanitization**: Sensitive information is filtered from error responses

## 📈 Performance

### Typical Response Times
- **Local Network**: 1-5ms ping, 50-200ms total response
- **Internet**: 10-100ms ping, 100-500ms total response
- **Serial Tests**: 100-500ms total response

### Scalability
- **Concurrent Tests**: Supports multiple simultaneous connectivity tests
- **Resource Usage**: Minimal CPU and memory overhead
- **Timeout Handling**: Efficient timeout management prevents resource leaks

## 🐛 Troubleshooting

### Common Issues

1. **Ping Command Not Found**
   ```bash
   # Install ping utility
   sudo apt-get install iputils-ping  # Ubuntu/Debian
   sudo yum install iputils           # CentOS/RHEL
   ```

2. **Permission Denied**
   ```bash
   # Check if running as root or with proper permissions
   sudo node src/app.js
   ```

3. **Port Test Fails**
   ```bash
   # Install netcat
   sudo apt-get install netcat       # Ubuntu/Debian
   sudo yum install nc               # CentOS/RHEL
   ```

4. **Serial Interface Not Found**
   ```bash
   # Check available serial devices
   ls -la /dev/tty*
   
   # Check permissions
   ls -la /dev/ttyUSB0
   ```

### Debug Mode
Enable detailed logging by setting environment variable:
```bash
DEBUG=connectivity node src/app.js
```

## 🔄 Updates & Maintenance

### Version History
- **v1.0.0**: Initial release with TCP and Serial testing
- **v1.1.0**: Added detailed ping statistics and port testing
- **v1.2.0**: Enhanced error handling and security improvements

### Future Enhancements
- [ ] Modbus protocol testing
- [ ] SNMP connectivity testing
- [ ] WebSocket connectivity testing
- [ ] Load balancing for multiple test servers
- [ ] Historical connectivity data storage

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs in the console
3. Run the test suite to verify functionality
4. Check network and system permissions

## 📄 License

This service is part of the Green Project IoT Dashboard.
