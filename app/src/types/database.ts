export type ClockEventType = 'IN' | 'OUT';
export type ClockEventSource = 'MANUAL' | 'AUTO';
export type ClockEventAdminTag = 'NONE' | 'CREATED' | 'EDITED';

export interface EmployeeRecord {
  id: number;
  name: string;
  job_title: string;
  hourly_rate: number;
  department: string;
  start_date: string;
  photo_path: string | null;
  address: string | null;
  email: string | null;
  phone_number: string;
  pin_hash: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeePayRateRecord {
  id: number;
  employee_id: number;
  hourly_rate: number;
  effective_start_date: string;
  created_at: string;
  updated_at: string;
}

export interface ClockEventRecord {
  id: number;
  employee_id: number;
  type: ClockEventType;
  source: ClockEventSource;
  admin_tag: ClockEventAdminTag;
  last_edited_at: string | null;
  timestamp: string;
  photo_path: string;
  created_at: string;
}

export interface ClockEventWithEmployee extends ClockEventRecord {
  employee_name: string | null;
}

export interface AuditLogRecord {
  id: number;
  actor_type: string;
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details_json: string | null;
  created_at: string;
}

export interface PayrollPeriodApprovalRecord {
  period_start_date: string;
  period_end_date: string;
  note: string | null;
  approved_at: string;
  updated_at: string;
}
