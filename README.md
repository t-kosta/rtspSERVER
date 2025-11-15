# RTSP Relay Server

A powerful RTSP relay server that allows you to connect multiple RTSP input streams and create composite output streams with customizable layouts. Perfect for video surveillance, monitoring systems, and multi-camera applications.

## Features

- **Multiple Input Streams**: Connect up to 50 RTSP input streams
- **Flexible Layouts**: Create output streams with various grid layouts (2x2, 3x3, 4x4, etc.)
- **Real-time Monitoring**: WebSocket-based real-time stream status updates
- **User Management**: Multi-user support with role-based access control (Admin, Manager, Viewer)
- **Modern Web Interface**: User-friendly React-based dashboard
- **Docker Support**: Easy deployment with Docker Compose
- **RESTful API**: Complete API for integration with other systems

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Input Streams  │────▶│  RTSP Relay      │────▶│ Output Streams  │
│  (RTSP Sources) │     │  Server          │     │ (Composite)     │
│                 │     │  (FFmpeg)        │     │                 │
│  - Camera 1     │     │                  │     │  - 2x2 Grid     │
│  - Camera 2     │     │  ┌────────────┐  │     │  - 3x3 Grid     │
│  - Camera 3     │     │  │ PostgreSQL │  │     │  - 4x4 Grid     │
│  - ...          │     │  └────────────┘  │     │  - Custom       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                 │
                        ┌────────┴────────┐
                        │  Web Dashboard  │
                        │  (React)        │
                        └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 20+, PostgreSQL 14+, and FFmpeg 4+

### Docker Deployment (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd rtspSERVER
```

2. Start the services:
```bash
docker-compose up -d
```

3. Access the web interface:
```
http://localhost
```

4. Default login credentials:
```
Email: admin@example.com
Password: admin123
```

### Manual Installation

1. Install dependencies:
```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

2. Set up PostgreSQL database:
```bash
createdb rtsp_relay
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start the backend:
```bash
npm run dev
```

5. Start the frontend (in a new terminal):
```bash
cd frontend
npm run dev
```

6. Access the web interface at `http://localhost:3001`

## Usage Guide

### 1. Add Input Streams

1. Navigate to **Input Streams** in the dashboard
2. Click **Add Stream**
3. Enter:
   - Name: Descriptive name for the stream
   - RTSP URL: The source RTSP URL (e.g., `rtsp://192.168.1.100:554/stream1`)
   - Username/Password: If authentication is required
4. Click **Create**

### 2. Create Output Streams

1. Navigate to **Output Streams**
2. Click **Create Output Stream**
3. Configure:
   - Name: Output stream name
   - Layout: Select grid layout (2x2, 3x3, etc.)
   - Resolution: Output resolution (1080p, 720p, 4K)
   - Framerate: Target framerate (default: 25fps)
4. Click **Create**

### 3. Configure Stream Mappings

1. Click **Configure** on an output stream
2. For each grid slot, select an input stream from the dropdown
3. The layout will show which input stream is assigned to each position
4. Remove mappings by clicking **Remove** next to the mapping

### 4. Start/Stop Streams

- Click **Start** to begin streaming the composite output
- Click **Stop** to halt the stream
- Monitor the status in real-time (Running, Stopped, Error)

### 5. Access Output Streams

Once started, output streams are available at:
```
rtsp://localhost:<port>/<stream-name>
```

The port and full URL are displayed in the output stream details.

## User Roles

### Admin
- Full access to all features
- Can create/edit/delete users
- Can manage all streams and configurations

### Manager
- Can create/edit/delete input and output streams
- Can configure stream mappings
- Cannot manage users

### Viewer
- Read-only access
- Can view all streams and their status
- Cannot make any changes

## API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "fullName": "Administrator",
    "role": "admin"
  }
}
```

### Input Streams

```bash
# Get all input streams
GET /api/streams/input
Authorization: Bearer <token>

# Create input stream
POST /api/streams/input
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Camera 1",
  "rtspUrl": "rtsp://192.168.1.100:554/stream1",
  "username": "admin",
  "password": "password"
}

# Delete input stream
DELETE /api/streams/input/:id
Authorization: Bearer <token>
```

### Output Streams

```bash
# Get all output streams
GET /api/streams/output
Authorization: Bearer <token>

# Create output stream
POST /api/streams/output
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Main Display",
  "layoutTemplateId": 2,
  "resolution": "1920x1080",
  "framerate": 25,
  "bitrate": "2000k"
}

