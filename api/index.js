// Vercel Serverless Function for Seoulier Parttimer
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
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

// Database setup (PostgreSQL via Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper function to query database
const query = (text, params) => pool.query(text, params);

// Get today's date in Korea timezone (YYYY-MM-DD)
const getTodayKST = () => {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate work hours
function calculateWorkHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  let diffMinutes = endMinutes - startMinutes;
  
  // 휴게시간 15:00~17:00 (900분~1020분) 체크
  const breakStart = 15 * 60;
  const breakEnd = 17 * 60;
  
  if (startMinutes < breakEnd && endMinutes > breakStart) {
    const overlapStart = Math.max(startMinutes, breakStart);
    const overlapEnd = Math.min(endMinutes, breakEnd);
    const overlapMinutes = overlapEnd - overlapStart;
    diffMinutes -= overlapMinutes;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Login with PIN
app.post('/api/login-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    
    if (!pin || pin.length !== 4) {
      return res.status(400).json({ success: false, message: 'PIN 번호 4자리를 입력해주세요' });
    }
    
    const result = await query('SELECT * FROM users WHERE pin = $1', [pin]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'PIN 번호가 잘못되었습니다' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Clock in
app.post('/api/clock-in', async (req, res) => {
  try {
    const { userId } = req.body;
    const date = getTodayKST();
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' });
    
    const checkResult = await query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: '이미 출근 처리되었습니다' });
    }
    
    const result = await query(
      'INSERT INTO shifts (user_id, date, start_time) VALUES ($1, $2, $3) RETURNING id',
      [userId, date, time]
    );
    
    res.json({
      success: true,
      shift: {
        id: result.rows[0].id,
        date,
        start_time: time
      }
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Clock out
app.post('/api/clock-out', async (req, res) => {
  try {
    const { userId } = req.body;
    const date = getTodayKST();
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' });
    
    const result = await query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: '출근 기록이 없습니다' });
    }
    
    const shift = result.rows[0];
    const workHours = calculateWorkHours(shift.start_time, time);
    
    await query(
      'UPDATE shifts SET end_time = $1, work_hours = $2 WHERE id = $3',
      [time, workHours, shift.id]
    );
    
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
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get shifts
app.get('/api/shifts', async (req, res) => {
  try {
    const { userId, role, month, staffId } = req.query;
    
    let queryText = `
      SELECT s.*, u.name, u.username 
      FROM shifts s 
      JOIN users u ON s.user_id = u.id
    `;
    let params = [];
    let conditions = [];
    let paramIndex = 1;
    
    if (role === 'staff') {
      conditions.push(`s.user_id = $${paramIndex++}`);
      params.push(userId);
    } else if (role === 'admin' && staffId && staffId !== 'all') {
      conditions.push(`s.user_id = $${paramIndex++}`);
      params.push(staffId);
    }
    
    if (month) {
      conditions.push(`s.date LIKE $${paramIndex++}`);
      params.push(`${month}%`);
    }
    
    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    
    queryText += ' ORDER BY s.date DESC, s.start_time DESC';
    
    const result = await query(queryText, params);
    
    res.json({
      success: true,
      shifts: result.rows
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Approve shift
app.put('/api/shifts/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE shifts SET status = $1 WHERE id = $2', ['approved', id]);
    
    res.json({
      success: true,
      message: '승인되었습니다'
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Update shift
app.put('/api/shifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, work_hours } = req.body;
    
    await query(
      'UPDATE shifts SET start_time = $1, end_time = $2, work_hours = $3, is_modified = 1 WHERE id = $4',
      [start_time, end_time, work_hours, id]
    );
    
    res.json({
      success: true,
      message: '수정되었습니다'
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Delete shift
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('DELETE FROM shifts WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: '삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const { month } = req.query;
    
    let queryText = `
      SELECT 
        u.id,
        u.name,
        u.username,
        COUNT(s.id) as shift_count,
        COALESCE(SUM(CASE WHEN s.work_hours IS NOT NULL THEN s.work_hours ELSE 0 END), 0) as total_hours,
        COALESCE(SUM(CASE WHEN s.status = 'approved' AND s.work_hours IS NOT NULL THEN s.work_hours ELSE 0 END), 0) as approved_hours
      FROM users u
      LEFT JOIN shifts s ON u.id = s.user_id
      WHERE u.role = 'staff'
    `;
    
    const params = [];
    if (month) {
      queryText += ` AND s.date LIKE $1`;
      params.push(`${month}%`);
    }
    
    queryText += ' GROUP BY u.id, u.name, u.username ORDER BY u.id';
    
    const result = await query(queryText, params);
    
    res.json({
      success: true,
      statistics: result.rows
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo FROM users WHERE role != $1 ORDER BY id',
      ['admin']
    );
    
    res.json({ success: true, employees: result.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '직원을 찾을 수 없습니다' });
    }
    
    res.json({ success: true, employee: result.rows[0] });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, hire_date, hourly_wage, memo, pin } = req.body;
    
    await query(
      'UPDATE users SET name = $1, phone = $2, email = $3, hire_date = $4, hourly_wage = $5, memo = $6, pin = $7 WHERE id = $8',
      [name, phone, email, hire_date, hourly_wage, memo, pin, id]
    );
    
    res.json({ success: true, message: '수정되었습니다' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get cleaning tasks
app.get('/api/cleaning-tasks', async (req, res) => {
  try {
    const { date } = req.query;
    
    const tasksResult = await query(
      'SELECT * FROM cleaning_tasks WHERE is_active = 1 ORDER BY order_num, id'
    );
    
    const checksResult = await query(
      `SELECT dc.*, u.name as checked_by_name 
       FROM daily_cleanings dc 
       LEFT JOIN users u ON dc.checked_by = u.id 
       WHERE dc.date = $1`,
      [date]
    );
    
    const tasks = tasksResult.rows.map(task => {
      const check = checksResult.rows.find(c => c.task_id === task.id);
      return {
        ...task,
        checked: !!check,
        check_level: check ? (check.check_level || 1) : 0,
        checked_by: check ? check.checked_by : null,
        checked_at: check ? check.checked_at : null,
        checked_by_name: check ? check.checked_by_name : null
      };
    });
    
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Get cleaning tasks error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Toggle cleaning check (double check support)
app.post('/api/cleaning-check', async (req, res) => {
  try {
    const { taskId, date, userId } = req.body;
    
    const checkResult = await query(
      'SELECT * FROM daily_cleanings WHERE task_id = $1 AND date = $2',
      [taskId, date]
    );
    
    if (checkResult.rows.length === 0) {
      // First check
      await query(
        'INSERT INTO daily_cleanings (task_id, date, checked_by, checked_at, check_level) VALUES ($1, $2, $3, $4, 1)',
        [taskId, date, userId, new Date().toISOString()]
      );
      res.json({ success: true, checked: true, check_level: 1 });
    } else {
      const existingCheck = checkResult.rows[0];
      const currentLevel = existingCheck.check_level || 1;
      
      if (currentLevel === 1) {
        // Second check
        await query(
          'UPDATE daily_cleanings SET check_level = 2, checked_by = $1, checked_at = $2 WHERE task_id = $3 AND date = $4',
          [userId, new Date().toISOString(), taskId, date]
        );
        res.json({ success: true, checked: true, check_level: 2 });
      } else {
        // Uncheck
        await query(
          'DELETE FROM daily_cleanings WHERE task_id = $1 AND date = $2',
          [taskId, date]
        );
        res.json({ success: true, checked: false, check_level: 0 });
      }
    }
  } catch (error) {
    console.error('Cleaning check error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get cleaning stats
app.get('/api/cleaning-stats', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    
    const totalResult = await query(
      'SELECT COUNT(*) as total FROM cleaning_tasks WHERE is_active = 1'
    );
    
    const completedResult = await query(
      'SELECT COUNT(*) as completed FROM daily_cleanings WHERE date = $1',
      [date]
    );
    
    const total = parseInt(totalResult.rows[0].total);
    const completed = parseInt(completedResult.rows[0].completed);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    res.json({
      success: true,
      stats: {
        total_tasks: total,
        completed_count: completed,
        completion_rate: completionRate
      }
    });
  } catch (error) {
    console.error('Get cleaning stats error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get admin cleaning stats
app.get('/api/admin/cleaning-stats', async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month) {
      return res.status(400).json({ success: false, message: 'Month is required' });
    }
    
    const totalResult = await query(
      'SELECT COUNT(*) as total FROM cleaning_tasks WHERE is_active = 1'
    );
    const totalTasks = parseInt(totalResult.rows[0].total);
    
    const statsResult = await query(
      `SELECT 
        date,
        COUNT(*) as completed_count,
        ROUND((COUNT(*) * 100.0 / $1)::numeric, 0) as completion_rate
       FROM daily_cleanings
       WHERE date LIKE $2
       GROUP BY date
       ORDER BY date`,
      [totalTasks, `${month}%`]
    );
    
    res.json({
      success: true,
      stats: statsResult.rows
    });
  } catch (error) {
    console.error('Get admin cleaning stats error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Add cleaning task
app.post('/api/cleaning-tasks', async (req, res) => {
  try {
    const { title, category } = req.body;
    
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(order_num), 0) as max_order FROM cleaning_tasks'
    );
    const nextOrder = parseInt(maxOrderResult.rows[0].max_order) + 1;
    
    const result = await query(
      'INSERT INTO cleaning_tasks (title, category, order_num, is_active) VALUES ($1, $2, $3, 1) RETURNING id',
      [title, category, nextOrder]
    );
    
    res.json({
      success: true,
      task: {
        id: result.rows[0].id,
        title,
        category,
        order_num: nextOrder
      }
    });
  } catch (error) {
    console.error('Add cleaning task error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Delete cleaning task
app.delete('/api/cleaning-tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE cleaning_tasks SET is_active = 0 WHERE id = $1', [id]);
    
    res.json({ success: true, message: '삭제되었습니다' });
  } catch (error) {
    console.error('Delete cleaning task error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get weekly cleaning tasks
app.get('/api/cleaning/weekly-tasks', async (req, res) => {
  try {
    const taskNamesResult = await query(
      'SELECT DISTINCT task_name FROM weekly_cleanings ORDER BY task_name'
    );
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0];
    
    const checksResult = await query(
      'SELECT * FROM weekly_cleanings WHERE week_start = $1',
      [weekStart]
    );
    
    const tasks = taskNamesResult.rows.map((tn, index) => {
      const check = checksResult.rows.find(c => c.task_name === tn.task_name);
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
  } catch (error) {
    console.error('Get weekly tasks error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get monthly cleaning tasks
app.get('/api/cleaning/monthly-tasks', async (req, res) => {
  try {
    const taskNamesResult = await query(
      'SELECT DISTINCT task_name FROM monthly_cleanings ORDER BY task_name'
    );
    
    const today = new Date();
    const month = today.toISOString().substring(0, 7);
    
    const checksResult = await query(
      'SELECT * FROM monthly_cleanings WHERE month = $1',
      [month]
    );
    
    const tasks = taskNamesResult.rows.map((tn, index) => {
      const check = checksResult.rows.find(c => c.task_name === tn.task_name);
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
  } catch (error) {
    console.error('Get monthly tasks error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Toggle weekly cleaning
app.post('/api/cleaning/weekly-check', async (req, res) => {
  try {
    const { taskName, weekStart, userId } = req.body;
    
    const checkResult = await query(
      'SELECT * FROM weekly_cleanings WHERE task_name = $1 AND week_start = $2',
      [taskName, weekStart]
    );
    
    if (checkResult.rows.length === 0) {
      await query(
        'INSERT INTO weekly_cleanings (task_name, week_start, checked, checked_by, checked_at) VALUES ($1, $2, 1, $3, $4)',
        [taskName, weekStart, userId, new Date().toISOString()]
      );
      res.json({ success: true, checked: true });
    } else {
      const existingCheck = checkResult.rows[0];
      const newChecked = existingCheck.checked === 1 ? 0 : 1;
      
      if (newChecked === 1) {
        await query(
          'UPDATE weekly_cleanings SET checked = 1, checked_by = $1, checked_at = $2 WHERE task_name = $3 AND week_start = $4',
          [userId, new Date().toISOString(), taskName, weekStart]
        );
      } else {
        await query(
          'UPDATE weekly_cleanings SET checked = 0, checked_by = NULL, checked_at = NULL WHERE task_name = $1 AND week_start = $2',
          [taskName, weekStart]
        );
      }
      
      res.json({ success: true, checked: newChecked === 1 });
    }
  } catch (error) {
    console.error('Weekly check error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Toggle monthly cleaning
app.post('/api/cleaning/monthly-check', async (req, res) => {
  try {
    const { taskName, month, userId } = req.body;
    
    const checkResult = await query(
      'SELECT * FROM monthly_cleanings WHERE task_name = $1 AND month = $2',
      [taskName, month]
    );
    
    if (checkResult.rows.length === 0) {
      await query(
        'INSERT INTO monthly_cleanings (task_name, month, checked, checked_by, checked_at) VALUES ($1, $2, 1, $3, $4)',
        [taskName, month, userId, new Date().toISOString()]
      );
      res.json({ success: true, checked: true });
    } else {
      const existingCheck = checkResult.rows[0];
      const newChecked = existingCheck.checked === 1 ? 0 : 1;
      
      if (newChecked === 1) {
        await query(
          'UPDATE monthly_cleanings SET checked = 1, checked_by = $1, checked_at = $2 WHERE task_name = $3 AND month = $4',
          [userId, new Date().toISOString(), taskName, month]
        );
      } else {
        await query(
          'UPDATE monthly_cleanings SET checked = 0, checked_by = NULL, checked_at = NULL WHERE task_name = $1 AND month = $2',
          [taskName, month]
        );
      }
      
      res.json({ success: true, checked: newChecked === 1 });
    }
  } catch (error) {
    console.error('Monthly check error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
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

// Export for Vercel
module.exports = app;
