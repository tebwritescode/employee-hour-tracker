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
- `BASE_URL`: Custom domain for share links (e.g., `https://cnvrgnc.us`)
- `SESSION_SECRET`: Session encryption key (change in production!)
- `DEFAULT_ADMIN_USERNAME/PASSWORD`: Initial admin credentials
- `BACKUP_INTERVAL_HOURS`: Backup frequency
- `NODE_ENV`: development/production mode

## Database Migrations

**CRITICAL**: The application includes a comprehensive database migration system that runs automatically on startup.

### How Database Migrations Work
1. **Automatic Migration Checks**: On every server start, the system checks for pending migrations
2. **Migration Tracking**: A `migrations` table tracks which migrations have been applied
3. **Sequential Execution**: Migrations run in order, ensuring proper schema evolution
4. **Version Compatibility**: Users can safely upgrade from ANY previous version to the latest

### Adding New Migrations

When database schema changes are needed:

1. Add a new migration object to the `migrations` array in `server.js:runMigrations()`
2. Follow this structure:
```javascript
{
  name: 'v1.X.0_description',
  description: 'Human-readable description',
  run: (callback) => {
    // Migration logic here
    // MUST call callback() on success or callback(err) on failure
  }
}
```

### Current Migrations
- **v1.1.0_add_empty_status**: Changes default status from 'Not Entered' to 'Empty'

### Testing Migrations
- Test upgrading from oldest version to newest
- Test fresh installations
- Test re-running server (migrations should be idempotent)

## Important Development Notes

1. **Version Updates**: 
   - ALWAYS increment the MINOR version (x.Y.z) every time a Docker image is pushed
   - Version format: MAJOR.MINOR.PATCH (e.g., 1.3.0)
   - Version is displayed in server logs and UI footer
   - Update version in: package.json, README.md badge, and footer HTML

2. **Testing Before Completion**:
   - ALWAYS test functionality with curl commands before marking tasks complete
   - Test data persistence across week changes
   - Verify changes work in the actual running application
   - Test database migrations from older versions

3. **No test suite**: This project currently has no automated tests. Consider adding tests when implementing new features.

3. **Authentication**: Admin authentication is session-based. The requireAuth middleware (server.js:88) protects management endpoints.

4. **Database operations**: All database queries use parameterized statements to prevent SQL injection.

5. **Static files**: Frontend assets are served from the `public/` directory.

6. **Docker deployment**: Use docker-compose.yml for production deployment with persistent volumes for data and backups. Build multi-arch images using: `docker buildx build --platform linux/amd64,linux/arm64`
   - **IMPORTANT**: Docker tags must ALWAYS include the 'v' prefix (e.g., v1.5.2, NOT 1.5.2)
   - Build and push command format: `docker buildx build --platform linux/amd64,linux/arm64 -t tebwritescode/employee-hour-tracker:latest -t tebwritescode/employee-hour-tracker:v1.5.2 --push .`