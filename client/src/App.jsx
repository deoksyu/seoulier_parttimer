import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shifts, setShifts] = useState([]);
  const [message, setMessage] = useState('');

  // Load shifts when user logs in
  useEffect(() => {
    if (user) {
      loadShifts();
    }
  }, [user]);

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
        params: { userId: user.id, role: user.role }
      });
      if (response.data.success) {
        setShifts(response.data.shifts);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    }
  };

  // Approve shift
  const handleApprove = async (shiftId) => {
    try {
      const response = await axios.put(`${API_URL}/shifts/${shiftId}/approve`);
      if (response.data.success) {
        setMessage('승인되었습니다!');
        loadShifts();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('승인 처리 실패');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Check if already clocked in today
  const isClockedInToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return shifts.some(shift => shift.date === today && !shift.end_time);
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
          <h2>📊 내 근무 내역</h2>
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
                  <tr key={shift.id}>
                    <td>{shift.date}</td>
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
      
      <div className="shifts-section">
        <h2>📋 전체 근무 기록</h2>
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
                  </td>
                  <td>
                    {shift.status === 'pending' && (
                      <button 
                        onClick={() => handleApprove(shift.id)}
                        className="btn-approve"
                      >
                        승인
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
