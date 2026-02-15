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
// Optimized connection pool for Vercel Serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 3, // Increased for better concurrency (was 1)
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout after 10s
  allowExitOnIdle: true // Allow process to exit when idle
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
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

// Get current time in Korea timezone (HH:mm:ss)
const getCurrentTimeKST = () => {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// Calculate work hours
function calculateWorkHours(startTime, endTime) {
  try {
    console.log(`[calculateWorkHours] Input - start: ${startTime}, end: ${endTime}`);
    
    // Handle both HH:mm:ss and HH:mm formats
    const startParts = startTime.split(':');
    const endParts = endTime.split(':');
    
    const startHour = parseInt(startParts[0], 10);
    const startMin = parseInt(startParts[1], 10);
    const endHour = parseInt(endParts[0], 10);
    const endMin = parseInt(endParts[1], 10);
    
    console.log(`[calculateWorkHours] Parsed - startHour: ${startHour}, startMin: ${startMin}, endHour: ${endHour}, endMin: ${endMin}`);
    
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      console.error(`[calculateWorkHours] Invalid time format - start: ${startTime}, end: ${endTime}`);
      return 0;
    }
    
    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    // 10:00 이전 출근은 10:00으로 보정
    const workStartThreshold = 10 * 60;  // 600분 (10:00)
    const breakStart = 15 * 60; // 900분 (15:00)
    const breakEnd = 17 * 60;   // 1020분 (17:00)
    
    if (startMinutes < workStartThreshold) {
      console.log(`[calculateWorkHours] Early clock-in detected: ${startTime} → adjusted to 10:00`);
      startMinutes = workStartThreshold;
    }
    
    // 15:00~17:00 브레이크타임에 출근한 경우 17:00으로 보정
    if (startMinutes >= breakStart && startMinutes < breakEnd) {
      console.log(`[calculateWorkHours] Break time clock-in detected: ${startTime} → adjusted to 17:00`);
      startMinutes = breakEnd; // 17:00으로 보정
    }
    
    // 퇴근도 10:00 이전이면 근무시간 0
    if (endMinutes < workStartThreshold) {
      console.log(`[calculateWorkHours] Clock-out before 10:00: work hours = 0`);
      return 0;
    }
    
    let diffMinutes = endMinutes - startMinutes;
    
    console.log(`[calculateWorkHours] Adjusted - start: ${startMinutes}, end: ${endMinutes}, diff: ${diffMinutes}`);
    
    // 휴게시간 15:00~17:00 제외 로직
    // 단, 출근 시간이 이미 17:00 이후로 보정된 경우는 제외 불필요
    // 10:00~15:00 사이에 출근하고 17:00 이후에 퇴근한 경우만 휴게시간 제외
    if (startMinutes < breakStart && endMinutes > breakEnd) {
      const breakDuration = breakEnd - breakStart; // 120분 (2시간)
      console.log(`[calculateWorkHours] Excluding break time: ${breakDuration} minutes`);
      diffMinutes -= breakDuration;
    }
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const roundedMinutes = minutes >= 30 ? 0.5 : 0;
    const totalHours = hours + roundedMinutes;
    
    console.log(`[calculateWorkHours] Result - total minutes: ${diffMinutes}, hours: ${hours}, rounded minutes: ${roundedMinutes}, total: ${totalHours}`);
    
    return totalHours;
  } catch (error) {
    console.error('[calculateWorkHours] Error:', error);
    console.error('[calculateWorkHours] Stack:', error.stack);
    return 0;
  }
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
    
    const result = await query('SELECT * FROM users WHERE pin = $1 AND (is_active = 1 OR is_active IS NULL)', [pin]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'PIN 번호가 잘못되었거나 비활성화된 계정입니다' });
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
    
    if (!userId) {
      console.error('Clock in error: Missing userId');
      return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다' });
    }
    
    const date = getTodayKST();
    const time = getCurrentTimeKST();
    
    console.log(`Clock in attempt - userId: ${userId}, date: ${date}, time: ${time}`);
    
    const checkResult = await query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (checkResult.rows.length > 0) {
      console.log(`Clock in failed - already clocked in: userId ${userId}`);
      return res.status(400).json({ success: false, message: '이미 출근 처리되었습니다' });
    }
    
    // Get user's regular start time for late check
    const userResult = await query(
      'SELECT regular_start_time FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
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
      
      // 브레이크타임 (15:00~17:00) 체크 - 출근 시간은 그대로 기록, 지각만 안 함
      if (actualHour === 15 || actualHour === 16) {
        console.log('Break time (15:00~17:00) - No late check, work hours calculated from 17:00');
        isLate = 0;
        lateMinutes = 0;
      } else if (actualHour >= 17) {
        // 17:00 이후는 저녁 근무 기준(17:00)으로 지각 계산
        const eveningStartMinutes = 17 * 60; // 17:00 = 1020분
        if (actualMinutes > eveningStartMinutes) {
          isLate = 1;
          lateMinutes = actualMinutes - eveningStartMinutes;
          console.log('LATE for evening shift! Minutes late:', lateMinutes);
        } else {
          console.log('On time for evening shift');
        }
      } else if (actualMinutes > regularMinutes) {
        isLate = 1;
        lateMinutes = actualMinutes - regularMinutes;
        console.log('LATE! Minutes late:', lateMinutes);
      } else {
        console.log('On time or early');
      }
    } else {
      console.log('No regular start time set for user');
    }
    
    const result = await query(
      'INSERT INTO shifts (user_id, date, start_time, is_late, late_minutes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, date, time, isLate, lateMinutes]
    );
    
    console.log(`Clock in success - shiftId: ${result.rows[0].id}, userId: ${userId}, isLate: ${isLate}, lateMinutes: ${lateMinutes}`);
    
    res.json({
      success: true,
      shift: {
        id: result.rows[0].id,
        date,
        start_time: time,
        is_late: isLate,
        late_minutes: lateMinutes
      }
    });
  } catch (error) {
    console.error('Clock in error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Database error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Clock out
app.post('/api/clock-out', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      console.error('Clock out error: Missing userId');
      return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다' });
    }
    
    const date = getTodayKST();
    const time = getCurrentTimeKST();
    
    console.log(`Clock out attempt - userId: ${userId}, date: ${date}, time: ${time}`);
    
    const result = await query(
      'SELECT * FROM shifts WHERE user_id = $1 AND date = $2 AND end_time IS NULL',
      [userId, date]
    );
    
    if (result.rows.length === 0) {
      console.log(`Clock out failed - no active shift: userId ${userId}`);
      return res.status(400).json({ success: false, message: '출근 기록이 없습니다' });
    }
    
    const shift = result.rows[0];
    console.log(`Found active shift - shiftId: ${shift.id}, start_time: ${shift.start_time}`);
    
    const workHours = calculateWorkHours(shift.start_time, time);
    console.log(`Calculated work hours: ${workHours}`);
    
    await query(
      'UPDATE shifts SET end_time = $1, work_hours = $2 WHERE id = $3',
      [time, workHours, shift.id]
    );
    
    console.log(`Clock out success - shiftId: ${shift.id}, userId: ${userId}, workHours: ${workHours}`);
    
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
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Database error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get shifts
app.get('/api/shifts', async (req, res) => {
  try {
    const { userId, role, month, staffId } = req.query;
    
    let queryText = `
      SELECT s.*, u.name, u.username, u.pin, u.workplace, u.position 
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

// Create manual shift (admin only)
app.post('/api/shifts/manual', async (req, res) => {
  try {
    const { user_id, date, start_time, end_time } = req.body;
    
    // Validation
    if (!user_id || !date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요' });
    }
    
    // Check if shift already exists for this user on this date
    const existingShift = await query('SELECT id FROM shifts WHERE user_id = $1 AND date = $2', [user_id, date]);
    
    if (existingShift.rows.length > 0) {
      return res.status(400).json({ success: false, message: '해당 날짜에 이미 출근 기록이 있습니다' });
    }
    
    // Calculate work hours
    const workHours = calculateWorkHours(start_time, end_time);
    
    // Get user's regular start time for late check
    const userResult = await query('SELECT regular_start_time FROM users WHERE id = $1', [user_id]);
    const user = userResult.rows[0];
    
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
    const result = await query(
      'INSERT INTO shifts (user_id, date, start_time, end_time, work_hours, status, is_modified, is_late, late_minutes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [user_id, date, start_time, end_time, workHours, 'approved', 1, isLate, lateMinutes]
    );
    
    res.json({
      success: true,
      message: '출근 기록이 추가되었습니다',
      shift: {
        id: result.rows[0].id,
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
  } catch (error) {
    console.error('Manual shift creation error:', error);
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

// Unapprove shift (승인 취소)
app.put('/api/shifts/:id/unapprove', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query('UPDATE shifts SET status = $1 WHERE id = $2', ['pending', id]);
    
    res.json({
      success: true,
      message: '승인이 취소되었습니다'
    });
  } catch (error) {
    console.error('Unapprove error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Update shift
app.put('/api/shifts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, work_hours } = req.body;
    
    // Auto-calculate work_hours if both start_time and end_time are provided
    let calculatedWorkHours = work_hours;
    if (start_time && end_time) {
      console.log(`[Update Shift] Recalculating work hours - start: ${start_time}, end: ${end_time}`);
      calculatedWorkHours = calculateWorkHours(start_time, end_time);
      console.log(`[Update Shift] Original work_hours: ${work_hours}, Recalculated: ${calculatedWorkHours}`);
    }
    
    // 출근 시간이 수정되면 지각 정보도 재계산
    let isLate = null;
    let lateMinutes = null;
    
    if (start_time) {
      // 해당 shift의 user_id와 regular_start_time 조회
      const shiftResult = await query(
        'SELECT s.user_id, u.regular_start_time FROM shifts s JOIN users u ON s.user_id = u.id WHERE s.id = $1',
        [id]
      );
      
      if (shiftResult.rows.length > 0) {
        const shift = shiftResult.rows[0];
        const regularStartTime = shift.regular_start_time;
        
        if (regularStartTime) {
          const actualParts = start_time.split(':');
          const actualHour = parseInt(actualParts[0]);
          const actualMin = parseInt(actualParts[1]);
          const actualMinutes = actualHour * 60 + actualMin;
          
          const regularParts = regularStartTime.split(':');
          const regularHour = parseInt(regularParts[0]);
          const regularMin = parseInt(regularParts[1]);
          const regularMinutes = regularHour * 60 + regularMin;
          
          // 브레이크타임 (15:00~17:00) 체크
          if (actualHour === 15 || actualHour === 16) {
            console.log('[Update] Break time - no late check');
            isLate = 0;
            lateMinutes = 0;
          } else if (actualHour >= 17) {
            // 17:00 이후는 저녁 근무 기준
            const eveningStartMinutes = 17 * 60;
            if (actualMinutes > eveningStartMinutes) {
              isLate = 1;
              lateMinutes = actualMinutes - eveningStartMinutes;
              console.log('[Update] Late for evening shift:', lateMinutes);
            } else {
              isLate = 0;
              lateMinutes = 0;
            }
          } else if (actualMinutes > regularMinutes) {
            isLate = 1;
            lateMinutes = actualMinutes - regularMinutes;
            console.log('[Update] Late:', lateMinutes);
          } else {
            isLate = 0;
            lateMinutes = 0;
          }
        }
      }
    }
    
    // Update shift - 지각 정보도 함께 업데이트
    if (isLate !== null) {
      await query(
        'UPDATE shifts SET start_time = $1, end_time = $2, work_hours = $3, is_late = $4, late_minutes = $5, is_modified = 1 WHERE id = $6',
        [start_time, end_time, calculatedWorkHours, isLate, lateMinutes, id]
      );
    } else {
      // 출근 시간 변경이 없으면 기존 로직 유지
      await query(
        'UPDATE shifts SET start_time = $1, end_time = $2, work_hours = $3, is_modified = 1 WHERE id = $4',
        [start_time, end_time, calculatedWorkHours, id]
      );
    }
    
    res.json({
      success: true,
      message: '수정되었습니다'
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Late exempt (지각 면제)
app.put('/api/shifts/:id/late-exempt', async (req, res) => {
  try {
    const { id } = req.params;
    const { late_exempt, late_note } = req.body;
    
    await query(
      'UPDATE shifts SET late_exempt = $1, late_note = $2 WHERE id = $3',
      [late_exempt ? 1 : 0, late_note || null, id]
    );
    
    res.json({
      success: true,
      message: late_exempt ? '지각이 면제되었습니다' : '지각 면제가 취소되었습니다'
    });
  } catch (error) {
    console.error('Late exempt error:', error);
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
        COUNT(DISTINCT CASE WHEN s.date IS NOT NULL THEN s.date END) as shift_count,
        COALESCE(ROUND(SUM(
          CASE 
            WHEN s.work_hours IS NOT NULL THEN s.work_hours
            ELSE 0 
          END
        )::numeric, 1), 0) as total_hours,
        COALESCE(ROUND(SUM(
          CASE 
            WHEN s.status = 'approved' AND s.work_hours IS NOT NULL THEN s.work_hours
            ELSE 0 
          END
        )::numeric, 1), 0) as approved_hours
      FROM users u
      LEFT JOIN shifts s ON u.id = s.user_id
      WHERE u.role != 'admin' AND u.role != 'cleaning' AND (u.is_active = 1 OR u.is_active IS NULL)
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
      'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo, position, workplace, regular_start_time, health_certificate_expiry FROM users WHERE role != $1 AND (is_active = 1 OR is_active IS NULL) ORDER BY name',
      ['admin']
    );
    
    res.json({ success: true, employees: result.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
  try {
    const { 
      username, password, name, pin,
      phone, email, position, workplace,
      hire_date, hourly_wage, 
      regular_start_time, health_certificate_expiry,
      memo 
    } = req.body;
    
    // Validation
    if (!name || !pin) {
      return res.status(400).json({ 
        success: false, 
        message: '필수 항목을 입력해주세요 (이름, PIN)' 
      });
    }
    
    // Auto-generate username if not provided
    const finalUsername = username || `emp_${Date.now()}`;
    const finalPassword = password || pin;
    
    // PIN validation (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'PIN은 4자리 숫자여야 합니다' 
      });
    }
    
    // Check duplicate username (only if provided)
    if (username) {
      const usernameCheck = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: '이미 사용 중인 아이디입니다' 
        });
      }
    }
    
    // Check duplicate PIN
    const pinCheck = await query(
      'SELECT id FROM users WHERE pin = $1',
      [pin]
    );
    if (pinCheck.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 사용 중인 PIN입니다' 
      });
    }
    
    // Insert new employee
    const result = await query(
      `INSERT INTO users (
        username, password, name, role, pin,
        phone, email, position, workplace,
        hire_date, hourly_wage, 
        regular_start_time, health_certificate_expiry,
        memo, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1)
      RETURNING id`,
      [
        finalUsername, finalPassword, name, 'staff', pin,
        phone || null, email || null, position || '직원', workplace || '서울역 홀',
        hire_date || null, hourly_wage || 10000,
        regular_start_time || null, health_certificate_expiry || null,
        memo || null
      ]
    );
    
    res.json({ 
      success: true, 
      message: '직원이 추가되었습니다',
      employeeId: result.rows[0].id
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT id, username, name, role, pin, phone, email, hire_date, hourly_wage, memo, position, workplace, regular_start_time, health_certificate_expiry FROM users WHERE id = $1',
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
    const { name, phone, email, hire_date, hourly_wage, memo, pin, position, workplace, regular_start_time, health_certificate_expiry } = req.body;
    
    // Convert empty strings to null for numeric fields
    const parsedHourlyWage = hourly_wage === '' || hourly_wage === null ? null : parseInt(hourly_wage, 10);
    
    await query(
      'UPDATE users SET name = $1, phone = $2, email = $3, hire_date = $4, hourly_wage = $5, memo = $6, pin = $7, position = $8, workplace = $9, regular_start_time = $10, health_certificate_expiry = $11 WHERE id = $12',
      [name, phone, email, hire_date, parsedHourlyWage, memo, pin, position, workplace, regular_start_time || null, health_certificate_expiry || null, id]
    );
    
    res.json({ success: true, message: '수정되었습니다' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Delete employee (Soft Delete)
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if employee exists
    const checkResult = await query(
      'SELECT id, name, role FROM users WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '직원을 찾을 수 없습니다' 
      });
    }
    
    const employee = checkResult.rows[0];
    
    // Prevent deleting admin
    if (employee.role === 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: '관리자 계정은 삭제할 수 없습니다' 
      });
    }
    
    // Soft delete: set is_active to 0 and clear PIN for reuse
    await query(
      'UPDATE users SET is_active = 0, pin = NULL WHERE id = $1',
      [id]
    );
    
    res.json({ 
      success: true, 
      message: `${employee.name} 직원이 삭제되었습니다` 
    });
  } catch (error) {
    console.error('Delete employee error:', error);
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
