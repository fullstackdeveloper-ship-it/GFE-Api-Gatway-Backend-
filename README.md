# Green Project Backend

A professional Flask-SocketIO backend service for handling sensor data from NATS and broadcasting it to connected WebSocket clients.

## 🏗️ Architecture

```
backend/
├── src/                    # Source code
│   ├── config/            # Configuration management
│   ├── services/          # Business logic services
│   │   ├── nats/         # NATS client service
│   │   └── socket/       # Socket.IO management
│   ├── api/              # API routes and middleware
│   ├── models/           # Data models
│   └── utils/            # Utility functions
├── tests/                 # Test files
├── docs/                  # Documentation
├── templates/             # HTML templates
├── .env                   # Environment variables
├── requirements.txt       # Python dependencies
├── main.py               # Application entry point
└── README.md             # This file
```

## 🚀 Features

- **Flask Application Factory Pattern** - Clean, modular application structure
- **NATS Integration** - Subscribe to sensor data topics
- **WebSocket Support** - Real-time data broadcasting via Socket.IO
- **Environment Configuration** - Centralized configuration management
- **Professional Logging** - Structured logging with configurable levels
- **Health Check Endpoint** - Monitor service status
- **Modular Design** - Easy to extend and maintain

## 📋 Prerequisites

- Python 3.8+
- NATS server running
- Virtual environment (recommended)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_SECRET_KEY` | Flask secret key | `your-secret-key-here` |
| `FLASK_HOST` | Host to bind to | `0.0.0.0` |
| `FLASK_PORT` | Port to listen on | `5001` |
| `FLASK_DEBUG` | Debug mode | `True` |
| `NATS_URL` | NATS server URL | `nats://edge:CHANGE_ME_STRONG@192.168.100.135:4222` |
| `NATS_TOPIC` | NATS topic to subscribe to | `sensor.data` |
| `SOCKET_CORS_ORIGINS` | CORS origins for Socket.IO | `*` |
| `LOG_LEVEL` | Logging level | `INFO` |

## 🚀 Running the Application

### Development Mode
```bash
python main.py
```

### Production Mode
```bash
export FLASK_DEBUG=False
python main.py
```

### Using Flask CLI
```bash
export FLASK_APP=src.app
export FLASK_ENV=development
flask run --host=0.0.0.0 --port=5001
```

## 📡 API Endpoints

- `GET /` - Main page
- `GET /health` - Health check endpoint

## 🔌 WebSocket Events

### Client to Server
- `connect` - Client connects
- `disconnect` - Client disconnects
- `request_data` - Client requests data

### Server to Client
- `connected` - Connection confirmation
- `sensor_data` - Sensor data from NATS
- `alert` - System alerts
- `log` - System logs

## 🔧 Development

### Adding New Services
1. Create a new service in `src/services/`
2. Import and initialize in `src/app.py`
3. Add configuration in `src/config/settings.py`

### Adding New API Routes
1. Add routes in `register_routes()` function in `src/app.py`
2. Or create separate route modules in `src/api/routes/`

### Testing
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5001/health
```

Response:
```json
{
  "status": "healthy",
  "nats_connected": true,
  "clients_connected": 2
}
```

### Logs
The application logs to stdout with configurable levels:
- `DEBUG` - Detailed debug information
- `INFO` - General information
- `WARNING` - Warning messages
- `ERROR` - Error messages

## 🚨 Troubleshooting

### Common Issues

1. **NATS Connection Failed**
   - Check NATS server is running
   - Verify NATS_URL in .env
   - Check network connectivity

2. **Socket.IO Connection Issues**
   - Verify CORS settings
   - Check client connection logic
   - Review browser console for errors

3. **Port Already in Use**
   - Change FLASK_PORT in .env
   - Kill existing process: `lsof -ti:5001 | xargs kill -9`

## 🔮 Future Enhancements

- Database integration (PostgreSQL, MongoDB)
- Authentication and authorization
- API rate limiting
- Metrics and monitoring
- Docker containerization
- Kubernetes deployment
- Message queuing (Redis, RabbitMQ)

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request # GFE-Api-Gatway-Backend-
