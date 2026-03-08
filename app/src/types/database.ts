export type ClockEventType = 'IN' | 'OUT';
export type ClockEventSource = 'MANUAL' | 'AUTO';
export type ClockEventAdminTag = 'NONE' | 'CREATED' | 'EDITED';

export interface EmployeeRecord {
  id: number;
  name: string;
  pin_hash: string;
  pin_code: string | null;
  active: number;
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
