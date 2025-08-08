const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const config = {
  dbPath: process.env.DB_PATH || './employee_tracker.db',
  backupDir: process.env.BACKUP_DIR || (process.env.NODE_ENV === 'production' ? '/app/backups' : './backups'),
  backupInterval: parseInt(process.env.BACKUP_INTERVAL_HOURS || '24') * 60 * 60 * 1000, // Convert hours to ms
  maxBackups: parseInt(process.env.MAX_BACKUPS || '7') // Keep 7 backups by default
};

function createBackup() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }

    // Check if database exists
    if (!fs.existsSync(config.dbPath)) {
      console.log('Database file not found, skipping backup');
      return;
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(config.backupDir, `employee_tracker_backup_${timestamp}.db`);

    // Copy database file
    fs.copyFileSync(config.dbPath, backupPath);
    console.log(`Backup created: ${backupPath}`);

    // Clean up old backups
    cleanupOldBackups();
  } catch (error) {
    console.error('Backup failed:', error);
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(config.backupDir)
      .filter(file => file.startsWith('employee_tracker_backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(config.backupDir, file),
        time: fs.statSync(path.join(config.backupDir, file)).mtime
      }))
      .sort((a, b) => b.time - a.time); // Sort by modification time, newest first

    // Keep only maxBackups files
    const filesToDelete = files.slice(config.maxBackups);
    
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    });

    console.log(`Backup cleanup complete. Keeping ${Math.min(files.length, config.maxBackups)} backups.`);
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
}

function startBackupScheduler() {
  console.log('=== Backup Configuration ===');
  console.log(`Database Path: ${config.dbPath}`);
  console.log(`Backup Directory: ${config.backupDir}`);
  console.log(`Backup Interval: ${config.backupInterval / (60 * 60 * 1000)} hours`);
  console.log(`Max Backups: ${config.maxBackups}`);
  console.log('============================');

  // Create initial backup
  createBackup();

  // Schedule periodic backups
  setInterval(createBackup, config.backupInterval);
  console.log('Backup scheduler started');
}

// Export functions for use in main server
module.exports = {
  createBackup,
  startBackupScheduler,
  cleanupOldBackups
};

// If run directly (not imported), start the backup scheduler
if (require.main === module) {
  startBackupScheduler();
}