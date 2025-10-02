import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 프로덕션에서는 /api, 개발에서는 localhost 사용
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5001/api');

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  // Load shifts when user logs in or month/staff changes
  useEffect(() => {
    if (user) {
      loadShifts();
      if (user.role === 'admin') {
        loadStatistics();
      }
    }
  }, [user, selectedMonth, selectedStaff]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/login`, { username, password });
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
    setUsername('');
    setPassword('');
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
        setMessage('퇴근 처리되었습니다!');
        loadShifts();
        setTimeout(() => setMessage(''), 3000);
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
        setMessage('삭제되었습니다!');
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
        }
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('삭제 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Start editing shift
  const handleEditStart = (shift) => {
    setEditingShift({
      id: shift.id,
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
    if (!editingShift.start_time || !editingShift.end_time) {
      setMessage('출근 시간과 퇴근 시간을 모두 입력해주세요');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    try {
      console.log('Saving shift:', editingShift);
      const response = await axios.put(`${API_URL}/shifts/${editingShift.id}`, {
        start_time: editingShift.start_time,
        end_time: editingShift.end_time,
        work_hours: editingShift.work_hours
      });
      console.log('Response:', response.data);
      if (response.data.success) {
        setMessage('수정되었습니다!');
        setEditingShift(null);
        loadShifts();
        if (user.role === 'admin') {
          loadStatistics();
        }
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Edit error:', error);
      setMessage(error.response?.data?.message || '수정 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Check if already clocked in today
  const isClockedInToday = () => {
    const today = new Date().toISOString().split('T')[0];
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

  // Login Screen
  if (!user) {
    return (
      <div className="container">
        <div className="login-box">
          <h1>🏢 출퇴근 관리 시스템</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">로그인</button>
          </form>
          {message && <div className="message">{message}</div>}
          <div className="test-accounts">
            <p><strong>테스트 계정:</strong></p>
            <p>👔 관리자: admin / admin</p>
            <p>👤 알바생: st01~st08 / st01~st08</p>
            <p style={{fontSize: '11px', color: '#999', marginTop: '8px'}}>
              예시: st01 / st01, st02 / st02 ...
            </p>
          </div>
        </div>
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
          <h2>📅 오늘 날짜: {new Date().toLocaleDateString('ko-KR')}</h2>
          <div className="button-group">
            <button 
              onClick={handleClockIn} 
              className="btn-primary"
              disabled={isClockedInToday()}
            >
              🟢 출근하기
            </button>
            <button 
              onClick={handleClockOut} 
              className="btn-danger"
              disabled={!isClockedInToday()}
            >
              🔴 퇴근하기
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
              <th>아이디</th>
              <th>총 근무일수</th>
              <th>총 근무시간</th>
              <th>승인 완료 시간</th>
            </tr>
          </thead>
          <tbody>
            {statistics.length === 0 ? (
              <tr>
                <td colSpan="5">통계 데이터가 없습니다</td>
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
                  <td>{stat.username}</td>
                  <td>{stat.shift_count || 0}일</td>
                  <td><strong>{stat.total_hours || 0}시간</strong></td>
                  <td><strong>{stat.approved_hours || 0}시간</strong></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="3"><strong>전체 합계</strong></td>
              <td><strong>{statistics.reduce((sum, stat) => sum + (stat.total_hours || 0), 0)}시간</strong></td>
              <td><strong>{statistics.reduce((sum, stat) => sum + (stat.approved_hours || 0), 0)}시간</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 전체 근무 기록 */}
      <div className={`shifts-section records-section ${printMode === 'statistics' ? 'print-hide' : ''}`}>
        <div className="section-header">
          <h2>
            📋 {selectedStaff === 'all' 
              ? '전체 근무 기록' 
              : `${statistics.find(s => s.id.toString() === selectedStaff)?.name || ''} 근무 기록`}
          </h2>
          <div className="header-controls">
            <select 
              value={selectedStaff} 
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="month-selector"
            >
              <option value="all">전체 알바생</option>
              {statistics.map(stat => (
                <option key={stat.id} value={stat.id}>
                  {stat.name} ({stat.username})
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
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>날짜</th>
              <th>출근 시간</th>
              <th>퇴근 시간</th>
              <th>근무 시간</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan="7">근무 기록이 없습니다</td>
              </tr>
            ) : (
              shifts.map(shift => (
                editingShift && editingShift.id === shift.id ? (
                  <tr key={shift.id} className="editing-row">
                    <td>{shift.name}</td>
                    <td>{shift.date}</td>
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
                        pattern="[0-9]{2}:[0-9]{2}"
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
                        pattern="[0-9]{2}:[0-9]{2}"
                        className="time-input"
                      />
                    </td>
                    <td>{editingShift.work_hours}시간</td>
                    <td>
                      <span className={`status ${shift.status}`}>
                        {shift.status === 'approved' ? '✅ 승인' : '⏳ 대기'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={handleEditSave}
                          className="btn-save"
                        >
                          저장
                        </button>
                        <button 
                          onClick={handleEditCancel}
                          className="btn-cancel"
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={shift.id}>
                    <td>{shift.name}</td>
                    <td>{shift.date}</td>
                    <td>{shift.start_time}</td>
                    <td>{shift.end_time || '-'}</td>
                    <td>{shift.work_hours ? `${shift.work_hours}시간` : '-'}</td>
                    <td>
                      <span className={`status ${shift.status}`}>
                        {shift.status === 'approved' ? '✅ 승인' : '⏳ 대기'}
                      </span>
                      {shift.is_modified && <span className="modified-badge">✏️</span>}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {shift.status === 'pending' && (
                          <button 
                            onClick={() => handleApprove(shift.id)}
                            className="btn-approve"
                          >
                            승인
                          </button>
                        )}
                        <button 
                          onClick={() => handleEditStart(shift)}
                          className="btn-edit"
                        >
                          수정
                        </button>
                        <button 
                          onClick={() => handleDelete(shift.id)}
                          className="btn-delete"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
