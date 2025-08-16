# 📊 Employee Hour Tracker

> A comprehensive web application for tracking if employees entered their work time with real-time analytics, management features, and automated backups.

![Version](https://img.shields.io/badge/Version-1.6.17-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-orange)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Screenshots

<details>
  <summary><i>Click to show screenshots</i></summary>

![Table View](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.03.27_PM.png)
![Management](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.03.54_PM.png)
![Analytics](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.05.46_PM.png)

</details>

## 🆕 What's New in v1.6.17 - 🔒 SECURITY RELEASE

### 🔒 Security Fixes
- **FIXED**: Cookie security - Secure flag properly set in production
- **FIXED**: Sensitive data exposure - Removed secrets from server logs  
- **FIXED**: SQL injection vulnerability - Added input validation
- **FIXED**: Missing rate limiting - Added to file serving routes
- **FIXED**: Share URL functionality - Week parameter parsing works correctly

*For complete changelog details, see [CHANGELOG.md](CHANGELOG.md)*
- **TESTED**: Comprehensive automated testing for all navigation functionality
- **STABLE**: Ready for production deployment with full timezone safety

## ⚠️ KNOWN ISSUES - Under Investigation

### 🌏 Philippines Timezone Navigation Issue
**Status**: Under active investigation  
**Affected Users**: Specific workstations in Philippines timezone (Asia/Manila)  
**Symptoms**:
- ✅ Previous week navigation works correctly
- ❌ Next week navigation button may not respond  
- ❌ Monday calendar selection from current week may fail
- ✅ Other weekdays from same week work normally

**Workaround**: Use calendar to select Tuesday from the desired week, then navigate as needed.  
**Investigation**: Issue is isolated to specific client workstations and does not affect the majority of users.  
**Debug**: Enable debug logging with `ENABLE_DEBUG_LOGS=true` for detailed troubleshooting.

## Previous Major Releases

### 🕐 Critical Timezone & Navigation Fixes
- **FIXED**: Multi-timezone data separation bug where users in different timezones saw different data  
- **FIXED**: Week navigation arrows not working on some client computers
- **FIXED**: Calendar date selection inconsistencies on specific workstations
- **NEW**: All navigation now uses server-side week calculation for 100% consistency
- **IMPROVED**: Production build with debug logging removed
- **UPGRADE**: Resolves all known timezone and navigation issues from v1.6.5 and earlier

## ⚠️ Version Upgrade Notices

### **v1.6.5 and Earlier - CRITICAL TIMEZONE BUGS**
- **🚨 UPGRADE IMMEDIATELY**: Versions 1.6.5 and earlier contain critical timezone bugs
- **Issue**: Users in different timezones see separate data instead of shared company data
- **Issue**: Week navigation arrows may not work on specific client computers  
- **Issue**: Calendar Monday selection may fail on certain workstations
- **Solution**: **Upgrade to v1.6.6 or later** for complete resolution

### **v1.6.3 - INCOMPLETE TIMEZONE FIX**
- **⚠️ PARTIAL FIX**: This version attempted timezone fixes but was incomplete
- **Recommendation**: **Skip to v1.6.6 or later** for complete timezone resolution

## Previous Major Release - v1.6.0

### 🚀 Complete API Platform
- **API Token Authentication**: Generate secure API tokens for external integrations
  - Token-based authentication for programmatic access
  - Configurable expiration dates
  - Token management interface in web UI
- **Interactive API Documentation**: Built-in API explorer at `/api-docs`
  - Test endpoints directly from your browser
  - Complete API reference with examples
  - Real-time request/response testing
- **Advanced Rate Limiting**: Intelligent rate limiting system
  - 100 req/min for unauthenticated users
  - 1000 req/min for API token holders
  - Stricter limits for authentication endpoints
  - Rate limit headers for client optimization
- **Comprehensive API Coverage**: RESTful API for all functionality
  - Employee management
  - Time entry operations
  - Analytics and reporting
  - Data export in multiple formats

**⚠️ UPGRADE NOTICE**: v1.6.0 contains timezone bugs. **Upgrade to v1.6.6 or later immediately**.

[View Full Changelog](CHANGELOG.md)

## ✨ Features

### 📅 **Time Tracking**
- Interactive weekly grid interface for tracking employee time entries
- Click-to-cycle through status states: Empty → Not Entered → Entered → Incorrect
- Week navigation with integrated calendar picker
- Configurable default week settings
- Auto-save functionality for all changes

### 📈 **Analytics Dashboard**
- **Visual Analytics**: Interactive charts powered by Chart.js
- **Date Filtering**: Preset ranges (Last Week, Last Month, Last 90 Days) or custom date selection
- **Status Distribution**: Pie chart showing overall entry patterns (now includes Empty status)
- **Employee Comparison**: Bar chart for performance analysis
- **Summary Cards**: Quick statistics at a glance

### 👥 **Employee Management**
- Complete employee lifecycle management
- Add new employees with immediate tracking integration
- Inline editing for employee names
- Safe removal with confirmation dialogs
- Session-based authentication for secure access

### 💾 **Data Export & Backup**
- **Multiple Export Formats**:
  - Colored Excel files maintaining visual status indicators
  - JSON format for system integrations
  - CSV for universal compatibility
- **Automated Backups**: Scheduled database backups with configurable retention

### 🎨 **Modern UI/UX**
- Responsive design optimized for all devices
- Cohesive purple gradient theme throughout
- Smooth animations and transitions
- Mobile-friendly touch interactions
- Clean, intuitive navigation
- New grey color scheme for Empty status

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- OR Docker and Docker Compose

### Installation Options

#### **Option 1: Node.js**

```bash
# Clone the repository
git clone https://github.com/tebwritescode/employee-hour-tracker.git
cd employee-hour-tracker

# Install dependencies
npm install

# Start the application
npm start

# For development with auto-reload
npm run dev
```

#### **Option 2: Docker Compose** (Recommended)

```bash
# Clone the repository
git clone https://github.com/tebwritescode/employee-hour-tracker.git
cd employee-hour-tracker

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

#### **Option 3: Docker CLI**

```bash
# Build the image
docker build -t employee-hour-tracker .

# Run the container
docker run -d \
  --name employee-tracker \
  -p 3000:3000 \
  -v employee-tracker-data:/app/data \
  employee-hour-tracker
```

Access the application at `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `DB_PATH` | `./employee_tracker.db` | Database file location |
| `BASE_URL` | _(auto-detect)_ | Custom domain for share links (e.g., `https://cnvrgnc.us`) |
| `SESSION_SECRET` | `employee-tracker-secret-key` | Session encryption key |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Initial admin password |
| `BACKUP_ENABLED` | `true` | Enable automated backups |
| `BACKUP_INTERVAL` | `86400000` | Backup interval in milliseconds (default: 24 hours) |
| `BACKUP_RETENTION_DAYS` | `30` | Number of days to keep backup files |
| `ENABLE_DEBUG_LOGS` | `false` | Enable detailed debug logging for troubleshooting |

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  app:
    image: employee-hour-tracker
    environment:
      - NODE_ENV=production
      - BASE_URL=https://your-domain.com  # Optional: Set your custom domain
      - SESSION_SECRET=your-secure-secret-here
      - DEFAULT_ADMIN_USERNAME=admin
      - DEFAULT_ADMIN_PASSWORD=change-this-password
      - ENABLE_DEBUG_LOGS=false  # Set to true for troubleshooting
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
```

## 📖 Usage Guide

### **Time Tracking** (`/tracking`)
1. Select the desired week using the date picker or arrow navigation
2. Click on any cell in the grid to cycle through status states:
   - **Empty** (grey): Default state for untracked entries
   - **Not Entered** (red): Explicitly marked as not entered
   - **Entered** (green): Time was entered
   - **Incorrect** (orange): Entry needs correction
3. Changes are automatically saved to the database
4. Use the week selector to navigate between different time periods

### **Analytics** (`/analytics`)
1. Select a date range using preset options or custom dates
2. View status distribution in the pie chart (now includes Empty status)
3. Compare employee performance in the bar chart
4. Export data using the export buttons

### **Management** (`/management`)
1. Login with admin credentials (default: `admin`/`admin123`)
2. Add new employees using the "Add Employee" form
3. Edit employee names by clicking the edit icon
4. Remove employees with the delete button (requires confirmation)
5. Access global settings and export options

## 🏗️ Architecture

```
employee-hour-tracker/
├── 📄 server.js              # Express server with v1.1.0 migration logic
├── 📄 backup.js              # Automated backup functionality
├── 📄 package.json           # Dependencies and scripts (v1.1.0)
├── 📄 docker-compose.yml     # Docker composition
├── 📄 Dockerfile             # Container configuration
├── 📁 public/                # Frontend assets
│   ├── 📄 index.html         # Main application HTML
│   ├── 📄 style.css          # Styles with Empty status support
│   ├── 📄 script.js          # Frontend logic with 4-state cycle
│   └── 📄 chart.js           # Analytics visualization
├── 📁 backups/               # Automated backup storage
└── 📗 employee_tracker.db    # SQLite database
```

### Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite3 with automatic migration support
- **Frontend**: Vanilla JavaScript + Chart.js
- **Authentication**: Express-session + bcryptjs
- **Containerization**: Docker + Docker Compose

## 🔐 Security

- Password hashing using bcryptjs
- Session-based authentication
- CORS protection
- SQL injection prevention via parameterized queries
- Secure session management with configurable secrets

## 🛠️ Development

### Available Scripts

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Install all dependencies
npm run install-deps
```

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/employees` | List all employees | No |
| POST | `/api/employees` | Add new employee | Yes |
| PUT | `/api/employees/:id` | Update employee | Yes |
| DELETE | `/api/employees/:id` | Remove employee | Yes |
| GET | `/api/time-entries` | Get time entries | No |
| POST | `/api/time-entries` | Update time entry | No |
| GET | `/api/analytics` | Get analytics data | No |
| POST | `/api/login` | Admin authentication | No |
| POST | `/api/logout` | End admin session | Yes |
| GET | `/api/export/:format` | Export data | Yes |

## 📊 Database Migration (v1.1.0)

The application automatically migrates existing databases when upgrading to v1.1.0:
- Preserves all existing time entry data
- Updates default values from "Not Entered" to "Empty"
- No manual intervention required
- Migration runs automatically on server startup

## 🐛 Known Issues

- Week navigation may occasionally show incorrect dates when changing weeks rapidly (Fixed in v1.1.0)
- Status markers might not update immediately in some edge cases with week transitions (Fixed in v1.1.0)

## Support

Issues? Questions? Praise-singing?  
File an issue on GitHub or yell at [teb](https://github.com/tebwritescode).

---
👑 Created by: [tebbydog0605](https://github.com/tebwritescode)  
🐋 Docker Hub: [tebwritescode](https://hub.docker.com/u/tebwritescode)  
💻 Website: [teb.codes](https://teb.codes)
