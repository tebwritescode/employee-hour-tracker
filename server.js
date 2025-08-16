const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const Json2csvParser = require('json2csv').Parser;
const path = require('path');
const backup = require('./backup');
const packageJson = require('./package.json');
const VERSION = packageJson.version;
const rateLimit = require('express-rate-limit');
const lusca = require('lusca');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment variables
const config = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './employee_tracker.db',
  sessionSecret: process.env.SESSION_SECRET || 'employee-tracker-secret-key',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || null, // If not set, frontend will use window.location.origin
  enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true' // Default false unless explicitly enabled
};

// Debug logging function
function debugLog(...args) {
  if (config.enableDebugLogs) {
    console.log('🐛 DEBUG:', ...args);
  }
}

app.use(cors({
  credentials: true,
  origin: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: config.sessionSecret,
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: config.nodeEnv === 'production', // Secure in production, false in development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// CSRF protection middleware - temporarily disabled for testing
// TODO: Re-enable with proper frontend CSRF token handling
// app.use(lusca.csrf());

// Version-based session validation middleware
app.use((req, res, next) => {
  // Skip version check for static files and version endpoint
  if (req.path === '/api/version' || !req.path.startsWith('/api/')) {
    return next();
  }
  
  // If session exists with old version, mark it for client to handle
  if (req.session && req.session.appVersion && req.session.appVersion !== VERSION) {
    // Don't destroy here, let the client handle it via /api/version
    res.setHeader('X-Version-Mismatch', 'true');
    res.setHeader('X-Current-Version', VERSION);
    res.setHeader('X-Session-Version', req.session.appVersion);
  }
  
  next();
});

const db = new sqlite3.Database(config.dbPath);

// Database migration function for v1.1.0
// Comprehensive database migration system
function migrateDatabase() {
  console.log('🔄 Checking for database migrations...');
  
  // Create migrations table if it doesn't exist
  db.run(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating migrations table:', err);
      return;
    }
    
    // Run all migrations in order
    runMigrations();
  });
}

function runMigrations() {
  const migrations = [
    {
      name: 'v1.1.0_add_empty_status',
      description: 'Change default from Not Entered to Empty',
      run: (callback) => {
        // Check if this migration is needed
        db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='time_entries'`, (err, row) => {
          if (err) return callback(err);
          
          if (row && row.sql && row.sql.includes("DEFAULT 'Not Entered'")) {
            console.log('📦 Running migration: v1.1.0 - Adding Empty status...');
            
            // Create new table with updated schema
            db.run(`CREATE TABLE IF NOT EXISTS time_entries_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              employee_id INTEGER,
              week_start DATE,
              monday TEXT DEFAULT 'Empty',
              tuesday TEXT DEFAULT 'Empty',
              wednesday TEXT DEFAULT 'Empty',
              thursday TEXT DEFAULT 'Empty',
              friday TEXT DEFAULT 'Empty',
              saturday TEXT DEFAULT 'Empty',
              sunday TEXT DEFAULT 'Empty',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (employee_id) REFERENCES employees (id),
              UNIQUE(employee_id, week_start)
            )`, (err) => {
              if (err) return callback(err);
              
              // Copy existing data
              db.run(`INSERT INTO time_entries_new SELECT * FROM time_entries`, (err) => {
                if (err) return callback(err);
                
                // Drop old table and rename new one
                db.run(`DROP TABLE time_entries`, (err) => {
                  if (err) return callback(err);
                  
                  db.run(`ALTER TABLE time_entries_new RENAME TO time_entries`, (err) => {
                    if (err) return callback(err);
                    console.log('✅ Migration v1.1.0 completed successfully!');
                    callback();
                  });
                });
              });
            });
          } else {
            // Migration not needed or already applied
            callback();
          }
        });
      }
    },
    {
      name: 'v1.6.0_add_api_tokens',
      description: 'Add API tokens table for external access',
      run: (callback) => {
        db.run(`CREATE TABLE IF NOT EXISTS api_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          last_used_at DATETIME,
          is_active BOOLEAN DEFAULT 1
        )`, callback);
      }
    },
    {
      name: 'v1.6.1_add_api_rate_limit_settings',
      description: 'Add configurable API rate limit settings',
      run: (callback) => {
        // Add default API rate limit settings
        db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('api_rate_limit_unauthenticated_per_minute', '100')`, (err1) => {
          if (err1) return callback(err1);
          db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('api_rate_limit_authenticated_per_minute', '1000')`, (err2) => {
            if (err2) return callback(err2);
            db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('api_rate_limit_window_minutes', '1')`, callback);
          });
        });
      }
    },
    {
      name: 'v1.6.3_add_timezone_setting',
      description: 'Add configurable application timezone setting',
      run: (callback) => {
        // Add application timezone setting with default to Eastern Time
        db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('app_timezone', 'America/New_York')`, callback);
      }
    },
    {
      name: 'v1.6.5_timezone_fix_complete',
      description: 'Timezone calculation moved to server-side for consistency',
      run: (callback) => {
        // This migration marks completion of timezone fix - server-side week calculation now active
        console.log('✅ v1.6.5: Server-side week calculation active - timezone issues resolved');
        callback();
      }
    },
    {
      name: 'v1.6.6_navigation_fix_complete',
      description: 'Week navigation and calendar selection moved to server-side',
      run: (callback) => {
        // This migration marks completion of navigation fix - all date calculations server-side
        console.log('✅ v1.6.6: All navigation now server-side - client-specific date issues resolved');
        callback();
      }
    }
  ];
  
  // Process migrations sequentially
  let index = 0;
  
  function processNextMigration() {
    if (index >= migrations.length) {
      console.log('✅ All database migrations completed!');
      return;
    }
    
    const migration = migrations[index];
    
    // Check if migration has already been applied
    db.get('SELECT * FROM migrations WHERE migration_name = ?', [migration.name], (err, row) => {
      if (err) {
        console.error(`Error checking migration ${migration.name}:`, err);
        index++;
        processNextMigration();
        return;
      }
      
      if (row) {
        // Migration already applied
        index++;
        processNextMigration();
      } else {
        // Run the migration
        console.log(`🔧 Running migration: ${migration.name} - ${migration.description}`);
        migration.run((err) => {
          if (err) {
            console.error(`Error running migration ${migration.name}:`, err);
          } else {
            // Record migration as applied
            db.run('INSERT INTO migrations (migration_name) VALUES (?)', [migration.name], (err) => {
              if (err) {
                console.error(`Error recording migration ${migration.name}:`, err);
              }
            });
          }
          index++;
          processNextMigration();
        });
      }
    });
  }
  
  processNextMigration();
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    week_start DATE,
    monday TEXT DEFAULT 'Empty',
    tuesday TEXT DEFAULT 'Empty',
    wednesday TEXT DEFAULT 'Empty',
    thursday TEXT DEFAULT 'Empty',
    friday TEXT DEFAULT 'Empty',
    saturday TEXT DEFAULT 'Empty',
    sunday TEXT DEFAULT 'Empty',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees (id),
    UNIQUE(employee_id, week_start)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE,
    setting_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const adminPassword = bcrypt.hashSync(config.defaultAdminPassword, 10);
  db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)`, [config.defaultAdminUsername, adminPassword]);
  
  // Initialize default settings
  db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('default_week_offset', '0')`);
  
  // Run migration after tables are created
  setTimeout(() => {
    migrateDatabase();
  }, 1000);
});

// Generate a secure API token
function generateApiToken() {
  const crypto = require('crypto');
  return 'ht_' + crypto.randomBytes(32).toString('hex');
}

// Middleware to check API token
function checkApiToken(req, res, next) {
  const token = req.headers['x-api-token'];
  
  if (!token) {
    return next(); // No token provided, continue to session auth
  }
  
  db.get(
    `SELECT * FROM api_tokens WHERE token = ? AND is_active = 1`,
    [token],
    (err, row) => {
      if (err) {
        console.error('Error checking API token:', err);
        return next();
      }
      
      if (row) {
        // Check if token is expired
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return res.status(401).json({ error: 'API token expired' });
        }
        
        // Update last used timestamp
        db.run(
          'UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
          [row.id]
        );
        
        req.apiAuthenticated = true;
        req.apiToken = row;
      }
      next();
    }
  );
}

// Rate limiting configuration with dynamic settings
const createDynamicRateLimiter = (message) => {
  return rateLimit({
    windowMs: (req, res) => {
      // Default to 1 minute if settings not available
      return req.rateLimitSettings?.windowMs || 60 * 1000;
    },
    max: (req, res) => {
      // Use different limits for authenticated vs unauthenticated requests
      const authenticated = req.apiToken ? true : false;
      if (authenticated) {
        return req.rateLimitSettings?.authenticatedMax || 1000;
      } else {
        return req.rateLimitSettings?.unauthenticatedMax || 100;
      }
    },
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // Store rate limit info in memory (use Redis for production)
    keyGenerator: (req) => {
      // Use API token if available for rate limiting
      if (req.apiToken) {
        return `token_${req.apiToken.id}`;
      }
      // For IP-based rate limiting, let express-rate-limit handle IPv6 properly
      return undefined; // This will use the default IP handling
    }
  });
};

// Middleware to load rate limit settings from database
const loadRateLimitSettings = (req, res, next) => {
  db.all('SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE "api_rate_limit_%"', (err, rows) => {
    if (err) {
      console.error('Error loading rate limit settings:', err);
      // Use defaults
      req.rateLimitSettings = {
        windowMs: 60 * 1000,
        unauthenticatedMax: 100,
        authenticatedMax: 1000
      };
    } else {
      const settings = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      
      req.rateLimitSettings = {
        windowMs: parseInt(settings.api_rate_limit_window_minutes || '1') * 60 * 1000,
        unauthenticatedMax: parseInt(settings.api_rate_limit_unauthenticated_per_minute || '100'),
        authenticatedMax: parseInt(settings.api_rate_limit_authenticated_per_minute || '1000')
      };
    }
    next();
  });
};

// Default rate limit for all API endpoints
const apiLimiter = createDynamicRateLimiter('Too many requests, please try again later');

// Static auth rate limiter (doesn't need to be configurable)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 5, // limit each IP to 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Create file serving rate limiter
const fileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 file requests per windowMs
  message: { error: 'Too many file requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply API token check to all /api routes
app.use('/api', checkApiToken);

// Load rate limit settings for all /api routes
app.use('/api', loadRateLimitSettings);

// Apply rate limiting
app.use('/api/login', authLimiter);
app.use('/api/change-credentials', authLimiter);

// Apply dynamic rate limiting to all /api routes (handles both authenticated and unauthenticated)
app.use('/api', apiLimiter);

function requireAuth(req, res, next) {
  if ((req.session && req.session.authenticated) || req.apiAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (bcrypt.compareSync(password, user.password_hash)) {
      req.session.authenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

app.get('/api/version', (req, res) => {
  const currentVersion = packageJson.version;
  const sessionVersion = req.session?.appVersion;
  const needsRefresh = sessionVersion && sessionVersion !== currentVersion;
  
  // Initialize or update session version
  if (!req.session) {
    // Create new session if none exists
    req.session = {};
  }
  
  if (!sessionVersion || sessionVersion !== currentVersion) {
    req.session.appVersion = currentVersion;
    req.session.save(); // Explicitly save the session
  }
  
  res.json({ 
    version: currentVersion,
    sessionVersion: sessionVersion || null,
    needsRefresh: needsRefresh 
  });
});

// EMERGENCY DIAGNOSTIC ENDPOINT
app.post('/api/debug/client-info', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const timestamp = new Date().toISOString();
  const data = req.body;
  
  console.log('\n🚨 CLIENT DIAGNOSTIC RECEIVED 🚨');
  console.log('====================================');
  console.log('Timestamp:', timestamp);
  console.log('Client IP:', clientIP);
  console.log('Client Timezone:', data.clientTimezone);
  console.log('Timezone Offset:', data.timezoneOffset, 'minutes');
  console.log('User Agent:', data.userAgent);
  console.log('Current Week Start:', data.currentWeekStart);
  console.log('Test Results:');
  console.log('  Input Time:', data.testResults.inputTime);
  console.log('  Parsed Time:', data.testResults.parsedTime);
  console.log('  getDay():', data.testResults.getDay);
  console.log('  App TZ Conversion:', data.testResults.appTimezoneConversion);
  console.log('====================================\n');
  
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  res.json({ 
    baseUrl: config.baseUrl,
    enableDebugLogs: config.enableDebugLogs
  });
});

app.post('/api/change-credentials', requireAuth, (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  
  db.run('UPDATE admin_users SET username = ?, password_hash = ? WHERE id = 1', 
    [username, passwordHash], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: 'Credentials updated successfully' });
  });
});

// Settings endpoints
app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  db.get('SELECT setting_value FROM settings WHERE setting_key = ?', [key], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ key, value: row ? row.setting_value : null });
  });
});

app.put('/api/settings/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  db.run(`INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)`, [key, value], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ key, value, success: true });
  });
});

app.get('/api/employees', (req, res) => {
  // Prevent caching of employee data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  db.all('SELECT * FROM employees ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/employees', requireAuth, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO employees (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

app.put('/api/employees/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Employee name is required' });
  }
  
  db.run('UPDATE employees SET name = ? WHERE id = ?', [name.trim(), id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ id: parseInt(id), name: name.trim() });
  });
});

app.delete('/api/employees/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM employees WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.run('DELETE FROM time_entries WHERE employee_id = ?', [id]);
    res.json({ success: true });
  });
});

// SERVER-SIDE WEEK CALCULATION ENDPOINT
function calculateWeekStart(targetDate, timezoneSetting) {
  // Calculate date in application timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezoneSetting,
    year: 'numeric',
    month: '2-digit',  
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(targetDate);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  
  // Create date in app timezone 
  const appTimezoneDate = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = appTimezoneDate.getDay();
  
  // Calculate Monday of this week (week start)
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const diff = adjustedDay - 1;
  
  const monday = new Date(appTimezoneDate);
  monday.setDate(appTimezoneDate.getDate() - diff);
  
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

app.get('/api/current-week', async (req, res) => {
  try {
    // Get application timezone from settings
    const timezoneSetting = await new Promise((resolve, reject) => {
      db.get('SELECT setting_value FROM settings WHERE setting_key = ?', ['app_timezone'], (err, row) => {
        if (err) reject(err);
        else resolve(row?.setting_value || 'America/New_York');
      });
    });
    
    const now = new Date();
    const weekStart = calculateWeekStart(now, timezoneSetting);
    
    res.json({ 
      currentWeek: weekStart,
      timezone: timezoneSetting,
      serverTime: now.toISOString()
    });
    
  } catch (error) {
    console.error('Error calculating current week:', error);
    res.status(500).json({ error: 'Failed to calculate current week' });
  }
});

app.post('/api/current-week', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  debugLog(`POST /api/current-week - Client: ${clientIP}`);
  debugLog(`POST /api/current-week - Request body:`, req.body);
  
  try {
    // Get application timezone from settings
    const timezoneSetting = await new Promise((resolve, reject) => {
      db.get('SELECT setting_value FROM settings WHERE setting_key = ?', ['app_timezone'], (err, row) => {
        if (err) reject(err);
        else resolve(row?.setting_value || 'America/New_York');
      });
    });
    
    debugLog(`POST /api/current-week - Timezone setting: ${timezoneSetting}`);
    
    const { targetDate } = req.body;
    const target = targetDate ? new Date(targetDate) : new Date();
    const weekStart = calculateWeekStart(target, timezoneSetting);
    
    debugLog(`POST /api/current-week - Target date: ${target.toISOString()}`);
    debugLog(`POST /api/current-week - Calculated week start: ${weekStart}`);
    
    const response = { 
      currentWeek: weekStart,
      timezone: timezoneSetting,
      targetDate: target.toISOString()
    };
    
    debugLog(`POST /api/current-week - Sending response:`, response);
    res.json(response);
    
  } catch (error) {
    console.error('Error calculating week for target date:', error);
    debugLog(`POST /api/current-week - ERROR:`, error);
    res.status(500).json({ error: 'Failed to calculate week' });
  }
});

// SERVER-SIDE DATE OPERATIONS ENDPOINT
app.post('/api/date-operations', async (req, res) => {
  try {
    // Get application timezone from settings
    const timezoneSetting = await new Promise((resolve, reject) => {
      db.get('SELECT setting_value FROM settings WHERE setting_key = ?', ['app_timezone'], (err, row) => {
        if (err) reject(err);
        else resolve(row?.setting_value || 'America/New_York');
      });
    });
    
    const { operation, params } = req.body;
    let result = {};
    
    switch (operation) {
      case 'getToday':
        const today = new Date();
        result.today = today.toISOString().split('T')[0];
        result.weekStart = calculateWeekStart(today, timezoneSetting);
        break;
        
      case 'addDays':
        const { startDate, days } = params;
        const baseDate = new Date(startDate + 'T12:00:00');
        baseDate.setDate(baseDate.getDate() + days);
        result.newDate = baseDate.toISOString().split('T')[0];
        result.weekStart = calculateWeekStart(baseDate, timezoneSetting);
        break;
        
      case 'addWeeks':
        const { startDate: weekStart, weeks } = params;
        const weekDate = new Date(weekStart + 'T12:00:00');
        weekDate.setDate(weekDate.getDate() + (weeks * 7));
        result.newDate = weekDate.toISOString().split('T')[0];
        result.weekStart = calculateWeekStart(weekDate, timezoneSetting);
        break;
        
      case 'formatWeekDisplay':
        const { weekStartDate } = params;
        const weekDisplayStartDate = new Date(weekStartDate + 'T12:00:00');
        const weekDisplayEndDate = new Date(weekDisplayStartDate);
        weekDisplayEndDate.setDate(weekDisplayStartDate.getDate() + 6);
        
        const formatOptions = { month: 'short', day: 'numeric', timeZone: timezoneSetting };
        const startFormatted = weekDisplayStartDate.toLocaleDateString('en-US', formatOptions);
        const endFormatted = weekDisplayEndDate.toLocaleDateString('en-US', formatOptions);
        
        result.display = `${startFormatted} - ${endFormatted}, ${weekDisplayStartDate.getFullYear()}`;
        result.startDate = weekDisplayStartDate.toISOString().split('T')[0];
        result.endDate = weekDisplayEndDate.toISOString().split('T')[0];
        break;
        
      case 'calculateDateRange':
        const { preset } = params;
        const now = new Date();
        let rangeStart, rangeEnd;
        
        switch (preset) {
          case 'week':
            const currentWeekStart = calculateWeekStart(now, timezoneSetting);
            rangeStart = new Date(currentWeekStart + 'T12:00:00');
            rangeStart.setDate(rangeStart.getDate() - 7); // Previous Monday
            rangeEnd = new Date(rangeStart);
            rangeEnd.setDate(rangeEnd.getDate() + 6); // That week's Sunday
            break;
          case 'month':
            rangeStart = new Date(now);
            rangeStart.setDate(now.getDate() - 30);
            rangeEnd = new Date(now);
            break;
          case '90days':
            rangeStart = new Date(now);
            rangeStart.setDate(now.getDate() - 90);
            rangeEnd = new Date(now);
            break;
        }
        
        result.startDate = rangeStart.toISOString().split('T')[0];
        result.endDate = rangeEnd.toISOString().split('T')[0];
        break;
        
      case 'validateDateRange':
        const { startDate: startDateStr, endDate: endDateStr } = params;
        
        try {
          const start = new Date(startDateStr + 'T12:00:00');
          const end = new Date(endDateStr + 'T12:00:00');
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            result.valid = false;
            result.message = 'Invalid date format';
          } else if (start > end) {
            result.valid = false;
            result.message = 'Start date must be before end date';
          } else {
            result.valid = true;
            result.message = 'Valid date range';
          }
        } catch (error) {
          result.valid = false;
          result.message = 'Error validating dates';
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown operation' });
    }
    
    result.timezone = timezoneSetting;
    result.serverTime = new Date().toISOString();
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in date operations:', error);
    res.status(500).json({ error: 'Failed to perform date operation' });
  }
});

app.get('/api/time-entries/:weekStart', (req, res) => {
  const { weekStart } = req.params;
  
  // Prevent caching of time entries data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  const query = `
    SELECT e.id, e.name, te.week_start,
           COALESCE(te.monday, 'Empty') as monday,
           COALESCE(te.tuesday, 'Empty') as tuesday,
           COALESCE(te.wednesday, 'Empty') as wednesday,
           COALESCE(te.thursday, 'Empty') as thursday,
           COALESCE(te.friday, 'Empty') as friday,
           COALESCE(te.saturday, 'Empty') as saturday,
           COALESCE(te.sunday, 'Empty') as sunday
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id AND te.week_start = ?
    ORDER BY e.name
  `;
  
  db.all(query, [weekStart], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json(rows);
  });
});

app.post('/api/time-entries', requireAuth, (req, res) => {
  const { employeeId, weekStart, day, status } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Validate the day parameter to prevent SQL injection
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (!validDays.includes(day)) {
    res.status(400).json({ error: 'Invalid day parameter' });
    return;
  }
  
  // DEBUG LOGGING
  console.log('\n🐛 DEBUG - POST /api/time-entries');
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Client IP: ${clientIP}`);
  console.log(`  Employee ID: ${employeeId}`);
  console.log(`  Week start: "${weekStart}"`);
  console.log(`  Day: ${day}`);
  console.log(`  Status: ${status}`);
  
  const query = `
    INSERT INTO time_entries (employee_id, week_start, ${day}) 
    VALUES (?, ?, ?)
    ON CONFLICT(employee_id, week_start) 
    DO UPDATE SET ${day} = ?, updated_at = CURRENT_TIMESTAMP
  `;
  
  db.run(query, [employeeId, weekStart, status, status], function(err) {
    if (err) {
      console.log(`  ERROR: ${err.message}`);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log(`  SUCCESS: Updated/inserted time entry for employee ${employeeId}, week ${weekStart}, ${day} = ${status}`);
    console.log('🐛 DEBUG - POST /api/time-entries complete\n');
    res.json({ success: true });
  });
});

