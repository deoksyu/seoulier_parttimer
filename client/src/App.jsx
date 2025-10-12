import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import logo from './assets/logo.png';

// 프로덕션에서는 /api, 개발에서는 localhost 사용
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5001/api');

// Get today's date in Korea timezone (YYYY-MM-DD)
const getTodayKST = () => {
  const now = new Date();
  // Use toLocaleDateString with Asia/Seoul timezone
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Day Detail Content Component
function DayDetailContent({ date, userId, onUpdate }) {
  const [detailTasks, setDetailTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDetail = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/cleaning-detail/${date}`);
      if (response.data.success) {
        setDetailTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [date]);

  const handleToggleTask = async (taskId, currentCheckId) => {
    try {
      const response = await axios.post(`${API_URL}/cleaning-check`, {
        taskId: taskId,
        userId: userId, // Use logged-in user ID
        date: date // Pass the selected date
      });
      if (response.data.success) {
        await loadDetail();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>로딩 중...</div>;
  }

  // Group by category with custom order
  const grouped = {};
  detailTasks.forEach(task => {
    if (!grouped[task.category]) {
      grouped[task.category] = [];
    }
    grouped[task.category].push(task);
  });

  // Define category order (홀 first)
  const categoryOrder = ['홀', '티카', '행주/대걸레', '기타'];
  const orderedCategories = categoryOrder.filter(cat => grouped[cat]);

  return (
    <div className="day-detail-tasks">
      {orderedCategories.map(category => (
        <div key={category} className="detail-category">
          <h4 className="detail-category-title">{category}</h4>
          <div className="detail-task-list">
            {grouped[category].map(task => (
              <div 
                key={task.id} 
                className={`detail-task-item ${task.check_id ? 'checked' : 'unchecked'} editable`}
                onClick={() => handleToggleTask(task.id, task.check_id)}
              >
                <span className="task-checkbox">
                  {task.check_id ? (task.check_level === 2 ? '🔴' : '✅') : '⬜'}
                </span>
                <span className="task-title">
                  {task.title.includes('|||') ? (
                    <>
                      <span className="task-name">{task.title.split('|||')[0]}</span>
                      <span className="task-date">({task.title.split('|||')[1]})</span>
                    </>
                  ) : (
                    task.title
                  )}
                </span>
                {task.check_id && task.checked_at && (
                  <span className="task-time">
                    {task.checked_at.includes('T') 
                      ? task.checked_at.split('T')[1].substring(0, 5)
                      : task.checked_at.substring(0, 5)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState('');
  const [shifts, setShifts] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [printMode, setPrintMode] = useState(null); // 'statistics' or 'records'
  const [editingShift, setEditingShift] = useState(null); // 수정 중인 근무 기록
  
  // Cleaning checklist states
  const [cleaningTasks, setCleaningTasks] = useState([]);
  const [cleaningStats, setCleaningStats] = useState(null);
  const [weeklyChecks, setWeeklyChecks] = useState([]);
  const [checkingTasks, setCheckingTasks] = useState(new Set()); // Track tasks being checked
  const [weeklyTasks, setWeeklyTasks] = useState([]);
  const [monthlyTasks, setMonthlyTasks] = useState([]);
  const [adminTab, setAdminTab] = useState('work'); // 'work', 'cleaning', or 'hr'
  const [adminCleaningStats, setAdminCleaningStats] = useState(null);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [workplaceFilter, setWorkplaceFilter] = useState('all'); // 근무지 필터
  const [adminWeeklyTasks, setAdminWeeklyTasks] = useState([]);
  const [adminMonthlyTasks, setAdminMonthlyTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [showWorkDayModal, setShowWorkDayModal] = useState(false);
  const [selectedWorkDay, setSelectedWorkDay] = useState(null);

  // Load shifts when user logs in or month/staff changes
  useEffect(() => {
    if (user) {
      if (user.role === 'cleaning') {
        loadCleaningTasks();
        // Load weekly data
        const weekDates = getWeekDates();
        if (weekDates.length > 0) {
          loadWeeklyChecks(weekDates[0].date, weekDates[6].date);
        }
        loadWeeklyTasks();
        loadMonthlyTasks();
      } else {
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
          if (adminTab === 'cleaning') {
            loadAdminCleaningStats();
            loadCleaningTasks(); // Load cleaning tasks for etc indicator
          } else if (adminTab === 'hr') {
            loadEmployees();
          }
        }
      }
    }
  }, [user, selectedMonth, selectedStaff, adminTab]);

  // Auto-refresh cleaning tasks for cleaning role
  useEffect(() => {
    if (user && user.role === 'cleaning') {
      const interval = setInterval(() => {
        loadWeeklyTasks();
        loadMonthlyTasks();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Login with PIN
  const handleLogin = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setMessage('PIN 번호 4자리를 입력해주세요');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/login-pin`, { pin });
      if (response.data.success) {
        setUser(response.data.user);
        setMessage('로그인 성공!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '로그인 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Logout
  const handleLogout = () => {
    setUser(null);
    setShifts([]);
    setPin('');
  };

  // Clock in
  const handleClockIn = async () => {
    try {
      const response = await axios.post(`${API_URL}/clock-in`, { userId: user.id });
      if (response.data.success) {
        setMessage('출근 처리되었습니다!');
        loadShifts();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '출근 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    try {
      const response = await axios.post(`${API_URL}/clock-out`, { userId: user.id });
      if (response.data.success) {
        setMessage('퇴근 처리되었습니다! 10초 후 자동 로그아웃됩니다.');
        loadShifts();
        
        // Auto logout after 10 seconds
        setTimeout(() => {
          handleLogout();
        }, 10000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '퇴근 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Load shifts
  const loadShifts = async () => {
    try {
      const response = await axios.get(`${API_URL}/shifts`, {
        params: { 
          userId: user.id, 
          role: user.role,
          month: selectedMonth,
          staffId: selectedStaff
        }
      });
      if (response.data.success) {
        setShifts(response.data.shifts);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    }
  };

  // Load statistics (admin only)
  const loadStatistics = async () => {
    try {
      const response = await axios.get(`${API_URL}/statistics`, {
        params: { month: selectedMonth }
      });
      if (response.data.success) {
        setStatistics(response.data.statistics);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  // Load employees (admin only)
  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/employees`);
      if (response.data.success) {
        setEmployees(response.data.employees);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  // Approve shift
  const handleApprove = async (shiftId) => {
    try {
      const response = await axios.put(`${API_URL}/shifts/${shiftId}/approve`);
      if (response.data.success) {
        setMessage('승인되었습니다!');
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
        }
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('승인 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Delete shift
  const handleDelete = async (shiftId) => {
    if (!window.confirm('이 근무 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    try {
      const response = await axios.delete(`${API_URL}/shifts/${shiftId}`);
      if (response.data.success) {
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
        }
        // Update modal data immediately
        if (selectedWorkDay) {
          const updatedShifts = selectedWorkDay.shifts.filter(s => s.id !== shiftId);
          if (updatedShifts.length === 0) {
            // If no shifts left, close modal
            setShowWorkDayModal(false);
            setSelectedWorkDay(null);
          } else {
            setSelectedWorkDay({
              ...selectedWorkDay,
              shifts: updatedShifts
            });
          }
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Start editing shift
  const handleEditStart = (shift) => {
    setEditingShift({
      id: shift.id,
      date: shift.date,
      start_time: shift.start_time,
      end_time: shift.end_time || '',
      work_hours: shift.work_hours || 0
    });
  };

  // Cancel editing
  const handleEditCancel = () => {
    setEditingShift(null);
  };

  // Calculate work hours for editing
  const calculateEditWorkHours = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
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
    const roundedMinutes = minutes >= 30 ? 0.5 : 0;
    return hours + roundedMinutes;
  };

  // Update shift
  const handleEditSave = async () => {
    if (!editingShift.date || !editingShift.start_time || !editingShift.end_time) {
      setMessage('날짜, 출근 시간, 퇴근 시간을 모두 입력해주세요');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    try {
      console.log('Saving shift:', editingShift);
      const response = await axios.put(`${API_URL}/shifts/${editingShift.id}`, {
        date: editingShift.date,
        start_time: editingShift.start_time,
        end_time: editingShift.end_time,
        work_hours: editingShift.work_hours
      });
      console.log('Response:', response.data);
      if (response.data.success) {
        setEditingShift(null);
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
        }
        // Update modal data immediately
        if (selectedWorkDay) {
          setSelectedWorkDay({
            ...selectedWorkDay,
            shifts: selectedWorkDay.shifts.map(s => 
              s.id === editingShift.id ? { 
                ...s, 
                start_time: editingShift.start_time,
                end_time: editingShift.end_time,
                work_hours: editingShift.work_hours
              } : s
            )
          });
        }
      }
    } catch (error) {
      console.error('Edit error:', error);
      setMessage(error.response?.data?.message || '수정 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Check if already clocked in today
  const isClockedInToday = () => {
    const today = getTodayKST();
    return shifts.some(shift => shift.date === today && !shift.end_time);
  };

  // Print monthly report
  const handlePrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  // Calculate total hours for the month
  const calculateTotalHours = () => {
    return shifts
      .filter(shift => shift.work_hours)
      .reduce((total, shift) => total + shift.work_hours, 0);
  };

  // Calculate consecutive on-time days
  const calculateConsecutiveOnTimeDays = () => {
    // 모든 근무 기록을 날짜 역순으로 정렬 (최신부터)
    const sortedShifts = [...shifts].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let consecutiveDays = 0;
    
    for (const shift of sortedShifts) {
      if (!shift.start_time) continue;
      
      // 출근 시간이 11:00 이하인지 확인 (11:01부터 지각)
      const [hour, minute] = shift.start_time.split(':').map(Number);
      const startMinutes = hour * 60 + minute;
      const lateThreshold = 11 * 60; // 11:00 = 660분
      
      if (startMinutes <= lateThreshold) {
        consecutiveDays++;
      } else {
        // 지각하면 연속 기록 중단
        break;
      }
    }
    
    return consecutiveDays;
  };

  // Handle PIN input (only numbers, max 4 digits)
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 허용
    if (value.length <= 4) {
      setPin(value);
      
      // 4자리 입력 완료 시 자동 로그인
      if (value.length === 4) {
        setTimeout(() => {
          autoLogin(value);
        }, 100);
      }
    }
  };

  // Handle number pad click
  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      // 4자리 입력 완료 시 자동 로그인
      if (newPin.length === 4) {
        setTimeout(() => {
          autoLogin(newPin);
        }, 100);
      }
    }
  };

  // Auto login when 4 digits entered
  const autoLogin = async (pinValue) => {
    try {
      const response = await axios.post(`${API_URL}/login-pin`, { pin: pinValue });
      if (response.data.success) {
        setUser(response.data.user);
        setMessage('로그인 성공!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '로그인 실패');
      setTimeout(() => setMessage(''), 3000);
      setPin(''); // 실패 시 PIN 초기화
    }
  };

  // Handle backspace
  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  // Handle clear
  const handleClear = () => {
    setPin('');
  };

  // ==================== CLEANING FUNCTIONS ====================
  
  // Load cleaning tasks
  const loadCleaningTasks = async () => {
    try {
      const today = getTodayKST();
      const response = await axios.get(`${API_URL}/cleaning-tasks`, {
        params: { date: today }
      });
      if (response.data.success) {
        setCleaningTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load cleaning tasks:', error);
    }
  };

  // Load weekly cleaning data
  const loadWeeklyChecks = async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_URL}/cleaning-weekly`, {
        params: { startDate, endDate }
      });
      if (response.data.success) {
        setWeeklyChecks(response.data.checks);
      }
    } catch (error) {
      console.error('Failed to load weekly checks:', error);
    }
  };

  // Check cleaning task
  const handleCheckTask = async (taskId) => {
    // Prevent duplicate clicks
    if (checkingTasks.has(taskId)) {
      return;
    }

    // Save current scroll position
    const scrollPosition = window.scrollY;

    // Mark task as being checked
    setCheckingTasks(prev => new Set(prev).add(taskId));

    // Optimistic UI update - update immediately
    setCleaningTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const currentLevel = task.check_level || 0;
        const newLevel = currentLevel === 0 ? 1 : currentLevel === 1 ? 2 : 0;
        return {
          ...task,
          checked: newLevel > 0,
          check_level: newLevel,
          checked_at: new Date().toLocaleTimeString('ko-KR', { hour12: false })
        };
      }
      return task;
    }));

    // Restore scroll position after state update
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition);
    });

    try {
      const response = await axios.post(`${API_URL}/cleaning-check`, { taskId, userId: user.id, date: getTodayKST() });
      if (response.data.success) {
        // Reload in background to sync with server
        await loadCleaningTasks();
        // Restore scroll position after reload
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition);
        });
      }
    } catch (error) {
      // Revert on error
      loadCleaningTasks();
      setMessage(error.response?.data?.message || '체크 실패');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      // Remove task from checking set
      setCheckingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // Uncheck cleaning task
  const handleUncheckTask = async (taskId) => {
    try {
      const response = await axios.delete(`${API_URL}/cleaning/uncheck/${taskId}`);
      if (response.data.success) {
        loadCleaningTasks();
        // Reload weekly data
        const weekDates = getWeekDates();
        loadWeeklyChecks(weekDates[0].date, weekDates[6].date);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '체크 해제 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Get week start date (Monday) - using UTC to match server
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is start of week
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0];
    console.log('Client week start:', weekStart);
    return weekStart;
  };

  // Get week dates helper function
  const getWeekDates = () => {
    const today = getTodayKST();
    
    // Parse today's KST date
    const [year, month, day] = today.split('-').map(Number);
    const kstToday = new Date(year, month - 1, day);
    const currentDay = kstToday.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(kstToday);
    monday.setDate(kstToday.getDate() + diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      
      weekDates.push({
        date: dateStr,
        dayName: ['월', '화', '수', '목', '금', '토', '일'][i],
        dayNum: date.getDate(),
        isToday: dateStr === today
      });
    }
    return weekDates;
  };

  // Load weekly cleaning tasks
  const loadWeeklyTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/cleaning/weekly-tasks`);
      console.log('Weekly tasks loaded:', response.data.tasks);
      console.log('First task:', response.data.tasks[0]);
      if (response.data.success) {
        setWeeklyTasks([...response.data.tasks]); // Force new array reference
      }
    } catch (error) {
      console.error('Failed to load weekly tasks:', error);
    }
  };

  // Load monthly cleaning tasks
  const loadMonthlyTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/cleaning/monthly-tasks`);
      if (response.data.success) {
        setMonthlyTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load monthly tasks:', error);
    }
  };

  // Toggle weekly task
  const handleToggleWeeklyTask = async (task) => {
    try {
      const weekStart = getWeekStart();
      console.log('Weekly check request:', { taskName: task.task_name, weekStart, userId: user.id });
      const response = await axios.post(`${API_URL}/cleaning/weekly-check`, {
        taskName: task.task_name,
        weekStart: weekStart,
        userId: user.id
      });
      console.log('Weekly check response:', response.data);
      if (response.data.success) {
        await loadWeeklyTasks();
        setMessage('주간 청소 체크 완료');
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (error) {
      console.error('Weekly check error:', error);
      setMessage('주간 청소 체크 실패: ' + (error.response?.data?.message || error.message));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Toggle monthly task
  const handleToggleMonthlyTask = async (task) => {
    try {
      const month = getTodayKST().substring(0, 7); // YYYY-MM
      const response = await axios.post(`${API_URL}/cleaning/monthly-check`, {
        taskName: task.task_name,
        month: month,
        userId: user.id
      });
      if (response.data.success) {
        loadMonthlyTasks();
      }
    } catch (error) {
      setMessage('월간 청소 체크 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Load admin cleaning statistics
  const loadAdminCleaningStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/cleaning-stats`, {
        params: { month: selectedMonth }
      });
      if (response.data.success) {
        setAdminCleaningStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to load cleaning stats:', error);
    }
  };

  // Load admin weekly tasks
  const loadAdminWeeklyTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/cleaning/weekly-tasks`);
      if (response.data.success) {
        setAdminWeeklyTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load weekly tasks:', error);
    }
  };

  // Load admin monthly tasks
  const loadAdminMonthlyTasks = async () => {
    try {
      const response = await axios.get(`${API_URL}/cleaning/monthly-tasks`);
      if (response.data.success) {
        setAdminMonthlyTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load monthly tasks:', error);
    }
  };

  // Admin toggle weekly task
  const handleAdminToggleWeekly = async (taskId, currentChecked) => {
    try {
      const response = await axios.post(`${API_URL}/cleaning/weekly-toggle/${taskId}`, {
        userId: user.id,
        checked: !currentChecked
      });
      if (response.data.success) {
        loadAdminWeeklyTasks();
        loadAdminCleaningStats();
      }
    } catch (error) {
      setMessage('주간 청소 체크 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Admin toggle monthly task
  const handleAdminToggleMonthly = async (taskId, currentChecked) => {
    try {
      const response = await axios.post(`${API_URL}/cleaning/monthly-toggle/${taskId}`, {
        userId: user.id,
        checked: !currentChecked
      });
      if (response.data.success) {
        loadAdminMonthlyTasks();
        loadAdminCleaningStats();
      }
    } catch (error) {
      setMessage('월간 청소 체크 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Add custom task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      setMessage('항목 이름을 입력해주세요');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Add date to title with separator
      const today = getTodayKST();
      const formattedDate = today.split('-').slice(1).join('/'); // MM/DD format
      const titleWithDate = `${newTaskTitle}|||${formattedDate}`; // Use ||| as separator
      
      const response = await axios.post(`${API_URL}/cleaning-tasks`, {
        title: titleWithDate,
        category: '기타'
      });
      if (response.data.success) {
        setNewTaskTitle('');
        setShowAddTaskModal(false);
        loadCleaningTasks();
        setMessage('항목이 추가되었습니다');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('항목 추가 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Delete custom task
  const handleDeleteTask = async (taskId) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_URL}/cleaning-tasks/${taskId}`);
      if (response.data.success) {
        loadCleaningTasks();
        setMessage('항목이 삭제되었습니다');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('항목 삭제 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Calculate completion percentage (excluding '기타' category)
  const calculateCompletionRate = () => {
    const tasksExcludingEtc = cleaningTasks.filter(task => task.category !== '기타');
    if (tasksExcludingEtc.length === 0) return 0;
    const completed = tasksExcludingEtc.filter(task => task.checked).length;
    return Math.round((completed / tasksExcludingEtc.length) * 100);
  };

  // Group tasks by category
  const groupTasksByCategory = () => {
    const grouped = {};
    cleaningTasks.forEach(task => {
      const category = task.category || '기타';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(task);
    });
    
    // Define custom order for categories (기타는 항상 표시)
    const categoryOrder = ['홀', '티카', '행주/대걸레', '기타'];
    const orderedGrouped = {};
    categoryOrder.forEach(category => {
      // 기타 카테고리는 항목이 없어도 빈 배열로 추가
      if (grouped[category]) {
        orderedGrouped[category] = grouped[category];
      } else if (category === '기타') {
        orderedGrouped[category] = [];
      }
    });
    
    return orderedGrouped;
  };

  // Login Screen
  if (!user) {
    return (
      <div className="container">
        <div className="login-box">
          <img src={logo} alt="Seoulier Logo" className="login-logo" />
          <h1 className="subtitle">통합 관리 시스템</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN 4자리"
              value={pin}
              onChange={handlePinChange}
              maxLength={4}
              className="pin-input"
              autoFocus
              required
            />
            <div className="number-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  className="num-btn"
                  onClick={() => handleNumberClick(num.toString())}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="num-btn clear-btn"
                onClick={handleClear}
              >
                C
              </button>
              <button
                type="button"
                className="num-btn"
                onClick={() => handleNumberClick('0')}
              >
                0
              </button>
              <button
                type="button"
                className="num-btn backspace-btn"
                onClick={handleBackspace}
              >
                ⌫
              </button>
            </div>
          </form>
          {message && <div className="message">{message}</div>}
        </div>
      </div>
    );
  }

  // Cleaning Checklist Dashboard
  if (user.role === 'cleaning') {
    const groupedTasks = groupTasksByCategory();
    const completionRate = calculateCompletionRate();
    const tasksExcludingEtc = cleaningTasks.filter(task => task.category !== '기타');
    const completedCount = tasksExcludingEtc.filter(task => task.checked).length;
    const totalCount = tasksExcludingEtc.length;
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });

    const weekDates = getWeekDates();

    return (
      <div className="container cleaning-container-wide">
        <div className="header">
          <h1>🧹 주간 청소 체크리스트</h1>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
        
        {message && <div className="message success">{message}</div>}
        
        {completionRate === 100 && (
          <div className="completion-celebration">
            🎉 오늘의 청소를 모두 완료했습니다! 수고하셨습니다! 🎉
          </div>
        )}
        
        <div className="cleaning-summary">
          <h2>📅 {today}</h2>
          <div className="progress-section">
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${completionRate}%` }}
              >
                <span className="progress-text">{completionRate}%</span>
              </div>
            </div>
            <p className="progress-info">
              오늘 완료: <strong>{completedCount}</strong> / {totalCount} 항목
            </p>
          </div>
        </div>

        {/* Weekly Table View */}
        <div className="weekly-table-section">
          <h2>📊 주간 청소 현황</h2>
          <div className="table-wrapper">
            <table className="weekly-cleaning-table">
              <thead>
                <tr>
                  <th className="task-name-header">청소 항목</th>
                  {weekDates.map(day => (
                    <th key={day.date} className={day.isToday ? 'today-column' : ''}>
                      <div className="day-header">
                        <div className="day-name">{day.dayName}</div>
                        <div className="day-num">{day.dayNum}일</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedTasks).map(([category, tasks]) => (
                  <React.Fragment key={category}>
                    <tr className="category-row">
                      <td colSpan={8} className="category-header">
                        <div className="category-header-content">
                          <span>
                            {category === '매장' && '🏪'}
                            {category === '화장실' && '🚻'}
                            {category === '주방' && '🍳'}
                            {category === '기타' && '📦'}
                            {' '}{category}
                          </span>
                          {category === '기타' ? (
                            <button 
                              className="btn-add-task-inline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Opening modal, current state:', showAddTaskModal);
                                setShowAddTaskModal(true);
                              }}
                              type="button"
                            >
                              +
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {tasks.map(task => {
                      return (
                        <tr key={task.id}>
                          <td className="task-name-cell">
                            {task.title.includes('|||') ? (
                              <>
                                <span className="task-name">{task.title.split('|||')[0]}</span>
                                <span className="task-date">({task.title.split('|||')[1]})</span>
                              </>
                            ) : (
                              task.title
                            )}
                            {category === '기타' && (
                              <button 
                                className="delete-task-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                                title="항목 삭제"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                          {weekDates.map(day => {
                            const isToday = day.isToday;
                            
                            // Find check data for this task and date
                            let isChecked = false;
                            let checkLevel = 0;
                            let checkedByName = '';
                            let checkedAt = '';
                            
                            if (isToday) {
                              // For today, use task.checked from loaded data
                              isChecked = task.checked;
                              checkLevel = task.check_level || 0;
                              checkedByName = task.checked_by_name || '';
                              checkedAt = task.checked_at || '';
                            } else {
                              // For other days, check weeklyChecks data
                              const check = weeklyChecks.find(c => c.task_id === task.id && c.date === day.date);
                              if (check) {
                                isChecked = true;
                                checkLevel = check.check_level || 1;
                                checkedByName = check.checked_by_name || '';
                                checkedAt = check.checked_at || '';
                              }
                            }
                            
                            return (
                              <td 
                                key={`${task.id}-${day.date}`}
                                className={`check-cell ${isToday ? 'today-column' : ''} ${isChecked ? (checkLevel === 2 ? 'checked-level-2' : 'checked') : ''} ${isToday ? 'clickable' : ''}`}
                                onClick={() => {
                                  if (isToday) {
                                    handleCheckTask(task.id);
                                  }
                                }}
                                title={isChecked && checkedByName ? `${checkedByName} · ${checkedAt} ${checkLevel === 2 ? '(2차)' : '(1차)'}` : ''}
                              >
                                {isChecked ? '✓' : ''}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 주 1회 청소 리스트 */}
        <div className="additional-checklist-section">
          <h2>📅 주 1회 청소 리스트</h2>
          <p className="checklist-subtitle">매주 월요일마다 자동으로 초기화됩니다</p>
          <div className="checklist-grid">
            {weeklyTasks.map(task => {
              console.log('Rendering weekly task:', task.task_name, 'checked:', task.checked);
              const checkedDate = task.checked_at ? task.checked_at.split('T')[0] : '';
              return (
                <div 
                  key={`${task.task_name}-${task.checked}`}
                  className={`checklist-item ${task.checked === 1 ? 'checked' : ''}`}
                  onClick={() => handleToggleWeeklyTask(task)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="checkbox">{task.checked === 1 ? '✅' : '⬜'}</span>
                  <span className="task-text">{task.task_name}</span>
                  {task.checked === 1 && checkedDate && (
                    <span className="check-time">({checkedDate})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* 월 1회 청소 리스트 */}
        <div className="additional-checklist-section">
          <h2>🗓️ 월 1회 청소 리스트</h2>
          <p className="checklist-subtitle">매월 1일마다 자동으로 초기화됩니다</p>
          <div className="checklist-grid">
            {monthlyTasks.map(task => {
              const checkedDate = task.checked_at ? task.checked_at.split('T')[0] : '';
              return (
                <div 
                  key={`${task.task_name}-${task.checked}`}
                  className={`checklist-item ${task.checked === 1 ? 'checked' : ''}`}
                  onClick={() => handleToggleMonthlyTask(task)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="checkbox">{task.checked === 1 ? '✅' : '⬜'}</span>
                  <span className="task-text">{task.task_name}</span>
                  {task.checked === 1 && checkedDate && (
                    <span className="check-time">({checkedDate})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Task Modal */}
        {showAddTaskModal && (
          <div className="modal-overlay" onClick={() => {
            setShowAddTaskModal(false);
            setNewTaskTitle('');
          }}>
            <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📦 기타 항목 추가</h2>
                <button className="modal-close" onClick={() => {
                  setShowAddTaskModal(false);
                  setNewTaskTitle('');
                }}>✕</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAddTask} className="add-task-modal-form">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="새 항목 이름 입력"
                    className="task-input"
                    autoFocus
                  />
                  <div className="form-buttons">
                    <button type="submit" className="btn-save">추가</button>
                    <button 
                      type="button" 
                      className="btn-cancel"
                      onClick={() => {
                        setShowAddTaskModal(false);
                        setNewTaskTitle('');
                      }}
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Staff Dashboard
  if (user.role === 'staff') {
    return (
      <div className="container">
        <div className="header">
          <h1>👤 {user.name}님 환영합니다</h1>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
        
        {message && <div className="message success">{message}</div>}
        
        <div className="clock-section">
          <h2>📅 오늘 날짜: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</h2>
          <div className="attendance-streak">
            <span className="streak-icon">🔥</span>
            <span className="streak-text">연속 완벽 출근: <strong>{calculateConsecutiveOnTimeDays()}일</strong></span>
            <span className="streak-info">(11시 이전 출근)</span>
          </div>
          <div className="button-group">
            <button 
              onClick={handleClockIn} 
              className="btn-primary"
              disabled={isClockedInToday()}
            >
              출근하기
            </button>
            <button 
              onClick={handleClockOut} 
              className="btn-danger"
              disabled={!isClockedInToday()}
            >
              퇴근하기
            </button>
          </div>
        </div>

        <div className="shifts-section">
          <div className="section-header">
            <h2>📊 내 근무 내역</h2>
            <div className="header-controls">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="month-selector"
              >
                <option value="2025-10">2025년 10월</option>
                <option value="2025-09">2025년 9월</option>
                <option value="2025-08">2025년 8월</option>
                <option value="2025-07">2025년 7월</option>
                <option value="2025-06">2025년 6월</option>
                <option value="2025-05">2025년 5월</option>
              </select>
              <button onClick={handlePrint} className="btn-print">
                🖨️ 인쇄/PDF
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>출근 시간</th>
                <th>퇴근 시간</th>
                <th>근무 시간</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan="5">근무 내역이 없습니다</td>
                </tr>
              ) : (
                shifts.map(shift => (
                  <tr key={shift.id} className={shift.is_modified ? 'modified-row' : ''}>
                    <td>
                      {shift.date}
                      {shift.is_modified && <span className="modified-badge">✏️ 수정됨</span>}
                    </td>
                    <td>{shift.start_time}</td>
                    <td>{shift.end_time || '-'}</td>
                    <td>{shift.work_hours ? `${shift.work_hours}시간` : '-'}</td>
                    <td>
                      <span className={`status ${shift.status}`}>
                        {shift.status === 'approved' ? '✅ 승인' : '⏳ 대기'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan="3"><strong>월 합계</strong></td>
                <td><strong>{calculateTotalHours()}시간</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="container">
      <div className="header">
        <h1>👔 관리자 대시보드</h1>
        <button onClick={handleLogout} className="logout-btn">로그아웃</button>
      </div>
      
      {message && <div className="message success">{message}</div>}
      
      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button 
          className={`tab-btn ${adminTab === 'work' ? 'active' : ''}`}
          onClick={() => setAdminTab('work')}
        >
          📊 근태
        </button>
        <button 
          className={`tab-btn ${adminTab === 'cleaning' ? 'active' : ''}`}
          onClick={() => setAdminTab('cleaning')}
        >
          🧹 청소
        </button>
        <button 
          className={`tab-btn ${adminTab === 'hr' ? 'active' : ''}`}
          onClick={() => setAdminTab('hr')}
        >
          👥 노무
        </button>
      </div>
      
      {/* 근무 관리 탭 */}
      {adminTab === 'work' && (
        <>
      {/* 인원별 근무시간 통계 */}
      <div className={`shifts-section statistics-section ${printMode === 'records' ? 'print-hide' : ''}`}>
        <div className="section-header">
          <h2>📊 인원별 근무시간</h2>
          <div className="header-controls">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-selector"
            >
              <option value="2025-10">2025년 10월</option>
              <option value="2025-09">2025년 9월</option>
              <option value="2025-08">2025년 8월</option>
              <option value="2025-07">2025년 7월</option>
              <option value="2025-06">2025년 6월</option>
              <option value="2025-05">2025년 5월</option>
            </select>
            <button onClick={() => handlePrint('statistics')} className="btn-print">
              🖨️ 인쇄/PDF
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>총 근무일수</th>
              <th>총 근무시간</th>
              <th>승인 완료 시간</th>
            </tr>
          </thead>
          <tbody>
            {statistics.length === 0 ? (
              <tr>
                <td colSpan="4">통계 데이터가 없습니다</td>
              </tr>
            ) : (
              statistics.map(stat => (
                <tr 
                  key={stat.id}
                  onClick={() => setSelectedStaff(stat.id.toString())}
                  className={selectedStaff === stat.id.toString() ? 'selected-row' : 'clickable-row'}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{stat.name}</td>
                  <td>{stat.shift_count || 0}일</td>
                  <td><strong>{stat.total_hours || 0}시간</strong></td>
                  <td><strong>{stat.approved_hours || 0}시간</strong></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="2"><strong>전체 합계</strong></td>
              <td><strong>{statistics.reduce((sum, stat) => sum + (stat.total_hours || 0), 0)}시간</strong></td>
              <td><strong>{statistics.reduce((sum, stat) => sum + (stat.approved_hours || 0), 0)}시간</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 전체 근무 기록 - 캘린더 */}
      <div className={`shifts-section records-section ${printMode === 'statistics' ? 'print-hide' : ''}`}>
        <div className="section-header">
          <h2>
            📋 {selectedStaff === 'all' 
              ? '월간 근무 캘린더' 
              : `${statistics.find(s => s.id.toString() === selectedStaff)?.name || ''} 근무 캘린더`}
          </h2>
          <div className="header-controls">
            <select 
              value={selectedStaff} 
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="month-selector"
            >
              <option value="all">전체 직원</option>
              {statistics.map(stat => (
                <option key={stat.id} value={stat.id}>
                  {stat.name}
                </option>
              ))}
            </select>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="month-selector"
            >
              <option value="2025-10">2025년 10월</option>
              <option value="2025-09">2025년 9월</option>
              <option value="2025-08">2025년 8월</option>
              <option value="2025-07">2025년 7월</option>
              <option value="2025-06">2025년 6월</option>
              <option value="2025-05">2025년 5월</option>
            </select>
            <button onClick={() => handlePrint('records')} className="btn-print">
              🖨️ 인쇄/PDF
            </button>
          </div>
        </div>

        {/* 근무 캘린더 */}
        <div className="work-calendar">
          {(() => {
            const [year, month] = selectedMonth.split('-');
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDay = new Date(year, month - 1, 1).getDay();
            const today = getTodayKST();
            
            // Create shifts map for quick lookup
            const shiftsMap = {};
            console.log('Total shifts:', shifts.length);
            console.log('Selected staff:', selectedStaff);
            shifts.forEach(shift => {
              if (!shiftsMap[shift.date]) {
                shiftsMap[shift.date] = [];
              }
              shiftsMap[shift.date].push(shift);
            });
            console.log('Shifts map:', shiftsMap);
            
            const weeks = [];
            let currentWeek = [];
            
            // Add empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
              currentWeek.push(null);
            }
            
            // Add all days of the month
            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayShifts = shiftsMap[dateStr] || [];
              
              currentWeek.push({
                day,
                date: dateStr,
                shifts: dayShifts
              });
              
              if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
              }
            }
            
            // Fill last week with empty cells
            while (currentWeek.length > 0 && currentWeek.length < 7) {
              currentWeek.push(null);
            }
            if (currentWeek.length > 0) {
              weeks.push(currentWeek);
            }
            
            return (
              <div className="calendar-grid">
                <div className="calendar-header">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                    <div key={day} className="calendar-day-name">{day}</div>
                  ))}
                </div>
                <div className="calendar-body">
                  {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="calendar-week">
                      {week.map((dayData, dayIdx) => {
                        if (!dayData) {
                          return <div key={dayIdx} className="calendar-day empty"></div>;
                        }
                        
                        const isToday = dayData.date === today;
                        const totalHours = dayData.shifts.reduce((sum, shift) => sum + (shift.work_hours || 0), 0);
                        const uniqueWorkers = new Set(dayData.shifts.map(s => s.name)).size;
                        
                        return (
                          <div 
                            key={dayIdx} 
                            className={`calendar-day work-day ${isToday ? 'today' : ''} ${dayData.shifts.length > 0 ? 'has-data' : ''}`}
                            onClick={() => {
                              if (dayData.shifts.length > 0) {
                                setSelectedWorkDay({
                                  date: dayData.date,
                                  shifts: dayData.shifts
                                });
                                setShowWorkDayModal(true);
                              }
                            }}
                          >
                            <div className="day-number">{dayData.day}</div>
                            {dayData.shifts.length > 0 && (
                              <div className="work-summary">
                                <div className="work-count">{uniqueWorkers}명</div>
                                <div className="work-hours">{totalHours.toFixed(1)}h</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 근무 상세 모달 */}
        {showWorkDayModal && selectedWorkDay && (
          <div className="modal-overlay" onClick={() => setShowWorkDayModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📋 {selectedWorkDay.date} 근무 기록</h2>
                <button className="modal-close" onClick={() => setShowWorkDayModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="work-day-summary">
                  <div className="summary-item">
                    <span className="summary-label">근무자 수:</span>
                    <span className="summary-value">
                      {new Set(selectedWorkDay.shifts.map(s => s.name)).size}명
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">총 근무 시간:</span>
                    <span className="summary-value">
                      {selectedWorkDay.shifts.reduce((sum, shift) => sum + (shift.work_hours || 0), 0).toFixed(1)}시간
                    </span>
                  </div>
                </div>
                
                <table className="work-detail-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>출근 시간</th>
                      <th>퇴근 시간</th>
                      <th>근무 시간</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkDay.shifts.map(shift => (
                      editingShift && editingShift.id === shift.id ? (
                        <tr key={shift.id} className="editing-row">
                          <td><strong>{shift.name}</strong></td>
                          <td>
                            <input
                              type="text"
                              value={editingShift.start_time}
                              onChange={(e) => {
                                const newStartTime = e.target.value;
                                const newWorkHours = calculateEditWorkHours(newStartTime, editingShift.end_time);
                                setEditingShift({
                                  ...editingShift,
                                  start_time: newStartTime,
                                  work_hours: newWorkHours
                                });
                              }}
                              placeholder="HH:MM"
                              className="time-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editingShift.end_time}
                              onChange={(e) => {
                                const newEndTime = e.target.value;
                                const newWorkHours = calculateEditWorkHours(editingShift.start_time, newEndTime);
                                setEditingShift({
                                  ...editingShift,
                                  end_time: newEndTime,
                                  work_hours: newWorkHours
                                });
                              }}
                              placeholder="HH:MM"
                              className="time-input"
                            />
                          </td>
                          <td><strong>{editingShift.work_hours}시간</strong></td>
                          <td>
                            {shift.status === 'approved' ? (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await axios.put(`${API_URL}/shifts/${shift.id}/unapprove`);
                                    if (response.data.success) {
                                      loadShifts();
                                      if (user.role === 'admin') {
                                        loadStatistics();
                                      }
                                      // Update modal data
                                      setSelectedWorkDay({
                                        ...selectedWorkDay,
                                        shifts: selectedWorkDay.shifts.map(s => 
                                          s.id === shift.id ? { ...s, status: 'pending' } : s
                                        )
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Unapproval error:', error);
                                  }
                                }}
                                className="status approved"
                                style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                              >
                                ✅ 승인
                              </button>
                            ) : (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await axios.put(`${API_URL}/shifts/${shift.id}/approve`);
                                    if (response.data.success) {
                                      loadShifts();
                                      if (user.role === 'admin') {
                                        loadStatistics();
                                      }
                                      // Update modal data
                                      setSelectedWorkDay({
                                        ...selectedWorkDay,
                                        shifts: selectedWorkDay.shifts.map(s => 
                                          s.id === shift.id ? { ...s, status: 'approved' } : s
                                        )
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Approval error:', error);
                                  }
                                }}
                                className="status pending"
                                style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                              >
                                ⏳ 대기
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={(e) => { e.stopPropagation(); handleEditSave(); }} className="btn-save">저장</button>
                              <button onClick={(e) => { e.stopPropagation(); handleEditCancel(); }} className="btn-cancel">취소</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={shift.id}>
                          <td><strong>{shift.name}</strong></td>
                          <td>{shift.start_time}</td>
                          <td>{shift.end_time || '-'}</td>
                          <td><strong>{shift.work_hours ? `${shift.work_hours}시간` : '-'}</strong></td>
                          <td>
                            {shift.status === 'approved' ? (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await axios.put(`${API_URL}/shifts/${shift.id}/unapprove`);
                                    if (response.data.success) {
                                      loadShifts();
                                      if (user.role === 'admin') {
                                        loadStatistics();
                                      }
                                      // Update modal data
                                      setSelectedWorkDay({
                                        ...selectedWorkDay,
                                        shifts: selectedWorkDay.shifts.map(s => 
                                          s.id === shift.id ? { ...s, status: 'pending' } : s
                                        )
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Unapproval error:', error);
                                  }
                                }}
                                className="status approved"
                                style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                              >
                                ✅ 승인
                              </button>
                            ) : (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await axios.put(`${API_URL}/shifts/${shift.id}/approve`);
                                    if (response.data.success) {
                                      loadShifts();
                                      if (user.role === 'admin') {
                                        loadStatistics();
                                      }
                                      // Update modal data
                                      setSelectedWorkDay({
                                        ...selectedWorkDay,
                                        shifts: selectedWorkDay.shifts.map(s => 
                                          s.id === shift.id ? { ...s, status: 'approved' } : s
                                        )
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Approval error:', error);
                                  }
                                }}
                                className="status pending"
                                style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
                              >
                                ⏳ 대기
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingShift({
                                  id: shift.id,
                                  date: shift.date,
                                  start_time: shift.start_time,
                                  end_time: shift.end_time || '',
                                  work_hours: shift.work_hours
                                });
                              }} className="btn-edit">수정</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(shift.id); }} className="btn-delete">삭제</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* 청소 현황 탭 */}
      {adminTab === 'cleaning' && (
        <div className="cleaning-dashboard">
          {!adminCleaningStats ? (
            <div className="shifts-section">
              <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>데이터를 불러오는 중...</p>
            </div>
          ) : (
            <>
              <div className="cleaning-stats-section">
                <div className="section-header">
                  <h2>📊 일일 청소 현황</h2>
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      loadAdminCleaningStats(e.target.value);
                    }}
                    className="month-selector"
                  >
                    <option value="2025-10">2025년 10월</option>
                    <option value="2025-09">2025년 9월</option>
                    <option value="2025-08">2025년 8월</option>
                    <option value="2025-07">2025년 7월</option>
                    <option value="2025-06">2025년 6월</option>
                    <option value="2025-05">2025년 5월</option>
                  </select>
                </div>
                <div className="cleaning-stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📅</div>
                    <div className="stat-content">
                      <div className="stat-label">이번 달 평균 청소 완료율</div>
                      <div className="stat-value">{adminCleaningStats.monthlyCompletionRate}%</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🔥</div>
                    <div className="stat-content">
                      <div className="stat-label">연속 완료 일수</div>
                      <div className="stat-value">{adminCleaningStats.consecutiveDays}일</div>
                    </div>
                  </div>
                </div>
                
                <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>📋 월간 청소 캘린더</h3>
                <div className="cleaning-calendar">
                  {(() => {
                    const [year, month] = selectedMonth.split('-');
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const firstDay = new Date(year, month - 1, 1).getDay();
                    const today = getTodayKST();
                    
                    // Create stats map for quick lookup
                    const statsMap = {};
                    if (adminCleaningStats && adminCleaningStats.dailyStats && Array.isArray(adminCleaningStats.dailyStats)) {
                      adminCleaningStats.dailyStats.forEach(stat => {
                        statsMap[stat.date] = stat;
                      });
                    }
                    
                    const weeks = [];
                    let currentWeek = [];
                    
                    // Add empty cells for days before month starts
                    for (let i = 0; i < firstDay; i++) {
                      currentWeek.push(null);
                    }
                    
                    // Add all days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const stat = statsMap[dateStr];
                      
                      currentWeek.push({
                        day,
                        date: dateStr,
                        stat
                      });
                      
                      if (currentWeek.length === 7) {
                        weeks.push(currentWeek);
                        currentWeek = [];
                      }
                    }
                    
                    // Fill last week with empty cells
                    while (currentWeek.length > 0 && currentWeek.length < 7) {
                      currentWeek.push(null);
                    }
                    if (currentWeek.length > 0) {
                      weeks.push(currentWeek);
                    }
                    
                    return (
                      <div className="calendar-grid">
                        <div className="calendar-header">
                          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                            <div key={day} className="calendar-day-name">{day}</div>
                          ))}
                        </div>
                        <div className="calendar-body">
                          {weeks.map((week, weekIdx) => (
                            <div key={weekIdx} className="calendar-week">
                              {week.map((dayData, dayIdx) => {
                                if (!dayData) {
                                  return <div key={dayIdx} className="calendar-day empty"></div>;
                                }
                                
                                const isToday = dayData.date === today;
                                const completionRate = dayData.stat?.completion_rate || 0;
                                
                                // Check if there are any 기타 items for this date
                                const hasEtcItems = cleaningTasks.some(task => {
                                  if (task.category !== '기타') return false;
                                  if (!task.title.includes('|||')) return false;
                                  const dateStr = task.title.split('|||')[1]; // MM/DD
                                  const [month, day] = dateStr.split('/');
                                  const [, currentMonth, currentDay] = dayData.date.split('-');
                                  return month === currentMonth && day === currentDay;
                                });
                                
                                if (completionRate > 100) {
                                  console.log('Date:', dayData.date, 'Completion:', completionRate, 'Overlay width:', completionRate - 100);
                                }
                                
                                return (
                                  <div 
                                    key={dayIdx} 
                                    className={`calendar-day ${isToday ? 'today' : ''} ${dayData.stat ? 'has-data' : 'clickable'}`}
                                    onClick={() => {
                                      console.log('Calendar day clicked:', dayData.date);
                                      setSelectedDayDetail({
                                        date: dayData.date,
                                        completed_count: dayData.stat?.completed_count || 0,
                                        total_tasks: dayData.stat?.total_tasks || 0,
                                        completion_rate: dayData.stat?.completion_rate || 0,
                                        checked_by_name: dayData.stat?.checked_by_name || '-'
                                      });
                                      setShowDayDetailModal(true);
                                      console.log('Modal should open now');
                                    }}
                                  >
                                    <div className="day-number">
                                      {dayData.day}
                                      {hasEtcItems && <span className="etc-indicator-calendar"></span>}
                                    </div>
                                    {dayData.stat && (
                                      <div className="day-progress">
                                        <div className="progress-bars-wrapper">
                                          <div 
                                            className="progress-bar-green progress-bar-shine"
                                            style={{ 
                                              width: `${Math.min(completionRate, 100)}%`,
                                              height: '24px',
                                              background: 'linear-gradient(90deg, #28a745 0%, #20c997 50%, #17a2b8 100%)',
                                              borderRadius: '12px',
                                              position: 'relative',
                                              overflow: 'hidden'
                                            }}
                                          ></div>
                                          {completionRate > 100 && (
                                            <div 
                                              className="progress-bar-red progress-bar-shine"
                                              style={{ 
                                                width: `${Math.max(completionRate - 100, 10)}%`,
                                                height: '24px',
                                                minWidth: '30px',
                                                background: 'linear-gradient(90deg, #ff4444 0%, #ff0000 50%, #cc0000 100%)',
                                                borderRadius: '12px',
                                                position: 'absolute',
                                                top: '0',
                                                left: '0',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                overflow: 'hidden'
                                              }}
                                            ></div>
                                          )}
                                        </div>
                                        <div className="progress-text" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
                                          {completionRate}%
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Day Detail Modal */}
              {showDayDetailModal && selectedDayDetail && (
                <div className="modal-overlay" onClick={() => setShowDayDetailModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>📋 {selectedDayDetail.date} 청소 상세</h2>
                      <button className="modal-close" onClick={() => setShowDayDetailModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                      <div className="day-detail-summary">
                        <div className="summary-item">
                          <span className="summary-label">완료율:</span>
                          <span className={`summary-value ${selectedDayDetail.completion_rate === 100 ? 'complete' : 'partial'}`}>
                            {selectedDayDetail.completion_rate}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">완료 항목:</span>
                          <span className="summary-value">{selectedDayDetail.completed_count}/{selectedDayDetail.total_tasks}</span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">담당자:</span>
                          <span className="summary-value">{selectedDayDetail.checked_by_name || '-'}</span>
                        </div>
                      </div>
                      
                      <DayDetailContent 
                        date={selectedDayDetail.date}
                        userId={user?.id}
                        onUpdate={async () => {
                          // Reload cleaning stats when tasks are updated
                          try {
                            const response = await axios.get(`${API_URL}/admin/cleaning-stats`, {
                              params: { month: selectedMonth }
                            });
                            if (response.data.success) {
                              // Update global stats
                              setAdminCleaningStats(response.data.stats);
                              
                              // Update modal data immediately
                              const updatedDayStat = response.data.stats.dailyStats.find(s => s.date === selectedDayDetail.date);
                              if (updatedDayStat) {
                                setSelectedDayDetail({
                                  date: selectedDayDetail.date,
                                  completed_count: updatedDayStat.completed_count || 0,
                                  total_tasks: updatedDayStat.total_tasks || 0,
                                  completion_rate: updatedDayStat.completion_rate || 0,
                                  checked_by_name: updatedDayStat.checked_by_name || '-'
                                });
                              }
                            }
                          } catch (error) {
                            console.error('Failed to update modal:', error);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly Tasks Modal */}
              {showMonthlyModal && (
                <div className="modal-overlay" onClick={() => setShowMonthlyModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>📅 월 1회 청소 리스트</h2>
                      <button className="modal-close" onClick={() => setShowMonthlyModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                      <div className="checklist-grid">
                        {adminMonthlyTasks.map(task => (
                          <div key={task.id} className={`checklist-item ${task.checked ? 'checked' : ''}`}>
                            <span className="checkbox">{task.checked ? '✅' : '⬜'}</span>
                            <span className="task-name">{task.task_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Weekly Tasks Modal */}
              {showWeeklyModal && (
                <div className="modal-overlay" onClick={() => setShowWeeklyModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h2>📅 주 1회 청소 리스트</h2>
                      <button className="modal-close" onClick={() => setShowWeeklyModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                      <div className="checklist-grid">
                        {adminWeeklyTasks.map(task => (
                          <div key={task.id} className={`checklist-item ${task.checked ? 'checked' : ''}`}>
                            <span className="checkbox">{task.checked ? '✅' : '⬜'}</span>
                            <span className="task-name">{task.task_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 노무 관리 탭 */}
      {adminTab === 'hr' && (
        <div className="hr-dashboard">
          <div className="shifts-section">
            <div className="section-header">
              <h2>👥 직원 관리</h2>
            </div>
            
            {/* 근무지 필터 */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold' }}>근무지:</label>
              <select 
                value={workplaceFilter} 
                onChange={(e) => setWorkplaceFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ddd' }}
              >
                <option value="all">전체</option>
                <option value="서울역 홀">서울역 홀</option>
                <option value="서울역 주방">서울역 주방</option>
                <option value="목동 홀">목동 홀</option>
                <option value="목동 주방">목동 주방</option>
              </select>
            </div>

            {/* 요약 카드 */}
            <div className="hr-summary-cards">
              <div className="hr-card">
                <div className="hr-card-icon">👥</div>
                <div className="hr-card-content">
                  <div className="hr-card-label">총 직원 수</div>
                  <div className="hr-card-value">{employees.filter(e => e.role !== 'cleaning' && (workplaceFilter === 'all' || e.workplace === workplaceFilter)).length}명</div>
                </div>
              </div>
              <div className="hr-card">
                <div className="hr-card-icon">💼</div>
                <div className="hr-card-content">
                  <div className="hr-card-label">알바생 (PT)</div>
                  <div className="hr-card-value">{employees.filter(e => e.position === 'PT' && (workplaceFilter === 'all' || e.workplace === workplaceFilter)).length}명</div>
                </div>
              </div>
            </div>

            {/* 직원 테이블 */}
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>직급</th>
                  <th>근무지</th>
                  <th>PIN</th>
                  <th>전화번호</th>
                  <th>입사일</th>
                  <th>시급</th>
                </tr>
              </thead>
              <tbody>
                {employees.filter(e => e.role !== 'cleaning' && (workplaceFilter === 'all' || e.workplace === workplaceFilter)).length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      직원 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  employees.filter(e => e.role !== 'cleaning' && (workplaceFilter === 'all' || e.workplace === workplaceFilter)).map(emp => (
                    <tr 
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setShowEmployeeModal(true);
                      }}
                      style={{ cursor: 'pointer' }}
                      className="clickable-row"
                    >
                      <td><strong>{emp.name}</strong></td>
                      <td>{emp.position || '직원'}</td>
                      <td>{emp.workplace || '서울역 홀'}</td>
                      <td>{emp.pin || '-'}</td>
                      <td>{emp.phone || '-'}</td>
                      <td>{emp.hire_date || '-'}</td>
                      <td>{emp.hourly_wage ? `${emp.hourly_wage.toLocaleString()}원` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 직원 상세 모달 */}
          {showEmployeeModal && selectedEmployee && (
            <div className="modal-overlay" onClick={() => setShowEmployeeModal(false)}>
              <div className="modal-content employee-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>👤 {selectedEmployee.name} 상세 정보</h2>
                  <button className="modal-close" onClick={() => setShowEmployeeModal(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="employee-detail-card">
                    <div className="employee-detail-section">
                      <h3>기본 정보</h3>
                      <div className="employee-detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">이름</span>
                          <span className="detail-value">{selectedEmployee.name}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">직급</span>
                          <span className="detail-value">{selectedEmployee.position || '직원'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">근무지</span>
                          <span className="detail-value">{selectedEmployee.workplace || '서울역 홀'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">PIN</span>
                          <span className="detail-value">{selectedEmployee.pin || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="employee-detail-section">
                      <h3>연락처 정보</h3>
                      <div className="employee-detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">📞 전화번호</span>
                          <span className="detail-value">{selectedEmployee.phone || '미등록'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">📧 이메일</span>
                          <span className="detail-value">{selectedEmployee.email || '미등록'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="employee-detail-section">
                      <h3>근무 정보</h3>
                      <div className="employee-detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">📅 입사일</span>
                          <span className="detail-value">{selectedEmployee.hire_date || '미등록'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">💰 시급</span>
                          <span className="detail-value">
                            {selectedEmployee.hourly_wage ? `${selectedEmployee.hourly_wage.toLocaleString()}원` : '미등록'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedEmployee.memo && (
                      <div className="employee-detail-section">
                        <h3>메모</h3>
                        <div className="detail-memo">
                          {selectedEmployee.memo}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
