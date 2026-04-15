/**
 * 근무시간 계산 (기존 calculateWorkHours 이식)
 * - 10:00 이전 출근 → 10:00으로 보정
 * - 15:00-17:00 휴게시간 제외
 * - 30분 단위 반올림
 */
export function calculateWorkHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // 10:00 이전 출근 → 10:00으로 보정
  const workStartThreshold = 10 * 60;
  if (startMinutes < workStartThreshold) {
    startMinutes = workStartThreshold;
  }

  if (endMinutes < workStartThreshold) {
    return 0;
  }

  let diffMinutes = endMinutes - startMinutes;

  // 휴게시간 15:00-17:00 제외
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

/**
 * KST 오늘 날짜 (YYYY-MM-DD)
 */
export function getTodayKST(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * KST 현재 시간 (HH:mm:ss)
 */
export function getCurrentTimeKST(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 시간 포맷팅 (HH:mm)
 */
export function formatTime(time: string): string {
  return time.substring(0, 5);
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export function formatDate(date: string | Date): string {
  if (typeof date === 'string') return date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