app.get('/api/analytics/summary', (req, res) => {
  const { startDate, endDate, includeAll } = req.query;
  
  // Prevent caching of analytics data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  let dateFilter = '';
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = 'WHERE te.week_start >= ? AND te.week_start <= ?';
    params = [startDate, endDate];
  }
  
  // If includeAll is true, we need to count all employees, not just those with entries
  let query;
  if (includeAll === 'true') {
    // Count all employees from the employees table
    query = `
      SELECT 
        (SELECT COUNT(*) FROM employees) as total_employees,
        COUNT(DISTINCT te.week_start) as total_weeks,
        COALESCE(SUM(CASE WHEN te.monday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Empty' THEN 1 ELSE 0 END), 0) as total_empty,
        COALESCE(SUM(CASE WHEN te.monday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Entered' THEN 1 ELSE 0 END), 0) as total_entered,
        COALESCE(SUM(CASE WHEN te.monday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Not Entered' THEN 1 ELSE 0 END), 0) as total_not_entered,
        COALESCE(SUM(CASE WHEN te.monday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Incorrect' THEN 1 ELSE 0 END), 0) as total_incorrect
      FROM time_entries te
      ${dateFilter}
    `;
  } else {
    // Original query - only count employees with entries
    query = `
      SELECT 
        COUNT(DISTINCT te.employee_id) as total_employees,
        COUNT(DISTINCT te.week_start) as total_weeks,
        SUM(CASE WHEN te.monday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Empty' THEN 1 ELSE 0 END) as total_empty,
        SUM(CASE WHEN te.monday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Entered' THEN 1 ELSE 0 END) as total_entered,
        SUM(CASE WHEN te.monday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Not Entered' THEN 1 ELSE 0 END) as total_not_entered,
        SUM(CASE WHEN te.monday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.tuesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.wednesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.thursday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.friday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.saturday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN te.sunday = 'Incorrect' THEN 1 ELSE 0 END) as total_incorrect
      FROM time_entries te
      ${dateFilter}
    `;
  }
  
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.get('/api/analytics/by-employee', (req, res) => {
  const { startDate, endDate, includeAll } = req.query;
  
  // Prevent caching of analytics data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  let dateFilter = '';
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = 'WHERE te.week_start >= ? AND te.week_start <= ?';
    params = [startDate, endDate];
  }
  
  // Use LEFT JOIN if includeAll is true, INNER JOIN otherwise
  const joinType = includeAll === 'true' ? 'LEFT' : 'INNER';
  const whereClause = dateFilter ? (joinType === 'LEFT' ? dateFilter.replace('WHERE', 'AND') : dateFilter) : '';
  
  const query = `
    SELECT 
      e.name,
      COALESCE(SUM(CASE WHEN te.monday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Empty' THEN 1 ELSE 0 END), 0) as empty,
      COALESCE(SUM(CASE WHEN te.monday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Entered' THEN 1 ELSE 0 END), 0) as entered,
      COALESCE(SUM(CASE WHEN te.monday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Not Entered' THEN 1 ELSE 0 END), 0) as not_entered,
      COALESCE(SUM(CASE WHEN te.monday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Incorrect' THEN 1 ELSE 0 END), 0) as incorrect
    FROM employees e
    ${joinType} JOIN time_entries te ON e.id = te.employee_id ${joinType === 'LEFT' && dateFilter ? whereClause : ''}
    ${joinType === 'INNER' ? dateFilter : ''}
    GROUP BY e.id, e.name
    ORDER BY e.name
  `;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/export/:format', (req, res) => {
  const { format } = req.params;
  const { startDate, endDate } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = 'WHERE te.week_start >= ? AND te.week_start <= ?';
    params = [startDate, endDate];
  }
  
  const query = `
    SELECT 
      e.name as employee_name,
      te.week_start,
      te.monday,
      te.tuesday,
      te.wednesday,
      te.thursday,
      te.friday,
      te.saturday,
      te.sunday
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id
    ${dateFilter}
    ORDER BY e.name, te.week_start
  `;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (format === 'csv') {
      // Generate CSV with week start as header and group by week
      const weekGroups = {};
      
      // Group rows by week_start
      rows.forEach(row => {
        const weekStart = row.week_start || 'No Week Set';
        if (!weekGroups[weekStart]) {
          weekGroups[weekStart] = [];
        }
        weekGroups[weekStart].push(row);
      });
      
      let csvContent = '';
      
      // Generate CSV content for each week
      Object.keys(weekGroups).sort().forEach((weekStart, index) => {
        if (index > 0) {
          csvContent += '\n'; // Add single line spacing between weeks
        }
        
        // Add week header
        csvContent += `Week Starting: ${weekStart}\n`;
        
        // Add column headers
        csvContent += '"Employee Name","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"\n';
        
        // Add data rows for this week
        weekGroups[weekStart].forEach(row => {
          const csvRow = [
            row.employee_name || '',
            row.monday || 'Not Entered',
            row.tuesday || 'Not Entered', 
            row.wednesday || 'Not Entered',
            row.thursday || 'Not Entered',
            row.friday || 'Not Entered',
            row.saturday || 'Not Entered',
            row.sunday || 'Not Entered'
          ];
          
          // Properly escape and quote CSV values
          const escapedRow = csvRow.map(value => {
            const stringValue = String(value);
            if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return `"${stringValue}"`;
          });
          
          csvContent += escapedRow.join(',') + '\n';
        });
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employee_time_data.csv"');
      res.send(csvContent);
    } else {
      res.json(rows);
    }
  });
});

