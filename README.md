# 📊 Employee Hour Tracker

> A comprehensive web application for tracking if employees entered their work time with real-time analytics, management features, and automated backups.

![Version](https://img.shields.io/badge/Version-1.6.18-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-orange)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ⚠️ Security Notice

**Important:** Versions prior to v1.6.17 contain security vulnerabilities that have been fixed. Users should upgrade to the latest version. See [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) for details.

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

## ⚠️ Known Issues

### 🌏 Philippines Timezone Navigation Issue
**Status**: Under investigation  
**Affected**: Specific workstations in Philippines timezone  
**Workaround**: Use calendar to select Tuesday from the desired week, then navigate as needed  

## ✨ Features

### 📅 **Time Tracking**
- Interactive weekly grid interface for tracking employee time entries
- Click-to-cycle through status states: Not Entered → Entered → Incorrect
- Week navigation with integrated calendar picker
- Configurable default week settings
- Auto-save functionality for all changes

### 📈 **Analytics Dashboard**
- **Visual Analytics**: Interactive charts powered by Chart.js
- **Date Filtering**: Preset ranges (Last Week, Last Month, Last 90 Days) or custom date selection
- **Status Distribution**: Pie chart showing overall entry patterns
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
# Run latest version
docker run -p 3000:3000 tebwritescode/employee-hour-tracker:v1.6.17

# With persistent data
docker run -d \
  --name employee-tracker \
  -p 3000:3000 \
  -v employee-tracker-data:/app/data \
  -v employee-tracker-backups:/app/backups \
  tebwritescode/employee-hour-tracker:v1.6.17
```

Access the application at `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `DB_PATH` | `./employee_tracker.db` | Database file location |
| `SESSION_SECRET` | `employee-tracker-secret-key` | Session encryption key |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Initial admin password |
| `BACKUP_ENABLED` | `true` | Enable automated backups |
| `BACKUP_INTERVAL` | `86400000` | Backup interval in milliseconds (default: 24 hours) |
| `BACKUP_RETENTION_DAYS` | `30` | Number of days to keep backup files |

## 📖 Usage Guide

### **Time Tracking** (`/tracking`)
1. Select the desired week using the date picker or arrow navigation
2. Click on any cell in the grid to cycle through status states
3. Changes are automatically saved to the database
4. Use the week selector to navigate between different time periods

### **Analytics** (`/analytics`)
1. Select a date range using preset options or custom dates
2. View status distribution in the pie chart
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
├── 📄 server.js              # Express server and API endpoints
├── 📄 backup.js              # Automated backup functionality
├── 📄 package.json           # Dependencies and scripts
├── 📄 docker-compose.yml     # Docker composition
├── 📄 Dockerfile             # Container configuration
├── 📁 public/                # Frontend assets
│   ├── 📄 index.html         # Main application HTML
│   ├── 📄 style.css          # Styles and responsive design
│   ├── 📄 script.js          # Frontend logic and interactions
│   └── 📄 chart.js           # Analytics visualization
├── 📁 backups/               # Automated backup storage
└── 📗 employee_tracker.db    # SQLite database
```

### Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite3 with better-sqlite3
- **Frontend**: Vanilla JavaScript + Chart.js
- **Authentication**: Express-session + bcryptjs
- **Containerization**: Docker + Docker Compose

## 🔐 Security

- Password hashing using bcryptjs
- Session-based authentication
- CORS protection
- SQL injection prevention via parameterized queries
- Secure session management with configurable secrets

## 🔧 API Reference

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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**View Full Changelog**: [CHANGELOG.md](CHANGELOG.md)