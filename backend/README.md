# Vehicle Reports Backend

Express.js backend API for the DIMO Vehicle Reports application.

## Features

- 🔐 **DIMO Authentication**: Handles developer and vehicle JWT tokens
- 🚗 **Vehicle Data**: Fetches vehicle information from DIMO API
- 📊 **Report Generation**: Generates CSV reports with vehicle telemetry data
- 📁 **File Storage**: Stores configuration and reports in tmp directory
- 🐳 **Docker Ready**: Containerized for easy deployment

## API Endpoints

### Configuration
- `GET /api/config` - Get app configuration
- `POST /api/config` - Save app configuration

### Authentication
- `POST /api/auth/developer` - Get developer JWT token
- `POST /api/auth/vehicle` - Get vehicle JWT token

### Vehicles
- `GET /api/vehicles` - Get user's vehicles

### Reports
- `POST /api/reports/generate` - Generate CSV report
- `GET /api/reports/download/:filename` - Download report
- `GET /api/reports` - List available reports

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## File Storage

The backend stores data in the `tmp/` directory:
- `app-config.json` - Application configuration
- `*.csv` - Generated reports

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build backend only
docker build -t vehicle-reports-backend .
docker run -p 3001:3001 vehicle-reports-backend
```