app.delete('/api/danger-zone/clear-analytics', requireAuth, (req, res) => {
  const { confirmation } = req.body;
  
  if (confirmation !== 'CLEAR ANALYTICS') {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }
  
  db.run('DELETE FROM time_entries', function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete time entries: ' + err.message });
    }
    
    res.json({ 
      success: true, 
      message: 'All analytics data (time entries) have been permanently deleted' 
    });
  });
});

app.delete('/api/danger-zone/clear-employees', requireAuth, (req, res) => {
  const { confirmation } = req.body;
  
  if (confirmation !== 'CLEAR EMPLOYEES') {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }
  
  db.serialize(() => {
    db.run('DELETE FROM time_entries', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete time entries: ' + err.message });
      }
    });
    
    db.run('DELETE FROM employees', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete employees: ' + err.message });
      }
      
      res.json({ 
        success: true, 
        message: 'All employee data and associated time entries have been permanently deleted' 
      });
    });
  });
});

app.delete('/api/danger-zone/clear-period', requireAuth, (req, res) => {
  const { confirmation, startDate, endDate } = req.body;
  
  if (confirmation !== 'CLEAR PERIOD') {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: 'Start date must be before end date' });
  }
  
  db.run('DELETE FROM time_entries WHERE week_start >= ? AND week_start <= ?', [startDate, endDate], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete time entries: ' + err.message });
    }
    
    res.json({ 
      success: true, 
      message: `Time entries from ${startDate} to ${endDate} have been permanently deleted`,
      deletedRows: this.changes
    });
  });
});

