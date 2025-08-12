const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./employee_tracker.db');

// Test employees
const testEmployees = [
  'John Smith',
  'Jane Doe', 
  'Mike Johnson',
  'Sarah Williams',
  'Tom Brown',
  'Emily Davis',
  'Robert Wilson',
  'Lisa Anderson'
];

// Generate random status
function getRandomStatus() {
  const statuses = ['Empty', 'Not Entered', 'Entered', 'Incorrect'];
  const weights = [0.3, 0.2, 0.4, 0.1]; // Weighted distribution
  const random = Math.random();
  let sum = 0;
  
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (random < sum) return statuses[i];
  }
  return statuses[0];
}

// Get Monday of a week containing the given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

async function populateTestData() {
  console.log('Starting test data population...');
  
  // Clear existing data
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM time_entries', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM employees', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  console.log('Cleared existing data');
  
  // Insert test employees
  const employeeIds = [];
  for (const name of testEmployees) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO employees (name, created_at) VALUES (?, datetime("now"))',
        [name],
        function(err) {
          if (err) reject(err);
          else {
            employeeIds.push(this.lastID);
            console.log(`Added employee: ${name} (ID: ${this.lastID})`);
            resolve();
          }
        }
      );
    });
  }
  
  // Generate time entries for the last 12 weeks
  const today = new Date();
  const weeks = [];
  
  for (let i = 0; i < 12; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - (i * 7));
    weeks.push(getWeekStart(weekDate));
  }
  
  console.log('\nGenerating time entries for weeks:', weeks);
  
  // Create time entries
  let totalEntries = 0;
  for (const weekStart of weeks) {
    // Randomly skip some employees some weeks (to simulate real data)
    const participatingEmployees = employeeIds.filter(() => Math.random() > 0.1);
    
    for (const employeeId of participatingEmployees) {
      const entry = {
        employeeId,
        weekStart,
        monday: getRandomStatus(),
        tuesday: getRandomStatus(),
        wednesday: getRandomStatus(),
        thursday: getRandomStatus(),
        friday: getRandomStatus(),
        saturday: getRandomStatus(),
        sunday: getRandomStatus()
      };
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO time_entries (employee_id, week_start, monday, tuesday, wednesday, thursday, friday, saturday, sunday)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.employeeId, entry.weekStart, entry.monday, entry.tuesday, entry.wednesday, entry.thursday, entry.friday, entry.saturday, entry.sunday],
          (err) => {
            if (err) reject(err);
            else {
              totalEntries++;
              resolve();
            }
          }
        );
      });
    }
  }
  
  console.log(`\nCreated ${totalEntries} time entries`);
  
  // Show sample analytics
  console.log('\n=== Sample Analytics ===');
  
  // Overall stats
  await new Promise((resolve) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT employee_id) as unique_employees,
        COUNT(DISTINCT week_start) as unique_weeks,
        COUNT(*) as total_records,
        SUM(CASE WHEN monday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN tuesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN wednesday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN thursday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN friday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN saturday = 'Empty' THEN 1 ELSE 0 END +
            CASE WHEN sunday = 'Empty' THEN 1 ELSE 0 END) as total_empty,
        SUM(CASE WHEN monday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN tuesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN wednesday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN thursday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN friday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN saturday = 'Entered' THEN 1 ELSE 0 END +
            CASE WHEN sunday = 'Entered' THEN 1 ELSE 0 END) as total_entered,
        SUM(CASE WHEN monday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN tuesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN wednesday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN thursday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN friday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN saturday = 'Not Entered' THEN 1 ELSE 0 END +
            CASE WHEN sunday = 'Not Entered' THEN 1 ELSE 0 END) as total_not_entered,
        SUM(CASE WHEN monday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN tuesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN wednesday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN thursday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN friday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN saturday = 'Incorrect' THEN 1 ELSE 0 END +
            CASE WHEN sunday = 'Incorrect' THEN 1 ELSE 0 END) as total_incorrect
      FROM time_entries
    `, (err, row) => {
      if (err) console.error(err);
      else {
        console.log('\nDatabase Summary:');
        console.log(`- Unique employees with entries: ${row.unique_employees}`);
        console.log(`- Unique weeks with entries: ${row.unique_weeks}`);
        console.log(`- Total time entry records: ${row.total_records}`);
        console.log(`- Total individual day entries: ${row.total_records * 7}`);
        console.log('\nStatus Distribution:');
        console.log(`- Empty: ${row.total_empty}`);
        console.log(`- Entered: ${row.total_entered}`);
        console.log(`- Not Entered: ${row.total_not_entered}`);
        console.log(`- Incorrect: ${row.total_incorrect}`);
        console.log(`- Total: ${row.total_empty + row.total_entered + row.total_not_entered + row.total_incorrect}`);
      }
      resolve();
    });
  });
  
  // Show sample week data
  const latestWeek = weeks[0];
  console.log(`\n=== Sample Week Data (${latestWeek}) ===`);
  
  await new Promise((resolve) => {
    db.all(`
      SELECT e.name, te.*
      FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
      WHERE te.week_start = ?
      ORDER BY e.name
    `, [latestWeek], (err, rows) => {
      if (err) console.error(err);
      else {
        rows.forEach(row => {
          console.log(`${row.name}: Mon=${row.monday}, Tue=${row.tuesday}, Wed=${row.wednesday}, Thu=${row.thursday}, Fri=${row.friday}`);
        });
      }
      resolve();
    });
  });
  
  console.log('\n✅ Test data population complete!');
  console.log('You can now test the analytics page with various date ranges.');
  
  db.close();
}

populateTestData().catch(console.error);