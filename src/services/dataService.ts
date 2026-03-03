import { User, Seat, AttendanceRecord, AuditLog } from '../types';

const STORAGE_KEY_ATTENDANCE = 'seat_dashboard_attendance';
const STORAGE_KEY_LOGS = 'seat_dashboard_logs';

const RAW_DATA = [
  { project: 'PgM', name: 'Park Kwang', mode: 'WFO', group: 'EJV4', seat: 'D1' },
  { project: 'Honda', name: 'Bach Mai Tuyet Nhu', mode: 'WFO', group: 'EJV4', seat: 'D18' },
  { project: 'Honda', name: 'Huynh Minh Sang', mode: 'Hybrid', group: 'EJV4', seat: 'D13' },
  { project: 'Honda', name: 'Ngo Huu Dat', mode: 'WFO', group: 'EJV5', seat: 'D17' },
  { project: 'Honda', name: 'Nguyen Huu Thuyet', mode: 'WFO', group: 'EJV4', seat: 'D12' },
  { project: 'Honda', name: 'Nguyen Quoc Bao', mode: 'Hybrid', group: 'EJV4', seat: 'D19' },
  { project: 'Honda', name: 'Dinh Viet Thuan', mode: 'WFO', group: 'EJV5', seat: 'D24' },
  { project: 'Honda', name: 'Pham Thi Phuong Loan', mode: 'WFO', group: 'EJV5', seat: 'D20' },
  { project: 'Honda', name: 'Ta Minh Chi', mode: 'Hybrid', group: 'EJV5', seat: 'D11' },
  { project: 'Honda', name: 'Ton Tran Gia Hung', mode: 'WFO', group: 'EJV5', seat: 'D13' },
  { project: 'Honda', name: 'Huynh Ngoc Minh Quan', mode: 'Hybrid', group: 'EJV4', seat: 'D19' },
  { project: 'Nissan', name: 'Nguyen Xuan My', mode: '', group: 'EJV4', seat: 'D14' },
  { project: 'Nissan', name: 'Nguyen Thanh Phong', mode: '', group: 'EJV1', seat: 'D23' },
  { project: 'Nissan', name: 'Nguyen Buu Thach', mode: '', group: 'EJV5', seat: 'D15' },
  { project: 'Nissan', name: 'Hoang Thanh Tu', mode: '', group: 'EJV4', seat: 'D23' },
  { project: 'FFV', name: 'Ngo Ton Quyen', mode: '', group: 'EJV4', seat: 'D2' },
  { project: 'FFV', name: 'Do Quoc Hung', mode: 'WFO', group: 'EJV4', seat: 'D4' },
  { project: 'FFV', name: 'Giang Kim Thach', mode: 'Hybrid', group: 'EJV4', seat: 'D22' },
  { project: 'FFV', name: 'Nguyen Ngoc Son', mode: '', group: 'EJV5', seat: 'D22' },
  { project: 'FFV', name: 'Vo Quoc Khanh', mode: '', group: 'EJV5', seat: 'D5' },
  { project: 'FFV', name: 'Huynh Trung Nguyen', mode: '', group: 'EJV5', seat: 'D3' },
  { project: 'FFV', name: 'Tran Ba Huy', mode: '', group: 'EJV5', seat: 'D10' },
  { project: 'FFV', name: 'Nguyen Le Nguyen', mode: '', group: 'EJV5', seat: 'D16' },
  { project: 'VCCU', name: 'Nguyen Ngoc Duy', mode: 'WFO', group: 'EJV4', seat: 'D6' },
  { project: 'VCCU', name: 'Mai Hong Sang', mode: '', group: 'EJV4', seat: 'D8' },
  { project: 'VCCU', name: 'Huynh Giao Con', mode: '', group: 'PS-CS', seat: 'D9' },
  { project: 'VCCU', name: 'Lam Quoc Thinh', mode: '', group: 'EJV4', seat: 'D7' },
  { project: 'VCCU', name: 'Vo Quang Huy', mode: '', group: 'EJV5', seat: 'D21' },
  { project: 'VCCU', name: 'Pham Anh Duy', mode: 'WFO', group: 'EJV5', seat: 'D21' },
];

