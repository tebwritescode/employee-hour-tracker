# 📊 Employee Hour Tracker

> A comprehensive web application for tracking if employees entered their work time with real-time analytics, management features, and automated backups.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-orange)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

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
| `SESSION_SECRET` | `employee-tracker-secret-key` | Session encryption key |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | Initial admin password |
| `BACKUP_ENABLED` | `true` | Enable automated backups |
| `BACKUP_INTERVAL` | `86400000` | Backup interval in milliseconds (default: 24 hours) |
| `BACKUP_RETENTION_DAYS` | `30` | Number of days to keep backup files |

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  app:
    image: employee-hour-tracker
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=your-secure-secret-here
      - DEFAULT_ADMIN_USERNAME=admin
      - DEFAULT_ADMIN_PASSWORD=change-this-password
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
```

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

## 🐛 Known Issues

- Week navigation may occasionally show incorrect dates when changing weeks rapidly
- Status markers might not update immediately in some edge cases with week transitions

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

For issues, questions, or suggestions, please open an issue on the [GitHub repository](https://github.com/tebwritescode/employee-hour-tracker/issues).

---

<p align="center">Made with ❤️ by <a href="https://github.com/tebwritescode">tebwritescode</a></p>
