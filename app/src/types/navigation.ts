import type { ClockEventType } from './database';

export type RootStackParamList = {
  Home: undefined;
  CameraCapture: {
    employeeId: number;
    employeeName: string;
    eventType: ClockEventType;
  };
  Confirmation: {
    employeeName: string;
    eventType: ClockEventType;
    timestamp: string;
  };
  AdminAuth: undefined;
  AdminDashboard: undefined;
  AdminEmployees: undefined;
  AdminEmployeeForm:
    | {
        mode: 'create';
      }
    | {
        mode: 'edit';
        employeeId: number;
      };
  AdminResetEmployeePin: {
    employeeId: number;
    employeeName: string;
  };
  AdminLogs: undefined;
  AdminSettings: undefined;
  AdminPayrollHours: undefined;
  AdminChangePin: undefined;
  AdminDangerZone: undefined;
};