app.delete('/api/danger-zone/delete-all-data', requireAuth, (req, res) => {
  const { confirmation } = req.body;
  
  if (confirmation !== 'DELETE ALL DATA') {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }
  
  db.serialize(() => {
    db.run('DELETE FROM time_entries', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete time entries: ' + err.message });
      }
    });
    
    db.run('DELETE FROM employees', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete employees: ' + err.message });
      }
    });
    
    db.run('DELETE FROM settings WHERE setting_key != "default_week_offset"', function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete non-essential settings: ' + err.message });
      }
      
      res.json({ 
        success: true, 
        message: 'All employee data and time entries have been permanently deleted' 
      });
    });
  });
});

// Route handlers for direct page access (with rate limiting)
app.get('/', fileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tracking', fileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/analytics', fileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/management', fileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api-docs', requireAuth, fileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

// API Token Management Endpoints
app.post('/api/tokens', requireAuth, (req, res) => {
  const { name, expires } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Token name is required' });
  }
  
  const token = generateApiToken();
  const expiresAt = expires ? new Date(expires).toISOString() : null;
  
  db.run(
    `INSERT INTO api_tokens (token, name, expires_at) VALUES (?, ?, ?)`,
    [token, name, expiresAt],
    function(err) {
      if (err) {
        console.error('Error creating API token:', err);
        return res.status(500).json({ error: 'Failed to create token' });
      }
      
      res.json({
        token,
        name,
        created: new Date().toISOString(),
        expires: expiresAt
      });
    }
  );
});

