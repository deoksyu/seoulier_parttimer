const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Calculate work hours with break time deduction
function calculateWorkHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  let diffMinutes = endMinutes - startMinutes;
  
  // 휴게시간 15:00~17:00 체크
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

// Login
app.post('/api/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    
    console.log('Querying database for user:', username);
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    console.log('Query result rows:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('Login failed: User not found');
      return res.status(401).json({ 
        success: false, 
        message: '아이디 또는 비밀번호가 잘못되었습니다' 
      });
    }
    
    const user = result.rows[0];
    console.log('Login successful for user:', user.username);
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
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Database error',
      error: error.message 
    });
  }
});

// Clock in
app.post('/api/clock-in', async (req, res) => {
  try {
    const { userId } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    
    // Check if already clocked in today
    const checkResult = await db.query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 출근 처리되었습니다' 
      });
    }
    
    const result = await db.query(
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
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    
    const result = await db.query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '출근 기록이 없습니다' 
      });
    }
    
    const shift = result.rows[0];
    const workHours = calculateWorkHours(shift.start_time, time);
    
    await db.query(
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
    
    let query = `
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
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.date DESC, s.start_time DESC';
    
    const result = await db.query(query, params);
    
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
    
    await db.query(
      'UPDATE shifts SET status = $1 WHERE id = $2',
      ['approved', id]
    );
    
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
    
    await db.query(
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
    
    await db.query('DELETE FROM shifts WHERE id = $1', [id]);
    
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
    
    let query = `
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
      query += ` AND s.date LIKE $1`;
      params.push(`${month}%`);
    }
    
    query += ' GROUP BY u.id, u.name, u.username ORDER BY u.id';
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      statistics: result.rows
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Export for Vercel
module.exports = app;
