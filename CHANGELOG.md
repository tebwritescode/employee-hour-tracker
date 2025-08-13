# Changelog

All notable changes to Employee Hour Tracker are documented here.

## [1.6.7] - 2025-08-13
### Added
- **Configurable Debug Logging**: Environment variable `ENABLE_DEBUG_LOGS=true` to enable/disable debug logging
- **Strategic Debug Points**: Key navigation and timezone troubleshooting logs
- **Client/Server Debug Sync**: Debug settings synchronized between server and client
### Enhanced
- **Troubleshooting**: Easier diagnosis of navigation and timezone issues in production

## [1.6.6] - 2025-08-13
### Fixed
- **CRITICAL**: Multi-timezone data separation bug where users in different timezones saw different data
- **Week Navigation**: Arrow buttons not working on specific client computers
- **Calendar Selection**: Monday date selection inconsistencies on certain workstations
### Added
- **Server-Side Navigation**: All week calculations now performed server-side for 100% consistency
- **Universal Compatibility**: Resolves timezone-related issues across all client environments
### UPGRADE NOTICE
- **⚠️ IMPORTANT**: This version fixes critical timezone bugs. Users on v1.6.5 and earlier should upgrade immediately.

## [1.6.5] - 2025-08-13
### Fixed
- **Navigation Issues**: Improved week navigation consistency
- **Client Compatibility**: Enhanced browser compatibility for date calculations
### UPGRADE NOTICE
- **⚠️ TIMEZONE ISSUES PRESENT**: This version still contains timezone bugs. **Upgrade to v1.6.6 or later immediately**.

## [1.6.4] - 2025-08-13
### Enhanced
- **Docker Deployment**: Improved version management and deployment consistency
- **Production Builds**: Enhanced build process for version tracking
### UPGRADE NOTICE
- **⚠️ TIMEZONE ISSUES PRESENT**: This version contains timezone bugs. **Upgrade to v1.6.6 or later immediately**.

## [1.6.3] - 2025-08-13
### Added
- **Global Timezone Setting**: Application-wide timezone configuration (defaulted to Eastern Time)
- **Timezone Migration**: Database migration v1.6.3 for timezone consistency
### Fixed
- **Initial Timezone Fix**: Attempted resolution of multi-timezone data separation
### UPGRADE NOTICE
- **⚠️ INCOMPLETE FIX**: This version's timezone fix was incomplete. **Upgrade to v1.6.6 or later for complete resolution**.

## [1.6.2] - 2025-08-13
### Enhanced
- **Version Management**: Improved version tracking and deployment processes
### UPGRADE NOTICE
- **⚠️ TIMEZONE ISSUES PRESENT**: This version contains timezone bugs. **Upgrade to v1.6.6 or later immediately**.

## [1.6.1] - 2025-08-13
### Enhanced
- **Bug Investigation**: Added comprehensive debugging tools for timezone issue diagnosis
### UPGRADE NOTICE
- **⚠️ TIMEZONE ISSUES PRESENT**: This version contains timezone bugs. **Upgrade to v1.6.6 or later immediately**.

## [1.6.0] - 2025-08-12
### Added
- **Complete API Platform**:
  - API Token authentication system for external integrations
  - Secure token generation with configurable expiration dates
  - Token management interface in web UI
  - Interactive API documentation page at `/api-docs`
  - Real-time API endpoint testing interface
  - Comprehensive API reference with examples
- **Advanced Rate Limiting**:
  - Intelligent rate limiting based on authentication status
  - 100 requests/minute for unauthenticated users
  - 1000 requests/minute for API token holders
  - Stricter limits (5/15min) for authentication endpoints
  - Rate limit headers for client optimization
- **RESTful API Coverage**:
  - Complete employee management via API
  - Time entry operations with validation
  - Analytics and reporting endpoints
  - Data export in multiple formats (CSV, JSON, Excel)
  - Settings management API
  - Danger zone operations for data management
### Enhanced
- **Database Architecture**: New api_tokens table with migration system
- **Security**: Multi-layer authentication (session + token based)
- **Documentation**: Complete API documentation with interactive testing