const MOCK_USERS: User[] = RAW_DATA.map((item, index) => ({
  userId: item.name === 'Nguyen Huu Thuyet' ? 'GTH8HC' : `U${(index + 1).toString().padStart(3, '0')}`,
  name: item.name,
  team: item.project,
  project: item.project,
  group: item.group,
  active: true,
  assignedSeat: item.seat,
  role: item.name === 'Nguyen Huu Thuyet' ? 'admin' : 'user',
}));

const STORAGE_KEY_USERS = 'seat_dashboard_users';

// Define exact positions based on the image layout (12-column grid)
const SEAT_LAYOUT_CONFIG = [
  // Cluster Top Right (D1-D10, EPS, ETA)
  { code: 'EPS-1', zone: 'EPS', r: 0, c: 8 }, { code: 'EPS-2', zone: 'EPS', r: 0, c: 9 }, { code: 'EPS-3', zone: 'EPS', r: 0, c: 10 },
  { code: 'D4', zone: 'D', r: 2, c: 8 }, { code: 'D5', zone: 'D', r: 2, c: 9 }, { code: 'EPS-4', zone: 'EPS', r: 2, c: 10 },
  { code: 'D3', zone: 'D', r: 3, c: 8 }, { code: 'D2', zone: 'D', r: 3, c: 9 }, { code: 'D1', zone: 'D', r: 3, c: 10 },
  { code: 'D7', zone: 'D', r: 5, c: 8 }, { code: 'D6', zone: 'D', r: 5, c: 9 }, { code: 'X-1', zone: 'X', r: 5, c: 10 },
  { code: 'D8', zone: 'D', r: 6, c: 8 }, { code: 'D9', zone: 'D', r: 6, c: 9 }, { code: 'X-2', zone: 'X', r: 6, c: 10 },
  { code: 'D10', zone: 'D', r: 8, c: 8 }, { code: 'ETA-1', zone: 'ETA', r: 8, c: 9 }, { code: 'ETA-2', zone: 'ETA', r: 8, c: 10 },
  { code: 'ETA-3', zone: 'ETA', r: 9, c: 8 }, { code: 'ETA-4', zone: 'ETA', r: 9, c: 9 }, { code: 'ETA-5', zone: 'ETA', r: 9, c: 10 },

  // Cluster Middle Left (D11-D20)
  { code: 'D20', zone: 'D', r: 8, c: 0 }, { code: 'D19', zone: 'D', r: 8, c: 1 }, { code: 'D13', zone: 'D', r: 8, c: 2 }, { code: 'D12', zone: 'D', r: 8, c: 3 }, { code: 'D11', zone: 'D', r: 8, c: 4 },
  { code: 'D18', zone: 'D', r: 9, c: 0 }, { code: 'D17', zone: 'D', r: 9, c: 1 }, { code: 'D16', zone: 'D', r: 9, c: 2 }, { code: 'D15', zone: 'D', r: 9, c: 3 }, { code: 'D14', zone: 'D', r: 9, c: 4 },

  // Cluster Bottom (D21-D24) - Zone C
  { code: 'D24', zone: 'D', r: 12, c: 0 }, { code: 'D23', zone: 'D', r: 12, c: 1 }, { code: 'D22', zone: 'D', r: 12, c: 2 }, { code: 'D21', zone: 'D', r: 12, c: 3 },
];

const MOCK_SEATS: Seat[] = SEAT_LAYOUT_CONFIG.map(s => ({
  seatCode: s.code,
  zone: s.zone,
  position: { row: s.r, col: s.c },
  seatType: s.zone === 'X' ? 'special' : 'normal',
  active: s.zone !== 'X',
}));

export const dataService = {
  async fetchConfig(): Promise<{ users: User[]; seats: Seat[] }> {
    const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    const users = savedUsers ? JSON.parse(savedUsers) : MOCK_USERS;
    return { users, seats: MOCK_SEATS };
  },

  saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  },

  getAttendance(): AttendanceRecord[] {
    const data = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    return data ? JSON.parse(data) : [];
  },

  saveAttendance(records: AttendanceRecord[]) {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
  },

  getLogs(): AuditLog[] {
    const data = localStorage.getItem(STORAGE_KEY_LOGS);
    return data ? JSON.parse(data) : [];
  },

  addLog(log: Omit<AuditLog, 'id' | 'time'>) {
    const logs = this.getLogs();
    const newLog: AuditLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify([newLog, ...logs].slice(0, 100)));
  }
};
