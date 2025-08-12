# Changelog

All notable changes to Employee Hour Tracker are documented here.

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