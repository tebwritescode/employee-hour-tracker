class EmployeeTracker {
    constructor() {
        // Global application timezone - will be loaded from server settings
        this.appTimezone = 'America/New_York'; // Default to Eastern Time
        
        // EMERGENCY TIMEZONE DIAGNOSTIC - Log client info immediately
        this.logClientTimezoneInfo();
        
        this.currentWeekStart = this.getWeekStart(new Date());
        this.employees = [];
        this.timeEntries = [];
        this.isAuthenticated = false;
        this.currentDateRange = { start: null, end: null, preset: 'week' };
        this.autoRefreshInterval = null;
        this.isUpdating = false;
        this.currentSection = 'time-tracking';
        this.baseUrl = null; // Will be loaded from server config
        this.includeAllEmployees = true; // Default to including all employees
        
        this.init();
    }
    
    async init() {
        // Check version first to handle any necessary refreshes
        await this.loadVersion();
        
        this.setupEventListeners();
        this.handleDirectRouting();
        this.parseURLParameters();
        await this.loadConfig();
        await this.loadTimezoneSettings();
        await this.loadDefaultWeekSetting();
        this.updateWeekDisplay();
        // Load employees first, then time entries to ensure proper rendering
        await this.loadEmployees();
        await this.loadTimeEntries();
        this.checkAuthentication();
        this.startAutoRefresh();
    }
    
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                this.baseUrl = config.baseUrl;
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }
    
    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const range = urlParams.get('range');
        const week = urlParams.get('week');
        const start = urlParams.get('start');
        const end = urlParams.get('end');
        
        if (range) {
            // Handle preset ranges like ?range=lastweek, ?range=lastmonth, ?range=last90days
            if (range === 'lastweek') {
                const lastWeek = new Date();
                lastWeek.setDate(lastWeek.getDate() - 7);
                this.currentWeekStart = this.getWeekStart(lastWeek);
                if (window.location.pathname.includes('analytics')) {
                    this.setDatePreset('week');
                }
            } else if (range === 'lastmonth') {
                if (window.location.pathname.includes('analytics')) {
                    this.setDatePreset('month');
                } else {
                    // For tracker, go to 4 weeks ago
                    const fourWeeksAgo = new Date();
                    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
                    this.currentWeekStart = this.getWeekStart(fourWeeksAgo);
                }
            } else if (range === 'last90days' && window.location.pathname.includes('analytics')) {
                this.setDatePreset('90days');
            }
        } else if (week) {
            // Handle specific week for tracker like ?week=2025-01-06
            const weekDate = new Date(week + 'T00:00:00');
            if (!isNaN(weekDate.getTime())) {
                this.currentWeekStart = this.getWeekStart(weekDate);
            }
        } else if (start && end) {
            // Handle custom date range like ?start=2025-01-01&end=2025-01-31
            if (window.location.pathname.includes('analytics')) {
                this.currentDateRange.start = start;
                this.currentDateRange.end = end;
                this.currentDateRange.preset = 'custom';
                // Set the custom date inputs
                setTimeout(() => {
                    const startInput = document.getElementById('start-date');
                    const endInput = document.getElementById('end-date');
                    if (startInput && endInput) {
                        startInput.value = start;
                        endInput.value = end;
                        this.setDatePreset('custom');
                        this.applyCustomDateRange();
                    }
                }, 100);
            }
        }
    }
    
    generateShareURL() {
        // Use configured BASE_URL if available, otherwise use current origin
        const origin = this.baseUrl || window.location.origin;
        const pathname = window.location.pathname;
        const baseURL = origin + pathname;
        const params = new URLSearchParams();
        
        if (this.currentSection === 'time-tracking') {
            // For tracker page, share the current week
            params.append('week', this.currentWeekStart);
        } else if (this.currentSection === 'analytics') {
            // For analytics page, share the current date range
            if (this.currentDateRange.preset === 'custom' && this.currentDateRange.start && this.currentDateRange.end) {
                params.append('start', this.currentDateRange.start);
                params.append('end', this.currentDateRange.end);
            } else if (this.currentDateRange.preset === 'week') {
                params.append('range', 'lastweek');
            } else if (this.currentDateRange.preset === 'month') {
                params.append('range', 'lastmonth');
            } else if (this.currentDateRange.preset === '90days') {
                params.append('range', 'last90days');
            }
        }
        
        return params.toString() ? `${baseURL}?${params.toString()}` : baseURL;
    }
    
    async shareCurrentView() {
        try {
            const shareURL = this.generateShareURL();
            console.log('Generated share URL:', shareURL);
            
            if (navigator.share && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // Use native share API if available (mobile)
                try {
                    await navigator.share({
                        title: 'Employee Hour Tracker',
                        text: `View ${this.currentSection === 'time-tracking' ? 'time tracking' : 'analytics'} data`,
                        url: shareURL
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        this.copyToClipboard(shareURL);
                    }
                }
            } else {
                // Fall back to copying to clipboard
                this.copyToClipboard(shareURL);
            }
        } catch (error) {
            console.error('Error in shareCurrentView:', error);
            this.showShareToast('Error generating share link');
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                this.showShareToast('Link copied to clipboard!');
            }).catch((err) => {
                console.error('Clipboard API failed:', err);
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            this.showShareToast('Link copied to clipboard!');
        } catch (err) {
            this.showShareToast('Failed to copy link');
        }
        document.body.removeChild(textArea);
    }
    
    showShareToast(message) {
        // Remove any existing toast
        const existingToast = document.querySelector('.share-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    startAutoRefresh() {
        // Refresh every 5 seconds to show live updates
        this.autoRefreshInterval = setInterval(() => {
            if (!this.isUpdating && this.currentSection === 'time-tracking') {
                this.refreshTimeEntries();
            }
        }, 5000);
    }
    
    async refreshTimeEntries() {
        // Only refresh if we're not currently updating
        if (this.isUpdating) return;
        
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/time-entries/${this.currentWeekStart}?t=${timestamp}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (response.ok) {
                const newEntries = await response.json();
                
                // Only update if data has changed
                if (JSON.stringify(newEntries) !== JSON.stringify(this.timeEntries)) {
                    this.timeEntries = newEntries;
                    this.renderTimeGrid();
                }
            }
        } catch (error) {
            console.error('Error refreshing time entries:', error);
        }
    }
    
    setupEventListeners() {
        document.getElementById('time-tracking-tab').addEventListener('click', () => this.showSection('time-tracking'));
        document.getElementById('analytics-tab').addEventListener('click', () => this.showSection('analytics'));
        document.getElementById('management-tab').addEventListener('click', () => this.showSection('management'));
        
        document.getElementById('prev-week').addEventListener('click', () => this.changeWeek(-1));
        document.getElementById('next-week').addEventListener('click', () => this.changeWeek(1));
        document.getElementById('week-picker').addEventListener('change', (e) => this.setWeek(e.target.value));
        
        // Add share button listeners with safety checks
        const shareTracker = document.getElementById('share-tracker');
        const shareAnalytics = document.getElementById('share-analytics');
        
        if (shareTracker) {
            shareTracker.addEventListener('click', () => {
                console.log('Share tracker button clicked');
                this.shareCurrentView();
            });
        }
        
        if (shareAnalytics) {
            shareAnalytics.addEventListener('click', () => {
                console.log('Share analytics button clicked');
                this.shareCurrentView();
            });
        }
        
        document.getElementById('auth-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('add-employee-form').addEventListener('submit', (e) => this.handleAddEmployee(e));
        document.getElementById('change-credentials-form').addEventListener('submit', (e) => this.handleChangeCredentials(e));
        document.getElementById('save-week-setting').addEventListener('click', () => this.saveWeekSetting());
        document.getElementById('save-timezone-setting').addEventListener('click', () => this.saveTimezoneSetting());
        
        document.getElementById('export-csv').addEventListener('click', () => this.exportData('csv'));
        document.getElementById('export-json').addEventListener('click', () => this.exportData('json'));
        
        document.getElementById('preset-week').addEventListener('click', () => this.setDatePreset('week'));
        document.getElementById('preset-month').addEventListener('click', () => this.setDatePreset('month'));
        document.getElementById('preset-90days').addEventListener('click', () => this.setDatePreset('90days'));
        document.getElementById('preset-custom').addEventListener('click', () => this.setDatePreset('custom'));
        document.getElementById('apply-date-range').addEventListener('click', () => this.applyCustomDateRange());
        
        // Add listener for include empty button toggle
        const toggleIncludeBtn = document.getElementById('toggle-include-empty');
        if (toggleIncludeBtn) {
            toggleIncludeBtn.addEventListener('click', () => this.toggleIncludeEmpty());
        }
        
        document.getElementById('delete-confirmation').addEventListener('input', (e) => this.handleDeleteConfirmationInput(e));
        document.getElementById('delete-all-data-btn').addEventListener('click', () => this.handleDeleteAllData());
        
        document.getElementById('clear-analytics-confirmation').addEventListener('input', (e) => this.handleClearAnalyticsConfirmationInput(e));
        document.getElementById('clear-analytics-btn').addEventListener('click', () => this.handleClearAnalyticsData());
        
        document.getElementById('clear-employees-confirmation').addEventListener('input', (e) => this.handleClearEmployeesConfirmationInput(e));
        document.getElementById('clear-employees-btn').addEventListener('click', () => this.handleClearEmployeesData());
        
        document.getElementById('clear-period-confirmation').addEventListener('input', (e) => this.handleClearPeriodConfirmationInput(e));
        document.getElementById('clear-period-btn').addEventListener('click', () => this.handleClearPeriodData());
        
        // API Token management event listeners
        document.getElementById('create-token-form').addEventListener('submit', (e) => this.handleCreateToken(e));
        document.getElementById('copy-token-btn').addEventListener('click', () => this.copyGeneratedToken());
        document.getElementById('copy-docs-url').addEventListener('click', () => this.copyDocsUrl());
        
        // Use event delegation for revoke buttons since they're dynamically added
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('revoke-token-btn')) {
                const tokenId = e.target.getAttribute('data-token-id');
                const tokenName = e.target.getAttribute('data-token-name');
                this.revokeToken(tokenId, tokenName);
            }
        });
        
        // API Rate Limit management event listeners
        document.getElementById('save-unauthenticated-limit').addEventListener('click', () => {
            this.saveApiRateLimitSetting('api_rate_limit_unauthenticated_per_minute', 'api-limit-unauthenticated', 'save-unauthenticated-limit');
        });
        document.getElementById('save-authenticated-limit').addEventListener('click', () => {
            this.saveApiRateLimitSetting('api_rate_limit_authenticated_per_minute', 'api-limit-authenticated', 'save-authenticated-limit');
        });
        document.getElementById('save-window-limit').addEventListener('click', () => {
            this.saveApiRateLimitSetting('api_rate_limit_window_minutes', 'api-limit-window', 'save-window-limit');
        });
        
        // Handle browser back/forward navigation
        window.addEventListener('popstate', () => this.handleDirectRouting());
    }
    
    handleDirectRouting() {
        const path = window.location.pathname;
        switch (path) {
            case '/analytics':
                this.showSection('analytics');
                break;
            case '/management':
                this.showSection('management');
                break;
            case '/tracking':
                this.showSection('time-tracking');
                break;
            default:
                this.showSection('time-tracking');
        }
    }
    
    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`${sectionName}-section`).classList.add('active');
        document.getElementById(`${sectionName}-tab`).classList.add('active');
        
        this.currentSection = sectionName;
        
        // Update URL without page reload
        const path = sectionName === 'time-tracking' ? '/' : `/${sectionName}`;
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
        
        // Refresh data when switching to different sections
        if (sectionName === 'time-tracking') {
            this.loadTimeEntries();
        }
        
        if (sectionName === 'analytics') {
            this.initializeDateRange();
            this.loadAnalytics();
        }
        
        if (sectionName === 'management') {
            this.loadCurrentSettings();
            if (this.isAuthenticated) {
                this.loadEmployees();
            }
        }
    }
    
    getWeekStart(date) {
        // DEBUG LOGGING for timezone issues
        const appTimezone = this.appTimezone || 'America/New_York';
        const d = new Date(date);
        
        console.log('🐛 DEBUG - getWeekStart called:');
        console.log('  Input date:', date);
        console.log('  Input date ISO:', d.toISOString());
        console.log('  App timezone:', appTimezone);
        console.log('  User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        console.log('  User locale time:', d.toLocaleString());
        
        // Create date in application timezone
        const localDate = new Date(d.toLocaleString("en-US", {timeZone: appTimezone}));
        const day = localDate.getDay();
        
        console.log('  Date in app timezone:', localDate.toLocaleString());
        console.log('  Day of week:', day, '(0=Sun, 1=Mon, 2=Tue...)');
        
        // Convert Sunday (0) to 7 to make Monday (1) the start of week
        const adjustedDay = day === 0 ? 7 : day;
        const diff = adjustedDay - 1; // Days since Monday
        
        console.log('  Adjusted day:', adjustedDay);
        console.log('  Days to subtract:', diff);
        
        // Create a new date object to avoid modifying the original
        const monday = new Date(localDate);
        monday.setDate(localDate.getDate() - diff);
        
        // Format as YYYY-MM-DD in application timezone
        const year = monday.getFullYear();
        const month = String(monday.getMonth() + 1).padStart(2, '0');
        const day_str = String(monday.getDate()).padStart(2, '0');
        
        const result = `${year}-${month}-${day_str}`;
        console.log('  Monday (week start):', monday.toLocaleString());
        console.log('  Result week_start:', result);
        console.log('🐛 DEBUG - getWeekStart complete\n');
        
        return result;
    }
    
    // EMERGENCY CLIENT DIAGNOSTIC FUNCTION
    logClientTimezoneInfo() {
        const now = new Date();
        console.log('\n🚨 EMERGENCY CLIENT DIAGNOSTIC 🚨');
        console.log('=================================');
        console.log('Current time:', now.toString());
        console.log('UTC time:', now.toUTCString());
        console.log('ISO time:', now.toISOString());
        console.log('Client timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        console.log('Timezone offset (minutes):', now.getTimezoneOffset());
        console.log('Browser locale:', navigator.language || 'unknown');
        console.log('User agent:', navigator.userAgent);
        console.log('Screen resolution:', `${screen.width}x${screen.height}`);
        
        // Test date parsing with different methods
        const testDateStr = '2025-08-12T00:00:00';
        console.log('\nTesting date parsing:');
        console.log('Input: "2025-08-12T00:00:00"');
        console.log('new Date("2025-08-12T00:00:00"):', new Date(testDateStr).toString());
        console.log('toLocaleString with app timezone:', new Date(testDateStr).toLocaleString("en-US", {timeZone: this.appTimezone}));
        console.log('getDay() result:', new Date(testDateStr).getDay());
        
        // Show what getWeekStart would produce right now
        const weekStart = this.getWeekStart(now);
        console.log('\nCurrent week start calculation:');
        console.log('Result:', weekStart);
        console.log('=================================\n');
        
        // Also send this info to the server for logging
        this.sendDiagnosticData({
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: now.getTimezoneOffset(),
            userAgent: navigator.userAgent.substring(0, 100),
            currentWeekStart: weekStart,
            testResults: {
                inputTime: testDateStr,
                parsedTime: new Date(testDateStr).toString(),
                getDay: new Date(testDateStr).getDay(),
                appTimezoneConversion: new Date(testDateStr).toLocaleString("en-US", {timeZone: this.appTimezone})
            }
        });
    }
    
    async sendDiagnosticData(data) {
        try {
            await fetch('/api/debug/client-info', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.log('Could not send diagnostic data to server:', error.message);
        }
    }
    
    // Helper function to format any date in the application timezone
    formatDateInAppTimezone(date) {
        const appTimezone = this.appTimezone || 'America/New_York';
        const localDate = new Date(date.toLocaleString("en-US", {timeZone: appTimezone}));
        
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    updateWeekDisplay() {
        // Add time component to ensure correct local date parsing
        const startDate = new Date(this.currentWeekStart + 'T00:00:00');
        const endDate = new Date(this.currentWeekStart + 'T00:00:00');
        endDate.setDate(startDate.getDate() + 6);
        
        const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        document.getElementById('week-display').textContent = 
            `${formatDate(startDate)} - ${formatDate(endDate)}, ${startDate.getFullYear()}`;
        
        document.getElementById('week-picker').value = this.currentWeekStart;
    }
    
    changeWeek(direction) {
        // Parse the current week start and add/subtract 7 days
        const currentDate = new Date(this.currentWeekStart + 'T00:00:00');
        currentDate.setDate(currentDate.getDate() + (direction * 7));
        this.currentWeekStart = this.getWeekStart(currentDate);
        this.updateWeekDisplay();
        this.loadTimeEntries();
    }
    
    setWeek(dateString) {
        // Ensure proper date parsing by adding time component
        const selectedDate = new Date(dateString + 'T00:00:00');
        this.currentWeekStart = this.getWeekStart(selectedDate);
        this.updateWeekDisplay();
        this.loadTimeEntries();
    }
    
    async loadEmployees() {
        try {
            const response = await fetch('/api/employees', {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            this.employees = await response.json();
            // Don't render time grid here - let loadTimeEntries handle it
            // to ensure we always have the correct week's data
            this.renderEmployeesList();
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }
    
    async loadTimeEntries() {
        try {
            // Clear existing time entries to ensure fresh data
            this.timeEntries = [];
            
            console.log('🐛 DEBUG - loadTimeEntries called:');
            console.log('  Current week start:', this.currentWeekStart);
            console.log('  App timezone:', this.appTimezone);
            console.log('  User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
            console.log('  Request URL will be: /api/time-entries/' + this.currentWeekStart);
            
            // Add timestamp to URL to prevent caching
            const timestamp = new Date().getTime();
            const requestUrl = `/api/time-entries/${this.currentWeekStart}?t=${timestamp}`;
            console.log('  Full request URL:', requestUrl);
            
            const response = await fetch(requestUrl, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            console.log('  Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.timeEntries = await response.json();
            console.log('  Loaded', this.timeEntries.length, 'time entries:');
            this.timeEntries.forEach((entry, i) => {
                console.log(`    [${i}] ${entry.name} - week_start: ${entry.week_start || 'undefined'}`);
            });
            console.log('🐛 DEBUG - loadTimeEntries complete\n');
            this.renderTimeGrid();
        } catch (error) {
            console.error('Error loading time entries:', error);
            this.timeEntries = [];
            this.renderTimeGrid(); // Still render empty grid
        }
    }
    
    renderTimeGrid() {
        const tbody = document.getElementById('time-grid-body');
        tbody.innerHTML = '';
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        // Always render based on time entries which includes all employees
        // The API returns all employees with their time entries via LEFT JOIN
        if (!this.timeEntries || this.timeEntries.length === 0) {
            // Show helpful message for empty database
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'empty-state-message';
            cell.style.textAlign = 'center';
            cell.style.padding = '2rem';
            cell.style.color = '#666';
            cell.innerHTML = `
                <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">No employees found</div>
                <div style="font-size: 0.9rem;">Add employees in the Management section to get started</div>
            `;
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }
        
        this.timeEntries.forEach(entry => {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.className = 'employee-name';
            nameCell.textContent = entry.name;
            row.appendChild(nameCell);
            
            days.forEach(day => {
                const cell = document.createElement('td');
                cell.className = 'status-cell';
                
                const button = document.createElement('button');
                button.className = `status-btn status-${entry[day].toLowerCase().replace(' ', '-')}`;
                button.textContent = entry[day];
                button.addEventListener('click', () => this.cycleStatus(entry.id, day, button));
                
                // Add visual indicator for authentication requirement
                if (!this.isAuthenticated) {
                    button.classList.add('requires-auth');
                    button.title = 'Login required to modify time entries';
                }
                
                cell.appendChild(button);
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
    }
    
    updateTimeGridButtons() {
        const buttons = document.querySelectorAll('.status-btn');
        buttons.forEach(button => {
            if (!this.isAuthenticated) {
                button.classList.add('requires-auth');
                button.title = 'Login required to modify time entries';
            } else {
                button.classList.remove('requires-auth');
                button.title = '';
            }
        });
    }
    
    async cycleStatus(employeeId, day, button) {
        // Check if user is authenticated before allowing changes
        if (!this.isAuthenticated) {
            alert('You must be logged in to modify time entries. Please log in through the Management section.');
            return;
        }
        
        // Prevent updates while one is in progress
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        const statuses = ['Empty', 'Not Entered', 'Entered', 'Incorrect'];
        const currentStatus = button.textContent;
        const currentIndex = statuses.indexOf(currentStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        
        const requestBody = {
            employeeId,
            weekStart: this.currentWeekStart,
            day,
            status: nextStatus
        };
        
        console.log('🐛 DEBUG - cycleStatus updating:');
        console.log('  Employee ID:', employeeId);
        console.log('  Week start:', this.currentWeekStart);
        console.log('  Day:', day);
        console.log('  Current status:', currentStatus);
        console.log('  Next status:', nextStatus);
        console.log('  Full request body:', requestBody);
        console.log('  App timezone:', this.appTimezone);
        console.log('  User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        
        try {
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                credentials: 'include'
            });
            
            console.log('  Update response status:', response.status);
            
            if (response.ok) {
                button.textContent = nextStatus;
                button.className = `status-btn status-${nextStatus.toLowerCase().replace(' ', '-')}`;
            } else if (response.status === 401) {
                alert('Your session has expired. Please log in again through the Management section.');
                this.isAuthenticated = false;
                this.updateTimeGridButtons();
            } else {
                const data = await response.json();
                alert(data.error || 'Error updating time entry');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error updating time entry');
        } finally {
            this.isUpdating = false;
        }
    }
    
    async checkAuthentication() {
        try {
            const response = await fetch('/api/check-auth', {
                credentials: 'include'
            });
            const data = await response.json();
            this.isAuthenticated = data.authenticated;
            this.updateManagementUI();
            this.updateTimeGridButtons();
            
            // Load API tokens if authenticated
            if (this.isAuthenticated) {
                this.loadApiTokens();
            }
        } catch (error) {
            console.error('Error checking authentication:', error);
        }
    }
    
    updateManagementUI() {
        const loginForm = document.getElementById('login-form');
        const managementContent = document.getElementById('management-content');
        
        if (this.isAuthenticated) {
            loginForm.style.display = 'none';
            managementContent.style.display = 'block';
            this.loadEmployees();
            this.loadApiTokens();
            this.loadApiRateLimits();
        } else {
            loginForm.style.display = 'block';
            managementContent.style.display = 'none';
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('login-error');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            if (response.ok) {
                this.isAuthenticated = true;
                this.updateManagementUI();
                this.updateTimeGridButtons();
                errorDiv.textContent = '';
            } else {
                const data = await response.json();
                errorDiv.textContent = data.error || 'Login failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Login failed';
            console.error('Login error:', error);
        }
    }
    
    async handleLogout() {
        try {
            await fetch('/api/logout', { 
                method: 'POST',
                credentials: 'include'
            });
            this.isAuthenticated = false;
            this.updateManagementUI();
            this.updateTimeGridButtons();
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    async handleAddEmployee(e) {
        e.preventDefault();
        const name = document.getElementById('employee-name').value.trim();
        
        if (!name) return;
        
        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
                credentials: 'include'
            });
            
            if (response.ok) {
                document.getElementById('employee-name').value = '';
                this.loadEmployees();
                this.loadTimeEntries(); // Refresh time entries to include new employee
            } else {
                const data = await response.json();
                alert(data.error || 'Error adding employee');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('Error adding employee');
        }
    }
    
    async handleChangeCredentials(e) {
        e.preventDefault();
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const messageDiv = document.getElementById('credential-message');
        
        messageDiv.textContent = '';
        messageDiv.className = 'message';
        
        if (!username || !password || !confirmPassword) {
            messageDiv.textContent = 'All fields are required';
            messageDiv.className = 'message error';
            return;
        }
        
        if (password !== confirmPassword) {
            messageDiv.textContent = 'Passwords do not match';
            messageDiv.className = 'message error';
            return;
        }
        
        if (password.length < 6) {
            messageDiv.textContent = 'Password must be at least 6 characters long';
            messageDiv.className = 'message error';
            return;
        }
        
        try {
            const response = await fetch('/api/change-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageDiv.textContent = data.message || 'Credentials updated successfully';
                messageDiv.className = 'message success';
                document.getElementById('new-username').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            } else {
                messageDiv.textContent = data.error || 'Error updating credentials';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error updating credentials:', error);
            messageDiv.textContent = 'Error updating credentials';
            messageDiv.className = 'message error';
        }
    }
    
    async deleteEmployee(id, name) {
        if (!confirm(`Are you sure you want to delete ${name}? This will also delete all their time entries.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/employees/${id}`, { 
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) {
                this.loadEmployees();
                this.loadTimeEntries(); // Refresh time entries after employee deletion
            } else {
                alert('Error deleting employee');
            }
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Error deleting employee');
        }
    }
    
    async editEmployee(id, currentName) {
        const newName = prompt('Enter new employee name:', currentName);
        if (!newName || newName.trim() === '' || newName.trim() === currentName) {
            return;
        }
        
        try {
            const response = await fetch(`/api/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
                credentials: 'include'
            });
            
            if (response.ok) {
                this.loadEmployees();
                this.loadTimeEntries(); // Refresh time entries to show updated name
            } else {
                const data = await response.json();
                alert(data.error || 'Error updating employee name');
            }
        } catch (error) {
            console.error('Error updating employee:', error);
            alert('Error updating employee name');
        }
    }
    
    renderEmployeesList() {
        const container = document.getElementById('employees-container');
        container.innerHTML = '';
        
        if (this.employees.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state-message';
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.padding = '2rem';
            emptyDiv.style.color = '#666';
            emptyDiv.innerHTML = `
                <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">No employees yet</div>
                <div style="font-size: 0.9rem;">Use the form above to add your first employee</div>
            `;
            container.appendChild(emptyDiv);
            return;
        }
        
        this.employees.forEach(employee => {
            const div = document.createElement('div');
            div.className = 'employee-item';
            
            const span = document.createElement('span');
            span.textContent = employee.name;
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'employee-buttons';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => this.editEmployee(employee.id, employee.name));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => this.deleteEmployee(employee.id, employee.name));
            
            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(deleteBtn);
            
            div.appendChild(span);
            div.appendChild(buttonGroup);
            container.appendChild(div);
        });
    }
    
    renderSummaryStats(summary) {
        document.getElementById('total-employees').textContent = summary.total_employees || 0;
        document.getElementById('total-weeks').textContent = summary.total_weeks || 0;
        document.getElementById('total-empty').textContent = summary.total_empty || 0;
        document.getElementById('total-not-entered').textContent = summary.total_not_entered || 0;
        document.getElementById('total-entered').textContent = summary.total_entered || 0;
        document.getElementById('total-incorrect').textContent = summary.total_incorrect || 0;
    }
    
    renderCharts(summary, employeeData) {
        this.renderOverallChart(summary);
        this.renderEmployeeChart(employeeData);
    }
    
    renderOverallChart(summary) {
        const ctx = document.getElementById('overall-chart').getContext('2d');
        
        if (this.overallChart) {
            this.overallChart.destroy();
        }
        
        // Calculate total and percentages
        const values = [
            summary.total_empty || 0,
            summary.total_not_entered || 0,
            summary.total_entered || 0,
            summary.total_incorrect || 0
        ];
        const total = values.reduce((sum, val) => sum + val, 0);
        
        // Create labels with percentages
        const labels = [
            'Empty',
            'Not Entered',
            'Entered',
            'Incorrect'
        ].map((label, i) => {
            const percentage = total > 0 ? ((values[i] / total) * 100).toFixed(1) : 0;
            return `${label} (${percentage}%)`;
        });
        
        this.overallChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#6c757d', '#dc3545', '#28a745', '#fd7e14'],
                    borderWidth: 3,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: { size: 14 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${value} entries (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderEmployeeChart(employeeData) {
        const ctx = document.getElementById('employee-chart').getContext('2d');
        
        if (this.employeeChart) {
            this.employeeChart.destroy();
        }
        
        const labels = employeeData.map(emp => emp.name);
        const emptyData = employeeData.map(emp => emp.empty || 0);
        const notEnteredData = employeeData.map(emp => emp.not_entered || 0);
        const enteredData = employeeData.map(emp => emp.entered || 0);
        const incorrectData = employeeData.map(emp => emp.incorrect || 0);
        
        this.employeeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Empty',
                        data: emptyData,
                        backgroundColor: '#6c757d',
                        borderWidth: 1
                    },
                    {
                        label: 'Not Entered',
                        data: notEnteredData,
                        backgroundColor: '#dc3545',
                        borderWidth: 1
                    },
                    {
                        label: 'Entered',
                        data: enteredData,
                        backgroundColor: '#28a745',
                        borderWidth: 1
                    },
                    {
                        label: 'Incorrect',
                        data: incorrectData,
                        backgroundColor: '#fd7e14',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    x: {
                        ticks: { maxRotation: 45 }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 20,
                            font: { size: 14 }
                        }
                    }
                }
            }
        });
    }
    
    async exportData(format) {
        try {
            // Build query params with current date range if available
            const queryParams = this.currentDateRange && this.currentDateRange.start && this.currentDateRange.end 
                ? `?startDate=${this.currentDateRange.start}&endDate=${this.currentDateRange.end}`
                : '';
                
            const response = await fetch(`/api/export/${format}${queryParams}`);
            
            if (format === 'csv') {
                const csvData = await response.text();
                const blob = new Blob([csvData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'employee_time_data.csv';
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const jsonData = await response.json();
                const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'employee_time_data.json';
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data');
        }
    }
    
    initializeDateRange() {
        this.setDatePreset('week');
    }
    
    setDatePreset(preset) {
        document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`preset-${preset}`).classList.add('active');
        
        const today = new Date();
        let startDate, endDate;
        
        switch (preset) {
            case 'week':
                // Get the previous full week (Monday to Sunday)
                const currentWeekStart = this.getWeekStart(today);
                startDate = new Date(currentWeekStart);
                startDate.setDate(startDate.getDate() - 7); // Go to previous Monday
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6); // Go to that week's Sunday
                break;
            case 'month':
                // Last 30 days
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 30);
                endDate = new Date(today);
                break;
            case '90days':
                // Last 90 days
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 90);
                endDate = new Date(today);
                break;
            case 'custom':
                document.getElementById('custom-date-range').style.display = 'flex';
                return;
        }
        
        document.getElementById('custom-date-range').style.display = 'none';
        
        this.currentDateRange = { 
            start: this.formatDateInAppTimezone(startDate), 
            end: this.formatDateInAppTimezone(endDate), 
            preset 
        };
        
        this.loadAnalytics();
    }
    
    applyCustomDateRange() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('Start date must be before end date');
            return;
        }
        
        this.currentDateRange = { start: startDate, end: endDate, preset: 'custom' };
        this.loadAnalytics();
    }
    
    toggleIncludeEmpty() {
        this.includeAllEmployees = !this.includeAllEmployees;
        const btn = document.getElementById('toggle-include-empty');
        const icon = document.getElementById('include-empty-icon');
        
        if (this.includeAllEmployees) {
            btn.classList.add('active');
            icon.textContent = '✓';
        } else {
            btn.classList.remove('active');
            icon.textContent = '';
        }
        
        this.loadAnalytics();
    }
    
    async loadAnalytics() {
        try {
            // Use the stored includeAllEmployees state
            const includeAll = this.includeAllEmployees;
            
            let queryParams = this.currentDateRange.start && this.currentDateRange.end 
                ? `?startDate=${this.currentDateRange.start}&endDate=${this.currentDateRange.end}`
                : '?';
            
            // Add includeAll parameter
            if (queryParams === '?') {
                queryParams += `includeAll=${includeAll}`;
            } else {
                queryParams += `&includeAll=${includeAll}`;
            }
                
            console.log('Loading analytics with params:', queryParams);
            
            const cacheHeaders = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            
            const [summaryResponse, employeeResponse] = await Promise.all([
                fetch(`/api/analytics/summary${queryParams}`, { headers: cacheHeaders }),
                fetch(`/api/analytics/by-employee${queryParams}`, { headers: cacheHeaders })
            ]);
            
            if (!summaryResponse.ok || !employeeResponse.ok) {
                throw new Error(`HTTP error! Summary: ${summaryResponse.status}, Employee: ${employeeResponse.status}`);
            }
            
            const summary = await summaryResponse.json();
            const employeeData = await employeeResponse.json();
            
            console.log('Analytics data loaded:', { summary, employeeData });
            
            this.renderSummaryStats(summary);
            this.renderCharts(summary, employeeData);
        } catch (error) {
            console.error('Error loading analytics:', error);
            // Show user-friendly error
            document.getElementById('total-employees').textContent = 'Error';
            document.getElementById('total-weeks').textContent = 'Error';
            document.getElementById('total-empty').textContent = 'Error';
            document.getElementById('total-not-entered').textContent = 'Error';
            document.getElementById('total-entered').textContent = 'Error';
            document.getElementById('total-incorrect').textContent = 'Error';
        }
    }
    
    async loadVersion() {
        try {
            const response = await fetch('/api/version');
            const data = await response.json();
            const versionEl = document.getElementById('app-version');
            const managementVersionEl = document.getElementById('management-version');
            
            // Check if we have a stored version in localStorage
            const storedVersion = localStorage.getItem('appVersion');
            
            // If version changed or needs refresh, clear everything and reload
            if (storedVersion && storedVersion !== data.version) {
                console.log(`Version mismatch detected: ${storedVersion} -> ${data.version}`);
                // Clear all client-side storage
                localStorage.clear();
                sessionStorage.clear();
                // Clear cookies (we can't directly clear httpOnly cookies from JS, but we can clear others)
                document.cookie.split(";").forEach(c => {
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                // Store new version
                localStorage.setItem('appVersion', data.version);
                // Force reload to get fresh session
                window.location.reload(true);
                return;
            }
            
            // Store current version if not already stored
            if (!storedVersion) {
                localStorage.setItem('appVersion', data.version);
            }
            
            // Check if server says we need to refresh (for retroactive fixes)
            if (data.needsRefresh) {
                console.log('Server indicates session needs refresh');
                localStorage.clear();
                sessionStorage.clear();
                localStorage.setItem('appVersion', data.version);
                window.location.reload(true);
                return;
            }
            
            if (versionEl) {
                versionEl.textContent = `v${data.version}`;
            }
            if (managementVersionEl) {
                managementVersionEl.textContent = data.version;
            }
        } catch (error) {
            console.error('Error loading version:', error);
        }
    }
    
    async loadTimezoneSettings() {
        try {
            const response = await fetch('/api/settings/app_timezone');
            const data = await response.json();
            this.appTimezone = data.value || 'America/New_York';
            console.log('Loaded application timezone:', this.appTimezone);
        } catch (error) {
            console.error('Error loading timezone setting:', error);
            // Keep default timezone
        }
    }

    async loadDefaultWeekSetting() {
        try {
            const response = await fetch('/api/settings/default_week_offset');
            const data = await response.json();
            const offset = parseInt(data.value || 0);
            
            const today = new Date();
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + (offset * 7));
            this.currentWeekStart = this.getWeekStart(targetDate);
        } catch (error) {
            console.error('Error loading default week setting:', error);
            // Fallback to current week
            this.currentWeekStart = this.getWeekStart(new Date());
        }
    }
    
    async loadCurrentSettings() {
        try {
            // Load week offset setting
            const weekResponse = await fetch('/api/settings/default_week_offset');
            const weekData = await weekResponse.json();
            const weekSelect = document.getElementById('default-week-offset');
            if (weekSelect) {
                weekSelect.value = weekData.value || '0';
            }
            
            // Load timezone setting
            const timezoneResponse = await fetch('/api/settings/app_timezone');
            const timezoneData = await timezoneResponse.json();
            const timezoneSelect = document.getElementById('app-timezone');
            if (timezoneSelect) {
                timezoneSelect.value = timezoneData.value || 'America/New_York';
            }
        } catch (error) {
            console.error('Error loading current settings:', error);
        }
    }
    
    async saveWeekSetting() {
        const offset = document.getElementById('default-week-offset').value;
        const messageDiv = document.getElementById('settings-message');
        
        try {
            const response = await fetch('/api/settings/default_week_offset', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: offset }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageDiv.textContent = 'Default week setting saved successfully!';
                messageDiv.className = 'message success';
                
                // Update current week immediately
                const today = new Date();
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + (parseInt(offset) * 7));
                this.currentWeekStart = this.getWeekStart(targetDate);
                this.updateWeekDisplay();
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error saving setting';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error saving week setting:', error);
            messageDiv.textContent = 'Error saving setting';
            messageDiv.className = 'message error';
        }
        
        // Clear message after 3 seconds
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);
    }
    
    async saveTimezoneSetting() {
        const timezone = document.getElementById('app-timezone').value;
        const messageDiv = document.getElementById('settings-message');
        
        try {
            const response = await fetch('/api/settings/app_timezone', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: timezone }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageDiv.textContent = 'Timezone setting saved successfully! All users will now use this timezone.';
                messageDiv.className = 'message success';
                
                // Update timezone immediately
                this.appTimezone = timezone;
                console.log('Updated application timezone to:', this.appTimezone);
                
                // Recalculate current week with new timezone
                this.currentWeekStart = this.getWeekStart(new Date());
                this.updateWeekDisplay();
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error saving timezone setting';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error saving timezone setting:', error);
            messageDiv.textContent = 'Error saving timezone setting';
            messageDiv.className = 'message error';
        }
        
        // Clear message after 5 seconds (longer for timezone as it's important)
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    handleDeleteConfirmationInput(e) {
        const confirmationText = e.target.value;
        const deleteBtn = document.getElementById('delete-all-data-btn');
        
        if (confirmationText === 'DELETE ALL DATA') {
            deleteBtn.disabled = false;
        } else {
            deleteBtn.disabled = true;
        }
    }
    
    async handleDeleteAllData() {
        const confirmationInput = document.getElementById('delete-confirmation');
        const messageDiv = document.getElementById('danger-message');
        const deleteBtn = document.getElementById('delete-all-data-btn');
        
        if (confirmationInput.value !== 'DELETE ALL DATA') {
            messageDiv.textContent = 'Please type "DELETE ALL DATA" to confirm';
            messageDiv.className = 'message error';
            return;
        }
        
        if (!confirm('Are you absolutely sure you want to delete ALL data? This action cannot be undone!')) {
            return;
        }
        
        deleteBtn.disabled = true;
        messageDiv.textContent = 'Deleting all data...';
        messageDiv.className = 'message';
        
        try {
            const response = await fetch('/api/danger-zone/delete-all-data', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirmation: 'DELETE ALL DATA' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = 'All data has been permanently deleted';
                messageDiv.className = 'message success';
                
                confirmationInput.value = '';
                
                this.employees = [];
                this.timeEntries = [];
                this.loadEmployees();
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error deleting data';
                messageDiv.className = 'message error';
                deleteBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error deleting data:', error);
            messageDiv.textContent = 'Error deleting data';
            messageDiv.className = 'message error';
            deleteBtn.disabled = false;
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    handleClearAnalyticsConfirmationInput(e) {
        const confirmationText = e.target.value;
        const clearBtn = document.getElementById('clear-analytics-btn');
        
        if (confirmationText === 'CLEAR ANALYTICS') {
            clearBtn.disabled = false;
        } else {
            clearBtn.disabled = true;
        }
    }
    
    async handleClearAnalyticsData() {
        const confirmationInput = document.getElementById('clear-analytics-confirmation');
        const messageDiv = document.getElementById('danger-message');
        const clearBtn = document.getElementById('clear-analytics-btn');
        
        if (confirmationInput.value !== 'CLEAR ANALYTICS') {
            messageDiv.textContent = 'Please type "CLEAR ANALYTICS" to confirm';
            messageDiv.className = 'message error';
            return;
        }
        
        if (!confirm('Are you sure you want to clear all analytics data? Employee records will be kept but all time entries will be deleted.')) {
            return;
        }
        
        clearBtn.disabled = true;
        messageDiv.textContent = 'Clearing analytics data...';
        messageDiv.className = 'message';
        
        try {
            const response = await fetch('/api/danger-zone/clear-analytics', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: 'CLEAR ANALYTICS' }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = 'Analytics data has been permanently deleted';
                messageDiv.className = 'message success';
                confirmationInput.value = '';
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error clearing analytics data';
                messageDiv.className = 'message error';
                clearBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error clearing analytics data:', error);
            messageDiv.textContent = 'Error clearing analytics data';
            messageDiv.className = 'message error';
            clearBtn.disabled = false;
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    handleClearEmployeesConfirmationInput(e) {
        const confirmationText = e.target.value;
        const clearBtn = document.getElementById('clear-employees-btn');
        
        if (confirmationText === 'CLEAR EMPLOYEES') {
            clearBtn.disabled = false;
        } else {
            clearBtn.disabled = true;
        }
    }
    
    async handleClearEmployeesData() {
        const confirmationInput = document.getElementById('clear-employees-confirmation');
        const messageDiv = document.getElementById('danger-message');
        const clearBtn = document.getElementById('clear-employees-btn');
        
        if (confirmationInput.value !== 'CLEAR EMPLOYEES') {
            messageDiv.textContent = 'Please type "CLEAR EMPLOYEES" to confirm';
            messageDiv.className = 'message error';
            return;
        }
        
        if (!confirm('Are you sure you want to clear all employee data? This will delete all employees and their time entries.')) {
            return;
        }
        
        clearBtn.disabled = true;
        messageDiv.textContent = 'Clearing employee data...';
        messageDiv.className = 'message';
        
        try {
            const response = await fetch('/api/danger-zone/clear-employees', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: 'CLEAR EMPLOYEES' }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = 'Employee data has been permanently deleted';
                messageDiv.className = 'message success';
                confirmationInput.value = '';
                this.employees = [];
                this.timeEntries = [];
                this.loadEmployees();
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error clearing employee data';
                messageDiv.className = 'message error';
                clearBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error clearing employee data:', error);
            messageDiv.textContent = 'Error clearing employee data';
            messageDiv.className = 'message error';
            clearBtn.disabled = false;
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    handleClearPeriodConfirmationInput(e) {
        const confirmationText = e.target.value;
        const clearBtn = document.getElementById('clear-period-btn');
        
        if (confirmationText === 'CLEAR PERIOD') {
            clearBtn.disabled = false;
        } else {
            clearBtn.disabled = true;
        }
    }
    
    async handleClearPeriodData() {
        const confirmationInput = document.getElementById('clear-period-confirmation');
        const startDate = document.getElementById('clear-start-date').value;
        const endDate = document.getElementById('clear-end-date').value;
        const messageDiv = document.getElementById('danger-message');
        const clearBtn = document.getElementById('clear-period-btn');
        
        if (confirmationInput.value !== 'CLEAR PERIOD') {
            messageDiv.textContent = 'Please type "CLEAR PERIOD" to confirm';
            messageDiv.className = 'message error';
            return;
        }
        
        if (!startDate || !endDate) {
            messageDiv.textContent = 'Please select both start and end dates';
            messageDiv.className = 'message error';
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            messageDiv.textContent = 'Start date must be before end date';
            messageDiv.className = 'message error';
            return;
        }
        
        if (!confirm(`Are you sure you want to clear time entries from ${startDate} to ${endDate}? Employee records will be kept.`)) {
            return;
        }
        
        clearBtn.disabled = true;
        messageDiv.textContent = 'Clearing time period data...';
        messageDiv.className = 'message';
        
        try {
            const response = await fetch('/api/danger-zone/clear-period', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    confirmation: 'CLEAR PERIOD',
                    startDate,
                    endDate
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = `Time entries from ${startDate} to ${endDate} have been permanently deleted`;
                messageDiv.className = 'message success';
                confirmationInput.value = '';
                document.getElementById('clear-start-date').value = '';
                document.getElementById('clear-end-date').value = '';
                this.loadTimeEntries();
            } else {
                messageDiv.textContent = data.error || 'Error clearing time period data';
                messageDiv.className = 'message error';
                clearBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error clearing time period data:', error);
            messageDiv.textContent = 'Error clearing time period data';
            messageDiv.className = 'message error';
            clearBtn.disabled = false;
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    // API Token Management Methods
    async handleCreateToken(e) {
        e.preventDefault();
        
        const name = document.getElementById('token-name').value;
        const expires = document.getElementById('token-expires').value;
        const messageDiv = document.getElementById('token-message');
        
        try {
            const response = await fetch('/api/tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, expires })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show the generated token
                document.getElementById('generated-token').value = data.token;
                document.getElementById('new-token-display').style.display = 'block';
                
                // Clear the form
                document.getElementById('create-token-form').reset();
                
                // Refresh the tokens list
                this.loadApiTokens();
                
                messageDiv.textContent = 'Token created successfully!';
                messageDiv.className = 'message success';
                
                // Scroll to the token display
                document.getElementById('new-token-display').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            } else {
                messageDiv.textContent = data.error || 'Error creating token';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error creating token:', error);
            messageDiv.textContent = 'Error creating token';
            messageDiv.className = 'message error';
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    async loadApiTokens() {
        try {
            const response = await fetch('/api/tokens');
            const tokens = await response.json();
            
            const tokensContainer = document.getElementById('tokens-list');
            
            if (response.ok && tokens.length > 0) {
                tokensContainer.innerHTML = tokens.map(token => `
                    <div class="token-item">
                        <div class="token-info">
                            <strong>${this.escapeHtml(token.name)}</strong>
                            <small>
                                Created: ${new Date(token.created).toLocaleDateString()} | 
                                ${token.expires ? `Expires: ${new Date(token.expires).toLocaleDateString()}` : 'No expiration'} |
                                ${token.last_used ? `Last used: ${new Date(token.last_used).toLocaleDateString()}` : 'Never used'}
                            </small>
                        </div>
                        <div class="token-actions">
                            <button class="btn btn-danger btn-small revoke-token-btn" data-token-id="${token.id}" data-token-name="${token.name}">
                                Revoke
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                tokensContainer.innerHTML = '<div class="empty-tokens">No active tokens</div>';
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
            document.getElementById('tokens-list').innerHTML = '<div class="empty-tokens">Error loading tokens</div>';
        }
    }
    
    async revokeToken(tokenId, tokenName) {
        if (!confirm(`Are you sure you want to revoke the token "${tokenName}"? This action cannot be undone.`)) {
            return;
        }
        
        const messageDiv = document.getElementById('token-message');
        
        try {
            const response = await fetch(`/api/tokens/${tokenId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageDiv.textContent = `Token "${tokenName}" revoked successfully`;
                messageDiv.className = 'message success';
                this.loadApiTokens(); // Refresh the list
            } else {
                messageDiv.textContent = data.error || 'Error revoking token';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error revoking token:', error);
            messageDiv.textContent = 'Error revoking token';
            messageDiv.className = 'message error';
        }
        
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }
    
    copyGeneratedToken() {
        const tokenInput = document.getElementById('generated-token');
        tokenInput.select();
        tokenInput.setSelectionRange(0, 99999); // For mobile devices
        
        navigator.clipboard.writeText(tokenInput.value).then(() => {
            const button = document.getElementById('copy-token-btn');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            document.execCommand('copy');
            const button = document.getElementById('copy-token-btn');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    }
    
    copyDocsUrl() {
        const url = window.location.origin + '/api-docs';
        navigator.clipboard.writeText(url).then(() => {
            const button = document.getElementById('copy-docs-url');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }).catch(() => {
            // Fallback
            const button = document.getElementById('copy-docs-url');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadApiRateLimits() {
        try {
            const [unauthResponse, authResponse, windowResponse] = await Promise.all([
                fetch('/api/settings/api_rate_limit_unauthenticated_per_minute'),
                fetch('/api/settings/api_rate_limit_authenticated_per_minute'),
                fetch('/api/settings/api_rate_limit_window_minutes')
            ]);

            const unauthData = await unauthResponse.json();
            const authData = await authResponse.json();
            const windowData = await windowResponse.json();

            document.getElementById('api-limit-unauthenticated').value = unauthData.value || '100';
            document.getElementById('api-limit-authenticated').value = authData.value || '1000';
            document.getElementById('api-limit-window').value = windowData.value || '1';
        } catch (error) {
            console.error('Error loading API rate limits:', error);
        }
    }

    async saveApiRateLimitSetting(settingKey, inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        const messageDiv = document.getElementById('rate-limit-message');
        
        const value = input.value;
        if (!value || isNaN(value) || parseInt(value) < 1) {
            messageDiv.textContent = 'Please enter a valid positive number';
            messageDiv.className = 'message error';
            return;
        }

        button.disabled = true;
        button.textContent = 'Saving...';

        try {
            const response = await fetch(`/api/settings/${settingKey}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value: value })
            });

            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = 'Rate limit setting saved successfully!';
                messageDiv.className = 'message success';
            } else {
                messageDiv.textContent = data.error || 'Error saving setting';
                messageDiv.className = 'message error';
            }
        } catch (error) {
            console.error('Error saving API rate limit setting:', error);
            messageDiv.textContent = 'Error saving setting';
            messageDiv.className = 'message error';
        } finally {
            button.disabled = false;
            button.textContent = 'Save';
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'message';
            }, 3000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new EmployeeTracker();
});