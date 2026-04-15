// Database types
export type Store = {
  id: string;
  slug: string;
  name: string;
  plan: 'FREE' | 'TRIAL' | 'PRO';
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
};

export type Staff = {
  id: number;
  store_id: string;
  auth_user_id: string | null;
  name: string;
  pin_hash: string;
  phone: string | null;
  email: string | null;
  position: string;
  workplace: string | null;
  hire_date: string | null;
  hourly_wage: number | null;
  regular_start_time: string | null;
  health_certificate_expiry: string | null;
  memo: string | null;
  active: boolean;
  pin_failed_count: number;
  pin_locked_until: string | null;
  created_at: string;
  updated_at: string;
};

export type Shift = {
  id: number;
  store_id: string;
  staff_id: number;
  date: string;
  start_time: string;
  end_time: string | null;
  work_hours: number | null;
  status: 'pending' | 'approved' | 'rejected';
  is_modified: boolean;
  is_late: boolean;
  late_minutes: number;
  late_exempt: boolean;
  late_note: string | null;
  approved_by: number | null;
  approved_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftWithStaff = Shift & {
  staff: {
    name: string;
    position: string;
  };
};

export type MonthlyStaffSummary = {
  id: number;
  store_id: string;
  staff_id: number;
  year_month: string;
  total_hours: number;
  total_days: number;
  late_count: number;
  approved_hours: number;
  approved_days: number;
  updated_at: string;
};

export type CleaningTask = {
  id: number;
  store_id: string;
  title: string;
  category: string;
  order_num: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyCleaning = {
  id: number;
  store_id: string;
  task_id: number;
  date: string;
  checked_by: number | null;
  checked_at: string;
  check_level: 1 | 2;
};
