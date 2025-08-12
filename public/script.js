class EmployeeTracker {
    constructor() {
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
        this.setupEventListeners();
        this.handleDirectRouting();
        this.parseURLParameters();
        await this.loadConfig();
        await this.loadDefaultWeekSetting();
        this.updateWeekDisplay();
        // Load employees first, then time entries to ensure proper rendering
        await this.loadEmployees();
        await this.loadTimeEntries();
        this.checkAuthentication();
        this.loadVersion();
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
        const d = new Date(date);
        const day = d.getDay();
        // Convert Sunday (0) to 7 to make Monday (1) the start of week
        const adjustedDay = day === 0 ? 7 : day;
        const diff = adjustedDay - 1; // Days since Monday
        
        // Create a new date object to avoid modifying the original
        const monday = new Date(d);
        monday.setDate(d.getDate() - diff);
        
        // Reset time to start of day to avoid timezone issues
        monday.setHours(0, 0, 0, 0);
        
        return monday.toISOString().split('T')[0];
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
            
            // Add timestamp to URL to prevent caching
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/time-entries/${this.currentWeekStart}?t=${timestamp}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.timeEntries = await response.json();
            console.log('Loaded time entries for week:', this.currentWeekStart, this.timeEntries);
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
            console.log('No time entries to render');
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
        
        try {
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId,
                    weekStart: this.currentWeekStart,
                    day,
                    status: nextStatus
                }),
                credentials: 'include'
            });
            
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
            start: startDate.toISOString().split('T')[0], 
            end: endDate.toISOString().split('T')[0], 
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
            const response = await fetch('/api/settings/default_week_offset');
            const data = await response.json();
            const select = document.getElementById('default-week-offset');
            if (select) {
                select.value = data.value || '0';
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
}

document.addEventListener('DOMContentLoaded', () => {
    new EmployeeTracker();
});