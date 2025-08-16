# 📊 Employee Hour Tracker

> A comprehensive web application for tracking if employees entered their work time with real-time analytics, management features, and automated backups.

⚠️ **SECURITY NOTICE**: Versions prior to v1.6.17 contain critical vulnerabilities. Use v1.6.17 or later only.

## 🚀 Quick Docker Start

```bash
# Latest secure version
docker run -p 3000:3000 tebwritescode/employee-hour-tracker:v1.6.17

# With persistent data (recommended)
docker run -d \
  --name employee-tracker \
  -p 3000:3000 \
  -v employee-tracker-data:/app/data \
  -v employee-tracker-backups:/app/backups \
  tebwritescode/employee-hour-tracker:v1.6.17

# Using Docker Compose
curl -O https://raw.githubusercontent.com/tebwritescode/employee-hour-tracker/main/docker-compose.yml
docker-compose up -d
```

**Access**: http://localhost:3000

## ✨ Features

### 📅 **Time Tracking**
- Interactive weekly grid interface for tracking employee time entries
- Click-to-cycle through status states: Not Entered → Entered → Incorrect  
- Week navigation with integrated calendar picker
- Auto-save functionality for all changes

### 📈 **Analytics Dashboard**
- Visual analytics with interactive Chart.js charts
- Date filtering with preset ranges or custom selection
- Status distribution pie charts and employee comparison bar charts
- Real-time summary cards with key statistics

### 👥 **Employee Management**
- Complete employee lifecycle management with admin authentication
- Add, edit, and remove employees with confirmation dialogs
- Session-based secure access control

### 💾 **Data Export & Backup**
- Multiple export formats: Excel (with colors), JSON, CSV
- Automated database backups with configurable retention
- Scheduled backup system built-in

### 🎨 **Modern UI/UX**
- Responsive design optimized for all devices
- Cohesive purple gradient theme with smooth animations
- Mobile-friendly touch interactions

## 🐋 Docker Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | `employee-tracker-secret-key` | Session encryption key ⚠️ Change in production! |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Initial admin password ⚠️ Change in production! |
| `BACKUP_ENABLED` | `true` | Enable automated backups |
| `BACKUP_INTERVAL` | `86400000` | Backup interval (ms, default: 24h) |
| `NODE_ENV` | `development` | Environment mode |

### Docker Volumes
```yaml
volumes:
  - ./data:/app/data           # Database storage
  - ./backups:/app/backups     # Backup storage
```

### Production Docker Compose Example
```yaml
version: '3.8'
services:
  app:
    image: tebwritescode/employee-hour-tracker:v1.6.17
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=your-secure-secret-here
      - DEFAULT_ADMIN_PASSWORD=your-secure-password
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
    restart: unless-stopped
```

## 🏗️ Architecture & Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite3 with better-sqlite3
- **Frontend**: Vanilla JavaScript + Chart.js  
- **Authentication**: Express-session + bcryptjs
- **Container**: Multi-arch support (AMD64/ARM64)

## 🔐 Security Features
- Password hashing with bcryptjs
- Session-based authentication with secure cookies
- CORS protection and SQL injection prevention
- Rate limiting and CSRF protection
- Configurable session secrets

## 📖 Usage
1. **Time Tracking**: Navigate weeks and click cells to cycle through status states
2. **Analytics**: View charts and export data in multiple formats
3. **Management**: Admin login to manage employees and settings

## 🌍 Multi-Platform Support
This Docker image supports both `linux/amd64` and `linux/arm64` architectures.

## 📋 Requirements
- **Memory**: 512MB minimum
- **Storage**: Varies with data size (database grows with entries)
- **Ports**: 3000 (configurable via PORT env var)

## 🔗 Links
- **GitHub Repository**: https://github.com/tebwritescode/employee-hour-tracker
- **Documentation**: See GitHub README for complete setup guide
- **Issues & Support**: https://github.com/tebwritescode/employee-hour-tracker/issues
- **Changelog**: https://github.com/tebwritescode/employee-hour-tracker/blob/main/CHANGELOG.md

## 🆕 What's New in v1.6.17 - Security Release
- **FIXED**: Cookie security, sensitive data exposure, SQL injection vulnerability
- **ADDED**: Rate limiting and enhanced security features
- **STABLE**: Ready for production with comprehensive timezone safety

MIT Licensed | Created by [tebwritescode](https://github.com/tebwritescode)