app.get('/api/tokens', requireAuth, (req, res) => {
  db.all(
    `SELECT id, name, created_at, expires_at, last_used_at, is_active 
     FROM api_tokens 
     WHERE is_active = 1 
     ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('Error fetching tokens:', err);
        return res.status(500).json({ error: 'Failed to fetch tokens' });
      }
      
      res.json(rows.map(row => ({
        id: row.id,
        name: row.name,
        created: row.created_at,
        expires: row.expires_at,
        last_used: row.last_used_at
      })));
    }
  );
});

app.delete('/api/tokens/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE api_tokens SET is_active = 0 WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error revoking token:', err);
        return res.status(500).json({ error: 'Failed to revoke token' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Token not found' });
      }
      
      res.json({ success: true });
    }
  );
});

app.listen(config.port, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 EMPLOYEE HOUR TRACKER v${packageJson.version} STARTED`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Server is running on port ${config.port}`);
  console.log(`${'='.repeat(60)}`);
  console.log('=== Environment Configuration ===');
  console.log(`VERSION: ${packageJson.version}`);
  console.log(`NODE_ENV: ${config.nodeEnv}`);
  console.log(`PORT: ${config.port}`);
  console.log(`DB_PATH: ${config.dbPath}`);
  console.log(`BASE_URL: ${config.baseUrl || 'Not set (using auto-detect)'}`);
  console.log(`SESSION_SECRET: [SET]`);
  console.log(`DEFAULT_ADMIN_USERNAME: [SET]`);
  console.log(`DEFAULT_ADMIN_PASSWORD: [SET]`);
  console.log(`DEBUG_LOGS: ${config.enableDebugLogs ? '🐛 ENABLED' : '❌ DISABLED'}`);
  console.log('=== All Environment Variables ===');
  Object.keys(process.env)
    .filter(key => key.startsWith('NODE_') || key.startsWith('DB_') || key.startsWith('SESSION_') || key.startsWith('DEFAULT_') || key.startsWith('BACKUP_'))
    .forEach(key => {
      const value = key.includes('SECRET') || key.includes('PASSWORD') 
        ? '[HIDDEN]' 
        : process.env[key];
      console.log(`${key}: ${value}`);
    });
  console.log('================================');
  
  // Start automatic backup system
  backup.startBackupScheduler();
});