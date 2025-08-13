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
  baseUrl: process.env.BASE_URL || null // If not set, frontend will use window.location.origin
};

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
    secure: false, // Always false for development and Docker
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

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
    baseUrl: config.baseUrl
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

app.get('/api/time-entries/:weekStart', (req, res) => {
  const { weekStart } = req.params;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const timestamp = new Date().toISOString();
  
  // DEBUG LOGGING
  console.log('\n🐛 DEBUG - GET /api/time-entries/:weekStart');
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Client IP: ${clientIP}`);
  console.log(`  User-Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`  Requested week_start: "${weekStart}"`);
  console.log(`  Query: SELECT ... FROM employees e LEFT JOIN time_entries te ON e.id = te.employee_id AND te.week_start = '${weekStart}'`);
  
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
      console.log(`  ERROR: ${err.message}`);
      res.status(500).json({ error: err.message });
      return;
    }
    
    console.log(`  Found ${rows.length} employee records:`);
    rows.forEach((row, i) => {
      console.log(`    [${i}] ${row.name} - week_start: ${row.week_start || 'NULL'} - Mon=${row.monday}, Tue=${row.tuesday}`);
    });
    console.log('🐛 DEBUG - GET /api/time-entries complete\n');
    
    res.json(rows);
  });
});

app.post('/api/time-entries', requireAuth, (req, res) => {
  const { employeeId, weekStart, day, status } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const timestamp = new Date().toISOString();
  
  // DEBUG LOGGING
  console.log('\n🐛 DEBUG - POST /api/time-entries');
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Client IP: ${clientIP}`);
  console.log(`  Employee ID: ${employeeId}`);
  console.log(`  Week start: "${weekStart}"`);
  console.log(`  Day: ${day}`);
  console.log(`  Status: ${status}`);
  console.log(`  Query: INSERT INTO time_entries (employee_id, week_start, ${day}) VALUES (${employeeId}, '${weekStart}', '${status}')`);
  console.log(`         ON CONFLICT(employee_id, week_start) DO UPDATE SET ${day} = '${status}', updated_at = CURRENT_TIMESTAMP`);
  
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

// Route handlers for direct page access
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tracking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/management', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api-docs', requireAuth, (req, res) => {
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
  console.log(`\n🚀 Employee Hour Tracker v${packageJson.version}`);
  console.log(`Server is running on port ${config.port}`);
  console.log('=== Environment Configuration ===');
  console.log(`VERSION: ${packageJson.version}`);
  console.log(`NODE_ENV: ${config.nodeEnv}`);
  console.log(`PORT: ${config.port}`);
  console.log(`DB_PATH: ${config.dbPath}`);
  console.log(`BASE_URL: ${config.baseUrl || 'Not set (using auto-detect)'}`);
  console.log(`SESSION_SECRET: ${config.sessionSecret.substring(0, 10)}...`);
  console.log(`DEFAULT_ADMIN_USERNAME: ${config.defaultAdminUsername}`);
  console.log(`DEFAULT_ADMIN_PASSWORD: [SET]`);
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