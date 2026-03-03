import { User, Seat, AttendanceRecord, AuditLog, Notice } from '../types';
import { googleSheetService } from './googleSheetService';
import { CONFIG } from '../config';

const STORAGE_KEY_ATTENDANCE = 'seat_dashboard_attendance';
const STORAGE_KEY_LOGS = 'seat_dashboard_logs';
const STORAGE_KEY_NOTICES = 'seat_dashboard_notices';
const STORAGE_KEY_USERS = 'seat_dashboard_users';
const STORAGE_KEY_GUIDE = 'seat_dashboard_guide';

const SEAT_LAYOUT_CONFIG = [
  { code: 'EPS-1', zone: 'EPS', r: 0, c: 8 }, { code: 'EPS-2', zone: 'EPS', r: 0, c: 9 }, { code: 'EPS-3', zone: 'EPS', r: 0, c: 10 },
  { code: 'D4', zone: 'D', r: 2, c: 8 }, { code: 'D5', zone: 'D', r: 2, c: 9 }, { code: 'EPS-4', zone: 'EPS', r: 2, c: 10 },
  { code: 'D3', zone: 'D', r: 3, c: 8 }, { code: 'D2', zone: 'D', r: 3, c: 9 }, { code: 'D1', zone: 'D', r: 3, c: 10 },
  { code: 'D7', zone: 'D', r: 5, c: 8 }, { code: 'D6', zone: 'D', r: 5, c: 9 }, { code: 'X-1', zone: 'X', r: 5, c: 10 },
  { code: 'D8', zone: 'D', r: 6, c: 8 }, { code: 'D9', zone: 'D', r: 6, c: 9 }, { code: 'X-2', zone: 'X', r: 6, c: 10 },
  { code: 'D10', zone: 'D', r: 8, c: 8 }, { code: 'ETA-1', zone: 'ETA', r: 8, c: 9 }, { code: 'ETA-2', zone: 'ETA', r: 8, c: 10 },
  { code: 'ETA-3', zone: 'ETA', r: 9, c: 8 }, { code: 'ETA-4', zone: 'ETA', r: 9, c: 9 }, { code: 'ETA-5', zone: 'ETA', r: 9, c: 10 },
  { code: 'D20', zone: 'D', r: 8, c: 0 }, { code: 'D19', zone: 'D', r: 8, c: 1 }, { code: 'D13', zone: 'D', r: 8, c: 2 }, { code: 'D12', zone: 'D', r: 8, c: 3 }, { code: 'D11', zone: 'D', r: 8, c: 4 },
  { code: 'D18', zone: 'D', r: 9, c: 0 }, { code: 'D17', zone: 'D', r: 9, c: 1 }, { code: 'D16', zone: 'D', r: 9, c: 2 }, { code: 'D15', zone: 'D', r: 9, c: 3 }, { code: 'D14', zone: 'D', r: 9, c: 4 },
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
    // Try to fetch from Google Sheets first
    const sheetUsers = await googleSheetService.fetchSheetData(CONFIG.SHEETS.USERS);
    
    let users: User[] = [];
    
    if (sheetUsers.length > 0) {
      users = sheetUsers.map(u => ({
        userId: u.userId || u.UserID || '',
        name: u.name || u.Name || '',
        team: u.team || u.Team || '',
        project: u.project || u.Project || '',
        group: u.group || u.Group || '',
        active: String(u.active || u.Active).toLowerCase() === 'true' || u.active === true,
        assignedSeat: u.assignedSeat || u.AssignedSeat || '',
        role: u.role || u.Role || 'user',
        password: u.password || u.Password || 'password123',
        phone: u.phone || u.Phone || '',
        email: u.email || u.Email || '',
        address: u.address || u.Address || ''
      }));
    }

    return { users, seats: MOCK_SEATS };
  },

  async saveAllData(data: {
    users: User[];
    attendance: AttendanceRecord[];
    logs: AuditLog[];
    guide: string;
    notices: Notice[];
  }) {
    const results = await Promise.all([
      googleSheetService.saveData(CONFIG.SHEETS.USERS, data.users),
      googleSheetService.saveData(CONFIG.SHEETS.ATTENDANCE, data.attendance),
      googleSheetService.saveData(CONFIG.SHEETS.HISTORY, data.logs.map(l => ({
        id: l.id,
        time: l.time,
        actor: l.actor,
        action: l.action,
        target: l.target,
        before_json: JSON.stringify(l.before),
        after_json: JSON.stringify(l.after)
      }))),
      googleSheetService.saveData(CONFIG.SHEETS.GUIDE, [{ content: data.guide }]),
      googleSheetService.saveData(CONFIG.SHEETS.NOTICE, data.notices),
    ]);
    return results.every(r => r);
  },

  async saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    await googleSheetService.saveData(CONFIG.SHEETS.USERS, users, 'update');
  },

  async updateUser(user: User) {
    await googleSheetService.saveData(CONFIG.SHEETS.USERS, [user], 'updatebykey', 'userId');
  },

  async changePassword(user: User, newPassword: string) {
    const updatedUser = { ...user, password: newPassword };
    
    // Update local storage if possible
    const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    if (savedUsers) {
      let users: User[] = JSON.parse(savedUsers);
      const idx = users.findIndex(u => u.userId === user.userId);
      if (idx > -1) {
        users[idx].password = newPassword;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      }
    }
    
    return await googleSheetService.saveData(CONFIG.SHEETS.USERS, [updatedUser], 'updatebykey', 'userId');
  },

  async getAttendance(): Promise<AttendanceRecord[]> {
    const sheetAttendance = await googleSheetService.fetchSheetData(CONFIG.SHEETS.ATTENDANCE);
    if (sheetAttendance.length > 0) {
      return sheetAttendance.map(r => ({
        date: r.date || r.Date || '',
        userId: r.userId || r.UserID || '',
        mode: (r.mode || r.Mode || 'WFO') as any,
        seatCode: r.seatCode || r.SeatCode || '',
        note: r.note || r.Note || '',
        updatedAt: r.updatedAt || r.UpdatedAt || new Date().toISOString(),
        updatedBy: r.updatedBy || r.UpdatedBy || 'System'
      }));
    }
    const data = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    return data ? JSON.parse(data) : [];
  },

  async saveAttendance(records: AttendanceRecord[]) {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    await googleSheetService.saveData(CONFIG.SHEETS.ATTENDANCE, records);
  },

  async getLogs(): Promise<AuditLog[]> {
    const sheetLogs = await googleSheetService.fetchSheetData(CONFIG.SHEETS.HISTORY);
    if (sheetLogs.length > 0) {
      return sheetLogs.map(l => ({
        id: l.id || l.ID || '',
        time: l.time || l.Time || '',
        actor: l.actor || l.Actor || '',
        action: (l.action || l.Action || 'CHANGE_MODE') as any,
        target: l.target || l.Target || '',
        before: (l.before_json || l.Before_json) ? JSON.parse(l.before_json || l.Before_json) : null,
        after: (l.after_json || l.After_json) ? JSON.parse(l.after_json || l.After_json) : null
      }));
    }
    const data = localStorage.getItem(STORAGE_KEY_LOGS);
    return data ? JSON.parse(data) : [];
  },

  async addLog(log: Omit<AuditLog, 'id' | 'time'>) {
    const data = localStorage.getItem(STORAGE_KEY_LOGS);
    const logs = data ? JSON.parse(data) : [];
    const newLog: AuditLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toISOString(),
    };
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
    
    await googleSheetService.saveData(CONFIG.SHEETS.HISTORY, [{
      id: newLog.id,
      time: newLog.time,
      actor: newLog.actor,
      action: newLog.action,
      target: newLog.target,
      before_json: JSON.stringify(newLog.before),
      after_json: JSON.stringify(newLog.after)
    }], 'append');
  },

  async getGuide(): Promise<string> {
    const sheetGuide = await googleSheetService.fetchSheetData(CONFIG.SHEETS.GUIDE);
    if (sheetGuide.length > 0) {
      return sheetGuide[0].content || sheetGuide[0].Content || '';
    }
    return localStorage.getItem(STORAGE_KEY_GUIDE) || '';
  },

  async saveGuide(content: string) {
    localStorage.setItem(STORAGE_KEY_GUIDE, content);
    await googleSheetService.saveData(CONFIG.SHEETS.GUIDE, [{ content }]);
  },

  async getNotices(): Promise<Notice[]> {
    const sheetNotices = await googleSheetService.fetchSheetData(CONFIG.SHEETS.NOTICE);
    let notices: Notice[] = [];
    if (sheetNotices.length > 0) {
      notices = sheetNotices.map(n => ({
        id: n.id || n.ID || '',
        title: n.title || n.Title || '',
        content: n.content || n.Content || '',
        poster: n.poster || n.Poster || '',
        posterId: n.posterId || n.PosterID || '',
        date: n.date || n.Date || ''
      }));
    } else {
      const data = localStorage.getItem(STORAGE_KEY_NOTICES);
      notices = data ? JSON.parse(data) : [];
    }
    return notices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async saveNotice(notice: Omit<Notice, 'id' | 'date'>) {
    const data = localStorage.getItem(STORAGE_KEY_NOTICES);
    const notices = data ? JSON.parse(data) : [];
    const newNotice: Notice = {
      ...notice,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
    };
    const updatedNotices = [newNotice, ...notices];
    localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(updatedNotices));
    await googleSheetService.saveData(CONFIG.SHEETS.NOTICE, updatedNotices);
  },

  async deleteNotice(id: string) {
    const data = localStorage.getItem(STORAGE_KEY_NOTICES);
    const notices = data ? JSON.parse(data) : [];
    const updatedNotices = notices.filter((n: Notice) => n.id !== id);
    localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(updatedNotices));
    await googleSheetService.saveData(CONFIG.SHEETS.NOTICE, updatedNotices);
  }
};