## [1.5.3] - 2025-08-12
### Added
- **Automatic Session & Cache Management**:
  - Version-based cache invalidation system
  - Automatically clears browser cache and sessions on version updates
  - Works retroactively for existing sessions from older versions
  - Session version tracking on server side
  - Client-side version detection and automatic refresh
  - Prevents stale data issues after deployments

## [1.5.2] - 2025-08-12
### Added
- **Comprehensive Database Migration System**:
  - Automatic migration checks on server startup
  - Migration tracking table to prevent duplicate runs
  - Support for seamless upgrades from any version
  - Safe migration execution with error handling
### Changed
- **Include Empty Button**: Improved styling to match other UI buttons
- **Button Text**: Simplified to "Include Empty" for clarity
### Fixed
- **Analytics Filtering**: Works correctly with both preset and custom date ranges

## [1.5.1] - 2025-08-12
### Added
- **Include All Employees Option**: Checkbox in analytics to show/hide employees with no entries
  - Checked by default for comprehensive view
  - Shows all employees when checked, only active employees when unchecked
- **Analytics Flexibility**: Choose between viewing all employees or only those with data

## [1.5.0] - 2025-08-12
### Fixed
- **Analytics Calculations**: 
  - Employee count now correctly shows only employees with entries in the selected date range
  - Fixed query joins to properly filter data by date range
  - Added COALESCE to prevent NULL values in calculations
  - Fixed "Last Week" preset to show previous Monday-Sunday (not last 7 days)
### Enhanced
- **Analytics Display**:
  - Moved percentage calculations to pie chart labels
  - Clean count display in summary statistics
  - Improved data visualization with percentages in chart
### Added
- **Comprehensive Test Data**:
  - Added test data generation script for 12 weeks of data
  - 8 test employees with realistic status distributions
  - Enables thorough testing of analytics across various date ranges

## [1.4.2] - 2025-08-12
### Fixed
- **Share Functionality**: Resolved issue where share buttons weren't copying links
- **Error Handling**: Added better fallback for clipboard operations
- **Debugging**: Added console logging for troubleshooting share issues

## [1.4.1] - 2025-08-12
### Added
- **BASE_URL Configuration**: Environment variable to set custom domain for share links
- **Proper HTTPS URLs**: Share links now use configured domain instead of IP addresses
- **Version Centralization**: Version number now only needs updating in package.json

## [1.4.0] - 2025-08-12
### Added
- **URL Parameter Support**: Navigate directly to specific date ranges via URL parameters
  - Tracker: `?week=2025-01-06` or `?range=lastweek`
  - Analytics: `?range=lastmonth`, `?range=last90days`, or `?start=2025-01-01&end=2025-01-31`
- **Share Functionality**: New share buttons on tracker and analytics pages
  - Native mobile share support
  - Automatic clipboard fallback for desktop
  - Generates shareable URLs with current view parameters

## [1.3.0] - 2025-08-11
### Fixed
- **Cache Issues**: Resolved data persistence when changing weeks
### Enhanced
- **Documentation**: Added version increment rules and testing requirements to CLAUDE.md
- **Development Workflow**: Established testing protocols before marking features complete

## [1.2.0] - 2025-08-11
### Added
- **Live Updates**: Real-time synchronization across browsers - changes appear automatically
- **Version Display**: Application version shown in server logs and UI footer
- **Auto-refresh**: Time tracking page refreshes every 5 seconds for live updates
### Fixed
- **Week Navigation**: Fixed date picker showing Tuesday instead of Monday
- **Data Loading**: Enhanced week-to-week data persistence and loading

## [1.1.1] - 2025-08-11
### Fixed
- Website link text in management section footer

## [1.1.0] - 2025-08-11
### Added
- **Empty Status**: New default "Empty" status (grey) for untracked time entries
- **Status Cycle**: Empty → Not Entered → Entered → Incorrect
- **Database Migration**: Automatic migration preserves all existing data
### Changed
- "Not Entered" status (red) is now specifically for explicitly marked non-entries

## [1.0.0] - 2025-08-08
### Initial Release
- Interactive weekly grid interface for tracking employee time entries
- Analytics dashboard with Chart.js visualizations
- Employee management with CRUD operations
- Multiple export formats (Excel, JSON, CSV)
- Automated database backups
- Session-based authentication
- Docker support with multi-architecture images