# Start output stream
POST /api/streams/output/:id/start
Authorization: Bearer <token>

# Stop output stream
POST /api/streams/output/:id/stop
Authorization: Bearer <token>

# Delete output stream
DELETE /api/streams/output/:id
Authorization: Bearer <token>
```

### Stream Mappings

```bash
# Get mappings for output stream
GET /api/streams/output/:id/mappings
Authorization: Bearer <token>

# Create mapping
POST /api/streams/mappings
Authorization: Bearer <token>
Content-Type: application/json

{
  "outputStreamId": 1,
  "inputStreamId": 1,
  "slotPosition": 0
}

# Delete mapping
DELETE /api/streams/mappings/:id
Authorization: Bearer <token>
```

### WebSocket

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=<your-jwt-token>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Stream status update:', data);
};
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | rtsp_relay |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiration | 24h |
| `RTSP_OUTPUT_BASE_PORT` | Starting port for output streams | 8554 |
| `RTSP_MAX_STREAMS` | Maximum concurrent streams | 50 |
| `FFMPEG_PATH` | Path to FFmpeg binary | /usr/bin/ffmpeg |
| `ADMIN_EMAIL` | Default admin email | admin@example.com |
| `ADMIN_PASSWORD` | Default admin password | admin123 |

### Layout Templates

Available by default:
- **Single**: 1x1 (1 stream)
- **2x2 Grid**: 2x2 (4 streams)
- **3x3 Grid**: 3x3 (9 streams)
- **4x4 Grid**: 4x4 (16 streams)
- **1+5**: 2x3 (6 streams, asymmetric)
- **2x4 Grid**: 2x4 (8 streams)
- **3x4 Grid**: 3x4 (12 streams)

## Troubleshooting

### FFmpeg Issues

If streams fail to start, check FFmpeg installation:
```bash
ffmpeg -version
```

Install FFmpeg if missing:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Docker (already included in image)
```

### Database Connection Issues

Verify PostgreSQL is running and credentials are correct:
```bash
psql -h localhost -U postgres -d rtsp_relay
```

### Stream Connection Errors

- Verify RTSP URLs are accessible
- Check network connectivity to cameras
- Ensure correct authentication credentials
- Check firewall rules for RTSP ports

### High CPU Usage

- Reduce output resolution
- Lower framerate
- Decrease bitrate
- Limit number of concurrent streams

## Performance Optimization

### Hardware Acceleration

Enable hardware acceleration in FFmpeg for better performance:

1. NVIDIA GPU (NVENC):
```bash
# In StreamManager.ts, modify FFmpeg args:
'-c:v', 'h264_nvenc'
```

2. Intel QuickSync:
```bash
'-c:v', 'h264_qsv'
```

3. AMD (VAAPI):
```bash
'-vaapi_device', '/dev/dri/renderD128',
'-c:v', 'h264_vaapi'
```

### Resource Limits

Adjust based on your hardware:
- 4 streams: 4GB RAM, 2 CPU cores
- 16 streams: 8GB RAM, 4 CPU cores
- 50 streams: 16GB+ RAM, 8+ CPU cores

## Security Recommendations

1. **Change Default Credentials**: Immediately change admin password
2. **Use HTTPS**: Deploy behind reverse proxy with SSL
3. **Strong JWT Secret**: Use cryptographically secure random string
4. **Network Isolation**: Restrict database access
5. **Regular Updates**: Keep dependencies updated
6. **Firewall Rules**: Limit access to necessary ports only

## Development

### Project Structure

```
rtspSERVER/
├── src/
│   ├── db/              # Database configuration and schema
│   ├── middleware/      # Express middleware (auth, validation)
│   ├── routes/          # API routes
│   ├── services/        # Business logic (StreamManager, WebSocket)
│   └── index.ts         # Application entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── store/       # State management (Zustand)
│   │   └── App.tsx      # Root component
│   └── package.json
├── docker-compose.yml   # Docker orchestration
├── Dockerfile          # Backend Docker image
└── package.json        # Backend dependencies
```

### Running Tests

```bash
npm test
```

### Building for Production

```bash
# Backend
npm run build

# Frontend
cd frontend
npm run build
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Check existing documentation
- Contact the development team

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] Recording capabilities
- [ ] Snapshot functionality
- [ ] Advanced analytics
- [ ] Motion detection
- [ ] Email/SMS alerts
- [ ] Mobile app
- [ ] ONVIF support
- [ ] Cloud storage integration
