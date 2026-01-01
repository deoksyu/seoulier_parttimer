const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
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
      role TEXT NOT NULL,
      pin TEXT,
      phone TEXT,
      email TEXT,
      workplace TEXT,
      position TEXT,
      hire_date TEXT,
      hourly_wage REAL,
      memo TEXT,
      regular_start_time TEXT
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
        is_modified INTEGER DEFAULT 0,
        is_late INTEGER DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        late_exempt INTEGER DEFAULT 0,
        late_note TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating shifts table:', err);
        return;
      }
      
      // Add columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE shifts ADD COLUMN is_modified INTEGER DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE shifts ADD COLUMN is_late INTEGER DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE shifts ADD COLUMN late_minutes INTEGER DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE shifts ADD COLUMN late_exempt INTEGER DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE shifts ADD COLUMN late_note TEXT`, (err) => {});
      
      db.run(`ALTER TABLE users ADD COLUMN pin TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN workplace TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN position TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN hire_date TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN hourly_wage REAL`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN memo TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN regular_start_time TEXT`, (err) => {});
      db.run(`ALTER TABLE users ADD COLUMN health_certificate_expiry TEXT`, (err) => {});
      
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

// Health check endpoint (for monitoring services)
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbPath
  });
});

// Login with PIN
app.post('/api/login-pin', (req, res) => {
  const { pin } = req.body;
  
  if (!pin || pin.length !== 4) {
    return res.status(400).json({ success: false, message: 'PIN 번호 4자리를 입력해주세요' });
  }
  
  db.get('SELECT * FROM users WHERE pin = ?', [pin], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'PIN 번호가 일치하지 않습니다' });
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
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  // Use ISO format for time (HH:MM:SS)
  const time = now.toTimeString().split(' ')[0]; // Gets "HH:MM:SS"
  
  // Check if already clocked in today
  db.get('SELECT * FROM shifts WHERE user_id = ? AND date = ? AND end_time IS NULL', [userId, date], (err, shift) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (shift) {
      return res.status(400).json({ success: false, message: '이미 출근 처리되었습니다' });
    }
    
    // Get user's regular start time for late check
    db.get('SELECT regular_start_time FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      let isLate = 0;
      let lateMinutes = 0;
      
      // Check if late
      if (user && user.regular_start_time) {
        console.log('Regular start time:', user.regular_start_time);
        console.log('Actual clock-in time:', time);
        
        const regularParts = user.regular_start_time.split(':');
        const actualParts = time.split(':');
        
        const regularHour = parseInt(regularParts[0]);
        const regularMin = parseInt(regularParts[1]);
        const actualHour = parseInt(actualParts[0]);
        const actualMin = parseInt(actualParts[1]);
        
        const regularMinutes = regularHour * 60 + regularMin;
        const actualMinutes = actualHour * 60 + actualMin;
        
        console.log('Regular minutes:', regularMinutes, 'Actual minutes:', actualMinutes);
        
        if (actualMinutes > regularMinutes) {
          isLate = 1;
          lateMinutes = actualMinutes - regularMinutes;
          console.log('LATE! Minutes late:', lateMinutes);
        } else {
          console.log('On time or early');
        }
      } else {
        console.log('No regular start time set for user');
      }
      
      db.run(
        'INSERT INTO shifts (user_id, date, start_time, is_late, late_minutes) VALUES (?, ?, ?, ?, ?)',
        [userId, date, time, isLate, lateMinutes],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          res.json({
            success: true,
            shift: {
              id: this.lastID,
              date,
              start_time: time,
              is_late: isLate,
              late_minutes: lateMinutes
            }
          });
        }
      );
    });
  });
});

// Calculate work hours
function calculateWorkHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  
  // 10:00 이전 출근은 10:00으로 보정
  const workStartThreshold = 10 * 60;  // 600분 (10:00)
  
  if (startMinutes < workStartThreshold) {
    startMinutes = workStartThreshold;
  }
  
  // 퇴근도 10:00 이전이면 근무시간 0
  if (endMinutes < workStartThreshold) {
    return 0;
  }
  
  let diffMinutes = endMinutes - startMinutes;
  
  // 휴게시간 15:00~17:00 (900분~1020분) 체크
  const breakStart = 15 * 60; // 900분 (15:00)
  const breakEnd = 17 * 60;   // 1020분 (17:00)
  
  // 근무 시간이 휴게시간과 겹치는지 확인
  if (startMinutes < breakEnd && endMinutes > breakStart) {
    // 휴게시간이 근무 시간에 포함됨
    const overlapStart = Math.max(startMinutes, breakStart);
    const overlapEnd = Math.min(endMinutes, breakEnd);
    const overlapMinutes = overlapEnd - overlapStart;
    
    // 겹치는 휴게시간만큼 차감
    diffMinutes -= overlapMinutes;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  // 30분 기준 반올림 (0-29분 = 0, 30-59분 = 0.5)
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}

// Clock out
app.post('/api/clock-out', (req, res) => {
  const { userId } = req.body;
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  // Use ISO format for time (HH:MM:SS)
  const time = now.toTimeString().split(' ')[0]; // Gets "HH:MM:SS"
  
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
  const { userId, role, month, staffId } = req.query;
  
  let query = `
    SELECT s.*, u.name, u.username, u.pin, u.workplace 
    FROM shifts s 
    JOIN users u ON s.user_id = u.id
  `;
  let params = [];
  let conditions = [];
  
  // Role-based filtering
  if (role === 'staff') {
    conditions.push('s.user_id = ?');
    params.push(userId);
  } else if (role === 'admin' && staffId && staffId !== 'all') {
    // Admin filtering by specific staff
    conditions.push('s.user_id = ?');
    params.push(staffId);
  }
  
  // Month filtering
  if (month) {
    conditions.push('s.date LIKE ?');
    params.push(`${month}%`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
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

// Create manual shift (admin only)
app.post('/api/shifts/manual', (req, res) => {
  const { user_id, date, start_time, end_time } = req.body;
  
  // Validation
  if (!user_id || !date || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요' });
  }
  
  // Check if shift already exists for this user on this date
  db.get('SELECT id FROM shifts WHERE user_id = ? AND date = ?', [user_id, date], (err, existingShift) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (existingShift) {
      return res.status(400).json({ success: false, message: '해당 날짜에 이미 출근 기록이 있습니다' });
    }
    
    // Calculate work hours
    const workHours = calculateWorkHours(start_time, end_time);
    
    // Get user's regular start time for late check
    db.get('SELECT regular_start_time FROM users WHERE id = ?', [user_id], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      let isLate = 0;
      let lateMinutes = 0;
      
      // Check if late
      if (user && user.regular_start_time) {
        const regularParts = user.regular_start_time.split(':');
        const actualParts = start_time.split(':');
        
        const regularHour = parseInt(regularParts[0]);
        const regularMin = parseInt(regularParts[1]);
        const actualHour = parseInt(actualParts[0]);
        const actualMin = parseInt(actualParts[1]);
        
        const regularMinutes = regularHour * 60 + regularMin;
        const actualMinutes = actualHour * 60 + actualMin;
        
        if (actualMinutes > regularMinutes) {
          isLate = 1;
          lateMinutes = actualMinutes - regularMinutes;
        }
      }
      
      // Insert shift with approved status and modified flag
      db.run(
        'INSERT INTO shifts (user_id, date, start_time, end_time, work_hours, status, is_modified, is_late, late_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user_id, date, start_time, end_time, workHours, 'approved', 1, isLate, lateMinutes],
        function(err) {
          if (err) {
            console.error('Insert error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          res.json({
            success: true,
            message: '출근 기록이 추가되었습니다',
            shift: {
              id: this.lastID,
              user_id,
              date,
              start_time,
              end_time,
              work_hours: workHours,
              status: 'approved',
              is_modified: 1,
              is_late: isLate,
              late_minutes: lateMinutes
            }
          });
        }
      );
    });
  });
});

// Update shift
app.put('/api/shifts/:id', (req, res) => {
  const { id } = req.params;
  const { start_time, end_time, work_hours } = req.body;
  
  // Get shift info to recalculate late status
  db.get('SELECT user_id FROM shifts WHERE id = ?', [id], (err, shift) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }
    
    // Get user's regular start time
    db.get('SELECT regular_start_time FROM users WHERE id = ?', [shift.user_id], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      let isLate = 0;
      let lateMinutes = 0;
      
      // Recalculate late status based on new start_time
      if (user && user.regular_start_time && start_time) {
        const regularParts = user.regular_start_time.split(':');
        const actualParts = start_time.split(':');
        
        const regularHour = parseInt(regularParts[0]);
        const regularMin = parseInt(regularParts[1]);
        const actualHour = parseInt(actualParts[0]);
        const actualMin = parseInt(actualParts[1]);
        
        const regularMinutes = regularHour * 60 + regularMin;
        const actualMinutes = actualHour * 60 + actualMin;
        
        if (actualMinutes > regularMinutes) {
          isLate = 1;
          lateMinutes = actualMinutes - regularMinutes;
        }
      }
      
      // Update shift with recalculated late status
      db.run(
        'UPDATE shifts SET start_time = ?, end_time = ?, work_hours = ?, is_modified = 1, is_late = ?, late_minutes = ? WHERE id = ?',
        [start_time, end_time, work_hours, isLate, lateMinutes, id],
        (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          res.json({
            success: true,
            message: '수정되었습니다'
          });
        }
      );
    });
  });
});

// Toggle late exempt (지각 면제)
app.put('/api/shifts/:id/late-exempt', (req, res) => {
  const { id } = req.params;
  const { late_exempt, late_note } = req.body;
  
  db.run(
    'UPDATE shifts SET late_exempt = ?, late_note = ? WHERE id = ?',
    [late_exempt ? 1 : 0, late_note || null, id],
    (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      res.json({
        success: true,
        message: late_exempt ? '지각이 면제되었습니다' : '지각 면제가 취소되었습니다'
      });
    }
  );
});

// Delete shift
app.delete('/api/shifts/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM shifts WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    res.json({
      success: true,
      message: '삭제되었습니다'
    });
  });
});

// Get statistics by user
app.get('/api/statistics', (req, res) => {
  const { month } = req.query;
  
  let query = `
    SELECT 
      u.id,
      u.name,
      u.username,
      COUNT(DISTINCT s.date) as shift_count,
      SUM(CASE WHEN s.work_hours IS NOT NULL THEN s.work_hours ELSE 0 END) as total_hours,
      SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) as approved_count
    FROM users u
    LEFT JOIN shifts s ON u.id = s.user_id
    WHERE u.role = 'staff'
  `;
  
  if (month) {
    query += ` AND s.date LIKE '${month}%'`;
  }
  
  query += ' GROUP BY u.id, u.name, u.username ORDER BY u.id';
  
  db.all(query, [], (err, stats) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    
    res.json({
      success: true,
      statistics: stats
    });
  });
});

// ==================== HR MANAGEMENT ====================

// Get all employees
app.get('/api/employees', (req, res) => {
  db.all(
    'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo, workplace, position, regular_start_time, health_certificate_expiry FROM users WHERE role != ?',
    ['admin'],
    (err, employees) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, employees });
    }
  );
});

// Get employee by ID
app.get('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo, workplace, position, regular_start_time, health_certificate_expiry FROM users WHERE id = ?',
    [id],
    (err, employee) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
      res.json({ success: true, employee });
    }
  );
});

// Update employee
app.put('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, email, hire_date, hourly_wage, memo, pin, workplace, position, regular_start_time, health_certificate_expiry } = req.body;
  
  // 유효성 검사
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: '이름은 필수입니다' });
  }
  
  // PIN 유효성 검사 및 중복 체크
  if (pin) {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN은 4자리 숫자여야 합니다' });
    }
    
    // PIN 중복 체크 (다른 사용자가 같은 PIN을 사용하는지 확인)
    db.get('SELECT id FROM users WHERE pin = ? AND id != ?', [pin, id], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (existingUser) {
        return res.status(400).json({ success: false, message: '이미 사용 중인 PIN입니다' });
      }
      
      // PIN 중복이 없으면 업데이트 진행
      updateEmployee();
    });
  } else {
    // PIN이 없으면 바로 업데이트
    updateEmployee();
  }
  
  function updateEmployee() {
    db.run(
      'UPDATE users SET name = ?, phone = ?, email = ?, hire_date = ?, hourly_wage = ?, memo = ?, pin = ?, workplace = ?, position = ?, regular_start_time = ?, health_certificate_expiry = ? WHERE id = ?',
      [name, phone, email, hire_date, hourly_wage, memo, pin || null, workplace || null, position || null, regular_start_time || null, health_certificate_expiry || null, id],
      function(err) {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: '직원을 찾을 수 없습니다' });
        }
        
        res.json({ success: true, message: '직원 정보가 수정되었습니다' });
      }
    );
  }
});

// ==================== CLEANING MANAGEMENT ====================

// Get cleaning tasks
app.get('/api/cleaning-tasks', (req, res) => {
  const { date } = req.query;
  
  db.all(
    'SELECT * FROM cleaning_tasks WHERE is_active = 1 ORDER BY order_num',
    [],
    (err, tasks) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (!date) {
        return res.json({ success: true, tasks });
      }
      
      // Get check status for the date
      db.all(
        `SELECT dc.*, u.name as checked_by_name 
         FROM daily_cleanings dc 
         LEFT JOIN users u ON dc.checked_by = u.id 
         WHERE dc.date = ?`,
        [date],
        (err, checks) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          const tasksWithStatus = tasks.map(task => {
            const check = checks.find(c => c.task_id === task.id);
            return {
              ...task,
              checked: !!check,
              check_level: check ? (check.check_level || 1) : 0,
              checked_by: check ? check.checked_by : null,
              checked_by_name: check ? check.checked_by_name : null,
              checked_at: check ? check.checked_at : null
            };
          });
          
          res.json({ success: true, tasks: tasksWithStatus });
        }
      );
    }
  );
});

// Toggle cleaning check (supports double check)
app.post('/api/cleaning-check', (req, res) => {
  const { taskId, date, userId } = req.body;
  
  // Check if already checked
  db.get(
    'SELECT * FROM daily_cleanings WHERE task_id = ? AND date = ?',
    [taskId, date],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (existing) {
        const currentLevel = existing.check_level || 1;
        
        if (currentLevel === 1) {
          // Upgrade to level 2 (red check)
          const now = new Date();
          const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString();
          db.run(
            'UPDATE daily_cleanings SET check_level = 2, checked_by = ?, checked_at = ? WHERE task_id = ? AND date = ?',
            [userId, kstTime, taskId, date],
            (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
              }
              res.json({ success: true, checked: true, level: 2 });
            }
          );
        } else {
          // Uncheck (remove)
          db.run(
            'DELETE FROM daily_cleanings WHERE task_id = ? AND date = ?',
            [taskId, date],
            (err) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
              }
              res.json({ success: true, checked: false, level: 0 });
            }
          );
        }
      } else {
        // First check (level 1 - green)
        const now = new Date();
        const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString();
        db.run(
          'INSERT INTO daily_cleanings (task_id, date, checked_by, checked_at, check_level) VALUES (?, ?, ?, ?, 1)',
          [taskId, date, userId, kstTime],
          (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, checked: true, level: 1 });
          }
        );
      }
    }
  );
});

// Get cleaning stats
app.get('/api/cleaning-stats', (req, res) => {
  const { date } = req.query;
  
  if (!date) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }
  
  db.get(
    'SELECT COUNT(*) as total FROM cleaning_tasks WHERE is_active = 1',
    [],
    (err, totalResult) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      db.get(
        'SELECT COUNT(*) as completed FROM daily_cleanings WHERE date = ?',
        [date],
        (err, completedResult) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          const total = totalResult.total;
          const completed = completedResult.completed;
          const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          res.json({
            success: true,
            stats: {
              total,
              completed,
              completion_rate
            }
          });
        }
      );
    }
  );
});

// Get admin cleaning stats (calendar view)
app.get('/api/admin-cleaning-stats', (req, res) => {
  const { month } = req.query;
  
  if (!month) {
    return res.status(400).json({ success: false, message: 'Month is required' });
  }
  
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;
  
  // Get daily stats
  db.all(
    `SELECT 
      dc.date,
      COUNT(DISTINCT dc.task_id) as completed_count,
      u.name as checked_by_name
    FROM daily_cleanings dc
    LEFT JOIN users u ON dc.checked_by = u.id
    WHERE dc.date BETWEEN ? AND ?
    GROUP BY dc.date
    ORDER BY dc.date`,
    [startDate, endDate],
    (err, dailyStats) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      // Get total tasks count
      db.get(
        'SELECT COUNT(*) as total FROM cleaning_tasks WHERE is_active = 1',
        [],
        (err, totalResult) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          const totalTasks = totalResult.total;
          
          const statsWithRate = dailyStats.map(day => ({
            ...day,
            total_tasks: totalTasks,
            completion_rate: totalTasks > 0 ? Math.round((day.completed_count / totalTasks) * 100) : 0
          }));
          
          // Calculate monthly average completion rate
          const monthlyCompletionRate = statsWithRate.length > 0
            ? Math.round(statsWithRate.reduce((sum, day) => sum + day.completion_rate, 0) / statsWithRate.length)
            : 0;
          
          // Calculate consecutive days (100% completion)
          let consecutiveDays = 0;
          const sortedStats = [...statsWithRate].sort((a, b) => b.date.localeCompare(a.date)); // Sort descending
          for (const stat of sortedStats) {
            if (stat.completion_rate === 100) {
              consecutiveDays++;
            } else {
              break;
            }
          }
          
          res.json({
            success: true,
            stats: statsWithRate,
            monthlyCompletionRate,
            consecutiveDays
          });
        }
      );
    }
  );
});

// Get admin cleaning detail for a specific date
app.get('/api/admin-cleaning-detail/:date', (req, res) => {
  const { date } = req.params;
  
  // Get all tasks with their completion status for the date
  db.all(
    `SELECT 
      ct.id,
      ct.title,
      ct.category,
      ct.order_num,
      CASE WHEN dc.id IS NOT NULL THEN 1 ELSE 0 END as is_checked,
      dc.check_level,
      dc.checked_at,
      u.name as checked_by_name
    FROM cleaning_tasks ct
    LEFT JOIN daily_cleanings dc ON ct.id = dc.task_id AND dc.date = ?
    LEFT JOIN users u ON dc.checked_by = u.id
    WHERE ct.is_active = 1
    ORDER BY ct.order_num`,
    [date],
    (err, tasks) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      res.json({
        success: true,
        tasks: tasks
      });
    }
  );
});

// Add cleaning task
app.post('/api/cleaning-tasks', (req, res) => {
  const { title, category } = req.body;
  
  // Get max order_num
  db.get(
    'SELECT MAX(order_num) as max_order FROM cleaning_tasks',
    [],
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      const orderNum = (result.max_order || 0) + 1;
      
      db.run(
        'INSERT INTO cleaning_tasks (title, category, order_num, is_active) VALUES (?, ?, ?, 1)',
        [title, category, orderNum],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          res.json({
            success: true,
            task: {
              id: this.lastID,
              title,
              category,
              order_num: orderNum,
              is_active: 1
            }
          });
        }
      );
    }
  );
});

// Delete cleaning task
app.delete('/api/cleaning-tasks/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(
    'UPDATE cleaning_tasks SET is_active = 0 WHERE id = ?',
    [id],
    (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// Get weekly cleaning tasks with current week status
app.get('/api/cleaning/weekly-tasks', (req, res) => {
  // Get unique task names
  db.all(
    'SELECT DISTINCT task_name FROM weekly_cleanings ORDER BY task_name',
    [],
    (err, taskNames) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      // Get current week start (Monday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      const weekStart = monday.toISOString().split('T')[0];
      
      // Get checks for current week
      db.all(
        'SELECT * FROM weekly_cleanings WHERE week_start = ?',
        [weekStart],
        (err, checks) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          const tasks = taskNames.map((tn, index) => {
            const check = checks.find(c => c.task_name === tn.task_name);
            return {
              id: index + 1,
              task_name: tn.task_name,
              checked: check ? check.checked : 0,
              checked_by: check ? check.checked_by : null,
              checked_at: check ? check.checked_at : null,
              week_start: weekStart
            };
          });
          
          res.json({ success: true, tasks });
        }
      );
    }
  );
});

// Get monthly cleaning tasks with current month status
app.get('/api/cleaning/monthly-tasks', (req, res) => {
  // Get unique task names
  db.all(
    'SELECT DISTINCT task_name FROM monthly_cleanings ORDER BY task_name',
    [],
    (err, taskNames) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      // Get current month (YYYY-MM)
      const today = new Date();
      const month = today.toISOString().substring(0, 7);
      
      // Get checks for current month
      db.all(
        'SELECT * FROM monthly_cleanings WHERE month = ?',
        [month],
        (err, checks) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
          }
          
          const tasks = taskNames.map((tn, index) => {
            const check = checks.find(c => c.task_name === tn.task_name);
            return {
              id: index + 1,
              task_name: tn.task_name,
              checked: check ? check.checked : 0,
              checked_by: check ? check.checked_by : null,
              checked_at: check ? check.checked_at : null,
              month: month
            };
          });
          
          res.json({ success: true, tasks });
        }
      );
    }
  );
});

// Toggle weekly cleaning
app.post('/api/cleaning/weekly-check', (req, res) => {
  const { taskName, weekStart, userId } = req.body;
  
  db.get(
    'SELECT * FROM weekly_cleanings WHERE task_name = ? AND week_start = ?',
    [taskName, weekStart],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (existing) {
        // Update check status
        const newChecked = existing.checked === 1 ? 0 : 1;
        const checkedAt = newChecked === 1 ? new Date().toISOString() : null;
        const checkedBy = newChecked === 1 ? userId : null;
        
        db.run(
          'UPDATE weekly_cleanings SET checked = ?, checked_by = ?, checked_at = ? WHERE id = ?',
          [newChecked, checkedBy, checkedAt, existing.id],
          (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, checked: newChecked === 1 });
          }
        );
      } else {
        // Create new entry
        const checkedAt = new Date().toISOString();
        db.run(
          'INSERT INTO weekly_cleanings (task_name, week_start, checked, checked_by, checked_at) VALUES (?, ?, 1, ?, ?)',
          [taskName, weekStart, userId, checkedAt],
          (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, checked: true });
          }
        );
      }
    }
  );
});

// Toggle monthly cleaning
app.post('/api/cleaning/monthly-check', (req, res) => {
  const { taskName, month, userId } = req.body;
  
  db.get(
    'SELECT * FROM monthly_cleanings WHERE task_name = ? AND month = ?',
    [taskName, month],
    (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      
      if (existing) {
        // Update check status
        const newChecked = existing.checked === 1 ? 0 : 1;
        const checkedAt = newChecked === 1 ? new Date().toISOString() : null;
        const checkedBy = newChecked === 1 ? userId : null;
        
        db.run(
          'UPDATE monthly_cleanings SET checked = ?, checked_by = ?, checked_at = ? WHERE id = ?',
          [newChecked, checkedBy, checkedAt, existing.id],
          (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, checked: newChecked === 1 });
          }
        );
      } else {
        // Create new entry
        const checkedAt = new Date().toISOString();
        db.run(
          'INSERT INTO monthly_cleanings (task_name, month, checked, checked_by, checked_at) VALUES (?, ?, 1, ?, ?)',
          [taskName, month, userId, checkedAt],
          (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, checked: true });
          }
        );
      }
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Database: ${dbPath}`);
  console.log(`🌐 CORS allowed origins:`, allowedOrigins);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
