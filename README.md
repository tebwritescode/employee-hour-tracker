# 📊 Employee Hour Tracker

A comprehensive web application for tracking employee work hours with real-time analytics, management features, and automated backups.

![Version](https://img.shields.io/badge/Version-1.6.17-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-orange)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ⚠️ Security Notice
**Important:** Versions prior to v1.6.17 contain security vulnerabilities. Users should upgrade to the latest version. See [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) for details.

---

## 🎯 Features

### 📅 Time Tracking
- **Weekly View**: Track employee hours for each day of the week
- **Status Management**: Mark hours as Entered, Not Entered, or Incorrect
- **Share Links**: Generate shareable URLs for specific weeks
- **Calendar Navigation**: Easy week-to-week navigation with date picker

### 📊 Analytics & Reporting
- **Real-time Dashboards**: Visual analytics with charts and graphs
- **Employee Comparisons**: Compare tracking status across team members  
- **Status Distribution**: Pie charts showing completion rates
- **Export Options**: CSV, JSON, and Excel export formats

### 👥 Management Features
- **Employee Management**: Add, edit, and remove employees
- **Admin Authentication**: Secure login system for management functions
- **Bulk Operations**: Mass updates and data management tools
- **Access Control**: Role-based permissions for different user types

### 🛡️ Enterprise Ready
- **Automated Backups**: Configurable database backup system
- **Multi-timezone Support**: Server-side date calculations for global teams
- **Docker Deployment**: Production-ready containerization
- **Rate Limiting**: Built-in protection against abuse
- **Security Features**: CSRF protection, secure cookies, input validation

---

## 🚀 Quick Start

### Docker (Recommended)
```bash
# Run with Docker
docker run -p 3000:3000 tebwritescode/employee-hour-tracker:v1.6.17

# Or with Docker Compose
curl -O https://raw.githubusercontent.com/tebwritescode/employee-hour-tracker/main/docker-compose.yml
docker-compose up -d
```

### Manual Installation  
```bash
# Clone the repository
git clone https://github.com/tebwritescode/employee-hour-tracker.git
cd employee-hour-tracker

# Install dependencies
npm install

# Start the application
npm start
```

**Access**: Open http://localhost:3000 in your browser

---

## 📸 Screenshots

<details>
  <summary><i>Click to show screenshots</i></summary>

![Table View](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.03.27_PM.png)
![Management](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.03.54_PM.png)
![Analytics](https://teb.codes/2-Code/Flask/Employee-Hour-Tracker/Screenshot_2025-08-08_at_4.05.46_PM.png)

</details>

---

## ⚙️ Configuration

### Environment Variables
```bash
PORT=3000                          # Server port
DB_PATH=/app/data/hours.db        # Database location  
SESSION_SECRET=your-secret-key     # Session encryption
BASE_URL=https://your-domain.com   # Custom domain for share links
DEFAULT_ADMIN_USERNAME=admin       # Initial admin username
DEFAULT_ADMIN_PASSWORD=password    # Initial admin password (change this!)
BACKUP_INTERVAL_HOURS=24          # Backup frequency
ENABLE_DEBUG_LOGS=false           # Debug logging
```

### Docker Volumes
```yaml
volumes:
  - ./data:/app/data           # Database storage
  - ./backups:/app/backups     # Backup storage
```

---

## 🔧 API Integration

The application includes a comprehensive REST API for external integrations:

- **Authentication**: Session-based auth with CSRF protection
- **Employee Management**: CRUD operations for employee data
- **Time Entries**: Retrieve and update time tracking data
- **Analytics**: Access reporting data programmatically
- **Export**: Generate data exports in multiple formats

See [API Documentation](./API.md) for complete endpoint reference.

---

## 📁 Project Structure

```
employee-hour-tracker/
├── server.js              # Main Express server
├── public/                # Frontend assets
│   ├── index.html        # Main UI
│   ├── script.js         # Frontend JavaScript
│   └── styles.css        # CSS styles
├── data/                 # Database storage
├── backups/              # Automated backups
├── docker-compose.yml    # Docker deployment
└── package.json          # Dependencies
```

---

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start
```

### Docker Development
```bash
# Build local image
docker build -t employee-hour-tracker .

# Run with development settings
docker run -e ENABLE_DEBUG_LOGS=true -p 3000:3000 employee-hour-tracker
```

### Testing
```bash
# Run functionality tests
node test-button-functionality.js
node test-timezone-buttons.js
```

---

## 📋 Requirements

- **Node.js**: 18.x or higher
- **NPM**: 8.x or higher  
- **Storage**: ~50MB for application, additional space for database/backups
- **Memory**: ~512MB RAM minimum
- **Network**: Port 3000 (configurable)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Documentation**: [CHANGELOG.md](./CHANGELOG.md)
- **Issues**: [GitHub Issues](https://github.com/tebwritescode/employee-hour-tracker/issues)
- **Security**: [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md)

---

**Made with ❤️ for better time tracking**