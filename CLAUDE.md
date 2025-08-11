# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Start production server (port 3000)
npm start

# Start development server with auto-reload (using nodemon)
npm run dev

# Docker deployment (recommended for production)
docker-compose up -d
```

## Architecture Overview

This is a full-stack Node.js/Express application for tracking employee work hours with the following key components:

### Backend Architecture
- **server.js:1-650**: Main Express server with RESTful API endpoints
  - Session-based authentication using express-session and bcryptjs
  - SQLite3 database with 4 tables: employees, time_entries, admin_users, settings
  - CORS enabled for cross-origin requests
  - Environment variable configuration for deployment flexibility

### Database Schema
- **employees**: id, name, created_at
- **time_entries**: Tracks weekly status (Not Entered/Entered/Incorrect) for each day
- **admin_users**: Authentication for management functions
- **settings**: Application-wide configuration storage

### Frontend Architecture
- **public/script.js:1-1200**: Single-page application using vanilla JavaScript
  - Class-based architecture with `EmployeeTracker` as main controller
  - Three main sections: Time Tracking, Analytics, Management
  - Real-time data updates without page refreshes
  
- **public/chart.js**: Analytics visualization using Chart.js library
  - Pie charts for status distribution
  - Bar charts for employee comparisons

### Backup System
- **backup.js:1-91**: Automated database backup scheduler
  - Configurable interval (default: 24 hours)
  - Retention policy (default: 7 backups)
  - Runs independently or integrated with main server

## Key API Endpoints

- `GET/POST /api/employees` - Employee CRUD operations
- `GET/POST /api/time-entries` - Time entry management
- `GET /api/analytics` - Analytics data retrieval
- `POST /api/login` - Admin authentication
- `GET /api/export/:format` - Data export (CSV/JSON/Excel)

## Environment Variables

Critical configurations for deployment:
- `PORT`: Server port (default: 3000)
- `DB_PATH`: Database file location
- `SESSION_SECRET`: Session encryption key (change in production!)
- `DEFAULT_ADMIN_USERNAME/PASSWORD`: Initial admin credentials
- `BACKUP_INTERVAL_HOURS`: Backup frequency
- `NODE_ENV`: development/production mode

## Important Development Notes

1. **No test suite**: This project currently has no automated tests. Consider adding tests when implementing new features.

2. **Authentication**: Admin authentication is session-based. The requireAuth middleware (server.js:88) protects management endpoints.

3. **Database operations**: All database queries use parameterized statements to prevent SQL injection.

4. **Static files**: Frontend assets are served from the `public/` directory.

5. **Docker deployment**: Use docker-compose.yml for production deployment with persistent volumes for data and backups.