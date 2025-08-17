# Employee Hour Tracker - iOS App

A SwiftUI iOS companion app for viewing Employee Hour Tracker data. This app focuses on providing a clean, mobile interface for viewing time tracking analytics and data overview.

## Features

### 📊 Primary Focus: Overview & Analytics
- **Analytics Dashboard**: Beautiful overview of completion rates, status distribution, and employee performance
- **Date Range Selection**: View data for this week, this month, last month
- **Summary Cards**: Quick stats on total employees, weeks, entries, and completion rates
- **Visual Charts**: Circular progress indicators and status breakdowns
- **Employee Details**: Per-employee analytics with completion rates

### ⏰ Read-Only Time Tracking View
- **Weekly Grid View**: Visual representation of employee time entry status
- **Status Indicators**: Color-coded status (Empty/Not Entered/Entered/Incorrect)
- **Week Navigation**: Browse different weeks of data
- **Read-Only Mode**: View-only unless authenticated for management

### ⚙️ Settings & Configuration
- **Server Configuration**: Connect to your Employee Hour Tracker server
- **Optional Authentication**: Sign in for management features (optional for viewing)
- **App Information**: Version and about details

## App Architecture

### MVVM Pattern with SwiftUI
```
EmployeeTracker/
├── Models/                 # Data models
│   └── Models.swift
├── Views/                  # SwiftUI views
│   ├── AnalyticsView.swift      # Main overview/analytics page
│   ├── TimeTrackingView.swift   # Read-only time tracking grid
│   ├── AuthenticationView.swift # Optional login
│   └── SettingsView.swift       # Configuration
├── ViewModels/            # Business logic
│   ├── AnalyticsViewModel.swift
│   ├── TimeTrackingViewModel.swift
│   └── AuthenticationViewModel.swift
└── Services/              # API and data services
    ├── APIService.swift   # HTTP client
    └── DataStore.swift    # Data management
```

### Key Components

**APIService**: Handles all HTTP communication with the backend server
- Session-based authentication with cookies
- RESTful API endpoints for employees, time entries, analytics
- Error handling and retry logic

**DataStore**: Centralized data management
- ObservableObject for SwiftUI integration
- Local caching and state management
- Server URL configuration persistence

**ViewModels**: Business logic and state management
- Combine publishers for reactive UI updates
- Error handling and loading states
- Date calculations and formatting

## Setup Instructions

### Prerequisites
- Xcode 15.0 or later
- iOS 17.0 or later
- Running Employee Hour Tracker server

### Installation
1. Open `EmployeeTracker.xcodeproj` in Xcode
2. Select your target device/simulator
3. Build and run the project

### Configuration
1. Launch the app
2. Go to Settings tab
3. Enter your Employee Hour Tracker server URL (e.g., `http://localhost:3000`)
4. The app will immediately start showing read-only data

### Optional Authentication
- Sign in is optional and only needed for data management features
- Default credentials: `admin` / `admin123`
- Authentication enables editing time entries (currently disabled in this version)

## API Integration

The app integrates with the Employee Hour Tracker API:

### Key Endpoints Used
- `GET /api/employees` - Employee list
- `GET /api/time-entries/:weekStart` - Weekly time data  
- `GET /api/analytics/summary` - Overview statistics
- `GET /api/analytics/by-employee` - Per-employee analytics
- `POST /api/login` - Optional authentication

### Data Flow
1. App loads employee data and current week time entries on startup
2. Analytics view fetches summary and per-employee statistics
3. Time tracking view displays weekly grid with status indicators
4. All data refreshes automatically and supports pull-to-refresh

## User Experience

### Primary Use Case: Data Viewing
The app is optimized for viewing and analyzing time tracking data:

1. **Launch Experience**: Opens directly to Analytics/Overview tab
2. **Quick Insights**: Immediately see completion rates and status distribution  
3. **Employee Details**: Drill down to individual employee performance
4. **Historical Data**: Browse different time periods
5. **Mobile Optimized**: Clean, touch-friendly interface

### Secondary Features
- Time tracking grid for detailed weekly view
- Server configuration for connecting to different instances
- Optional authentication for future management features

## Development Notes

### SwiftUI Best Practices
- Uses `@StateObject` and `@ObservableObject` for state management
- Combines framework for reactive programming
- Environment objects for dependency injection
- Native iOS design patterns and HIG compliance

### Error Handling
- Network error recovery with retry mechanisms
- User-friendly error messages
- Graceful degradation when server is unavailable

### Performance Considerations
- Lazy loading for large employee lists
- Efficient data caching and updates
- Minimal API calls with intelligent refresh logic

## Future Enhancements

### Potential Features
- Offline data caching
- Push notifications for missing time entries
- Dark mode support
- iPad optimization
- Data export functionality
- Advanced filtering and search

### Management Features (Optional)
- Add/edit/delete employees (requires authentication)
- Time entry editing (requires authentication)
- Bulk operations
- Administrative settings

## Support

For issues related to:
- **iOS App**: Check Xcode console for errors, verify server URL configuration
- **API/Backend**: Refer to main Employee Hour Tracker documentation
- **Connectivity**: Ensure server is running and accessible from device/simulator

## Version History

**v1.0**: Initial release
- Analytics/Overview dashboard
- Read-only time tracking view  
- Server configuration
- Optional authentication
- SwiftUI iOS 17+ support