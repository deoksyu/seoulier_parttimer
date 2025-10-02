const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = process.env.DATABASE_PATH || './database.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database:', dbPath);
    initDatabase();
  }
});

// Initialize database
function initDatabase() {
  // Create users table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }
    
    // Create shifts table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        work_hours REAL,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating shifts table:', err);
        return;
      }
      
      // Check if admin user exists
      db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
          console.error('Error checking admin:', err);
          return;
        }
        
        // Insert test users only if they don't exist
        if (!row) {
          // 관리자 계정
          db.run(`INSERT INTO users (username, password, name, role) VALUES ('admin', 'admin', '관리자', 'admin')`, (err) => {
            if (err) console.error('Error inserting admin:', err);
          });
          
          // 알바생 계정 8명
          const staffMembers = [
            { username: 'st01', password: 'st01', name: '이수진' },
            { username: 'st02', password: 'st02', name: '배경현' },
            { username: 'st03', password: 'st03', name: '채윤아' },
            { username: 'st04', password: 'st04', name: '황성윤' },
            { username: 'st05', password: 'st05', name: '임수민' },
            { username: 'st06', password: 'st06', name: '김태오' },
            { username: 'st07', password: 'st07', name: '웅' },
            { username: 'st08', password: 'st08', name: '김채원' }
          ];
          
          staffMembers.forEach((staff, index) => {
            db.run(
              `INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'staff')`,
              [staff.username, staff.password, staff.name],
              (err) => {
                if (err) console.error(`Error inserting ${staff.username}:`, err);
                if (index === staffMembers.length - 1) {
                  console.log('✅ Test users created:');
                  console.log('   관리자: admin / admin');
                  console.log('   알바생: st01~st08 / st01~st08');
                }
              }
            );
          });
        } else {
          console.log('✅ Database already initialized');
        }
      });
    });
  });
}

// API Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 잘못되었습니다' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  });
});

// Clock in
app.post('/api/clock-in', (req, res) => {
  const { userId } = req.body;
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  
  // Check if already clocked in today
  db.get('SELECT * FROM shifts WHERE user_id = ? AND date = ? AND end_time IS NULL', [userId, date], (err, shift) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (shift) {
      return res.status(400).json({ success: false, message: '이미 출근 처리되었습니다' });
    }
    
    db.run('INSERT INTO shifts (user_id, date, start_time) VALUES (?, ?, ?)', [userId, date, time], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      res.json({
        success: true,
        shift: {
          id: this.lastID,
          date,
          start_time: time
        }
      });
    });
  });
});

// Calculate work hours
function calculateWorkHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const diffMinutes = endMinutes - startMinutes;
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  // 30분 기준 반올림 (0-29분 = 0, 30-59분 = 0.5)
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}

// Clock out
app.post('/api/clock-out', (req, res) => {
  const { userId } = req.body;
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  
  db.get('SELECT * FROM shifts WHERE user_id = ? AND date = ? AND end_time IS NULL', [userId, date], (err, shift) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!shift) {
      return res.status(400).json({ success: false, message: '출근 기록이 없습니다' });
    }
    
    const workHours = calculateWorkHours(shift.start_time, time);
    
    db.run('UPDATE shifts SET end_time = ?, work_hours = ? WHERE id = ?', [time, workHours, shift.id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      res.json({
        success: true,
        shift: {
          id: shift.id,
          date: shift.date,
          start_time: shift.start_time,
          end_time: time,
          work_hours: workHours
        }
      });
    });
  });
});

// Get shifts
app.get('/api/shifts', (req, res) => {
  const { userId, role } = req.query;
  
  let query = `
    SELECT s.*, u.name, u.username 
    FROM shifts s 
    JOIN users u ON s.user_id = u.id
  `;
  let params = [];
  
  if (role === 'staff') {
    query += ' WHERE s.user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY s.date DESC, s.start_time DESC';
  
  db.all(query, params, (err, shifts) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    res.json({
      success: true,
      shifts
    });
  });
});

// Approve shift
app.put('/api/shifts/:id/approve', (req, res) => {
  const { id } = req.params;
  
  db.run('UPDATE shifts SET status = ? WHERE id = ?', ['approved', id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    res.json({
      success: true,
      message: '승인되었습니다'
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
