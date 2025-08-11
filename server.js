const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const Json2csvParser = require('json2csv').Parser;
const path = require('path');
const backup = require('./backup');
const packageJson = require('./package.json');

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
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

const db = new sqlite3.Database(config.dbPath);

// Database migration function for v1.1.0
function migrateDatabase() {
  db.serialize(() => {
    // Check if migration is needed by checking column defaults
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='time_entries'`, (err, row) => {
      if (row && row.sql && row.sql.includes("DEFAULT 'Not Entered'")) {
        console.log('Migrating database to v1.1.0 - Adding Empty status...');
        
        // Create a new table with the updated schema
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
          if (!err) {
            // Copy existing data
            db.run(`INSERT INTO time_entries_new SELECT * FROM time_entries`, (err) => {
              if (!err) {
                // Drop old table and rename new one
                db.run(`DROP TABLE time_entries`, (err) => {
                  if (!err) {
                    db.run(`ALTER TABLE time_entries_new RENAME TO time_entries`, (err) => {
                      if (!err) {
                        console.log('Database migration completed successfully!');
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  });
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

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
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
  res.json({ version: packageJson.version });
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
  
  // Prevent caching of time entries data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  const query = `
    SELECT e.id, e.name, 
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
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/time-entries', requireAuth, (req, res) => {
  const { employeeId, weekStart, day, status } = req.body;
  
  const query = `
    INSERT INTO time_entries (employee_id, week_start, ${day}) 
    VALUES (?, ?, ?)
    ON CONFLICT(employee_id, week_start) 
    DO UPDATE SET ${day} = ?, updated_at = CURRENT_TIMESTAMP
  `;
  
  db.run(query, [employeeId, weekStart, status, status], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

app.get('/api/analytics/summary', (req, res) => {
  const { startDate, endDate } = req.query;
  
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
  
  const query = `
    SELECT 
      COUNT(DISTINCT e.id) as total_employees,
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
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id
    ${dateFilter}
  `;
  
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.get('/api/analytics/by-employee', (req, res) => {
  const { startDate, endDate } = req.query;
  
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
  
  const query = `
    SELECT 
      e.name,
      SUM(CASE WHEN te.monday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Empty' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Empty' THEN 1 ELSE 0 END) as empty,
      SUM(CASE WHEN te.monday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Entered' THEN 1 ELSE 0 END) as entered,
      SUM(CASE WHEN te.monday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Not Entered' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Not Entered' THEN 1 ELSE 0 END) as not_entered,
      SUM(CASE WHEN te.monday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.tuesday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.wednesday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.thursday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.friday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.saturday = 'Incorrect' THEN 1 ELSE 0 END +
          CASE WHEN te.sunday = 'Incorrect' THEN 1 ELSE 0 END) as incorrect
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id
    ${dateFilter}
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