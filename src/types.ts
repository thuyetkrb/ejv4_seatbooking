export type WorkingMode = 'WFO' | 'WFH' | 'LEAVE' | 'FLEXID' | 'HOLIDAY';

export interface User {
  userId: string;
  name: string;
  team: string;
  project: string;
  group?: string;
  active: boolean;
  colorTag?: string;
  assignedSeat?: string;
  role?: 'admin' | 'user';
}

export interface Seat {
  seatCode: string;
  zone: string;
  position: { row: number; col: number };
  seatType: 'normal' | 'special' | 'area';
  active: boolean;
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  userId: string;
  mode: WorkingMode;
  seatCode?: string;
  note?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  time: string;
  actor: string;
  action: 'ASSIGN_SEAT' | 'CHANGE_MODE' | 'CLEAR' | 'EDIT_LAYOUT' | 'IMPORT_CONFIG';
  target: string;
  before: any;
  after: any;
}

export interface AppData {
  users: User[];
  seats: Seat[];
  attendance: AttendanceRecord[];
  logs: AuditLog[];
}
