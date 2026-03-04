import { User, Seat, AttendanceRecord, AuditLog, Notice } from '../types';
import { googleSheetService } from './googleSheetService';
import { CONFIG } from '../config';
import { format } from 'date-fns';

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
  // Helper to get value from object with case-insensitive key
  getValue(obj: any, key: string): any {
    if (!obj) return '';
    const foundKey = Object.keys(obj).find(k => k.toLowerCase().replace(/\s/g, '') === key.toLowerCase().replace(/\s/g, ''));
    return foundKey ? obj[foundKey] : '';
  },

  // Helper to normalize date to dd-MMM-yyyy (Local aware)
  normalizeDate(dateStr: any): string {
    if (!dateStr) return '';
    try {
      const s = String(dateStr).trim();
      
      // If it's an ISO string with T, just take the date part to avoid TZ shifts
      let baseDateStr = s;
      if (s.includes('T')) {
        baseDateStr = s.split('T')[0];
      }

      // Handle common formats manually to avoid JS Date parsing traps
      // Match YYYY-MM-DD or YYYY-M-D or YYYY/M/D
      const ymdMatch = baseDateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymdMatch) {
        const d = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
        return format(d, 'dd-MMM-yyyy');
      }

      // Match DD/MM/YYYY or D/M/YYYY or D-M-YYYY
      const dmyMatch = baseDateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
        return format(d, 'dd-MMM-yyyy');
      }

      // Match DD-MMM-YYYY (e.g., 04-Mar-2026)
      const dmmmYMatch = baseDateStr.match(/^(\d{1,2})[\/\-]([a-zA-Z]{3})[\/\-](\d{4})$/);
      if (dmmmYMatch) {
        // This is already in the target format or close to it
        // We can just parse it to be sure
        const d = new Date(baseDateStr);
        if (!isNaN(d.getTime())) {
          return format(d, 'dd-MMM-yyyy');
        }
      }

      // Fallback to date-fns format if it's a valid date string
      const date = new Date(baseDateStr);
      if (!isNaN(date.getTime())) {
        // If the string was just a date like "2026-03-04", some browsers parse as UTC.
        // We want to treat it as local to avoid the "previous day" bug.
        // One way is to check if it's midnight UTC and shift it if needed, 
        // but it's safer to just use getFullYear/Month/Date.
        const y = date.getFullYear();
        const m = date.getMonth();
        const d = date.getDate();
        
        // If it's an ISO date string and we are here, it might have been parsed as UTC.
        if (/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
          const parts = baseDateStr.split('-');
          const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          return format(localDate, 'dd-MMM-yyyy');
        }

        return format(date, 'dd-MMM-yyyy');
      }
    } catch (e) {
      console.error("Error normalizing date:", dateStr, e);
    }
    return String(dateStr);
  },

  async fetchConfig(): Promise<{ users: User[]; seats: Seat[] }> {
    // Try to fetch from Google Sheets first
    const sheetUsers = await googleSheetService.fetchSheetData(CONFIG.SHEETS.USERS);
    
    let users: User[] = [];
    
    if (sheetUsers.length > 0) {
      users = sheetUsers.map(u => ({
        userId: this.getValue(u, 'userId') || '',
        name: this.getValue(u, 'name') || '',
        team: this.getValue(u, 'team') || '',
        project: this.getValue(u, 'project') || '',
        group: this.getValue(u, 'group') || '',
        active: String(this.getValue(u, 'active')).toLowerCase() === 'true' || this.getValue(u, 'active') === true,
        assignedSeat: this.getValue(u, 'assignedSeat') || '',
        role: this.getValue(u, 'role') || 'user',
        password: this.getValue(u, 'password') || 'password123',
        phone: this.getValue(u, 'phone') || '',
        email: this.getValue(u, 'email') || '',
        address: this.getValue(u, 'address') || ''
      }));
      // Update cache
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } else {
      // Fallback to cache if sheet is empty or fetch fails
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      if (data) users = JSON.parse(data);
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

  async updateUserWithCascade(oldUserId: string, updatedUser: User) {
    // 1. Update User in Users sheet
    await googleSheetService.saveData(CONFIG.SHEETS.USERS, [updatedUser], 'updatebykey', 'userId');

    // 2. If UserID or AssignedSeat changed, cascade to other sheets
    const userIdChanged = oldUserId !== updatedUser.userId;
    
    // We need the old user to know the old assigned seat
    const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    const users: User[] = savedUsers ? JSON.parse(savedUsers) : [];
    const oldUser = users.find(u => u.userId === oldUserId || u.userId === updatedUser.userId);
    const seatChanged = oldUser && oldUser.assignedSeat !== updatedUser.assignedSeat;

    if (userIdChanged || seatChanged) {
      console.log(`Cascading updates for ${oldUserId}...`);
      
      // Fetch all data that might need updating
      const [attendance, logs] = await Promise.all([
        this.getAttendance(),
        this.getLogs()
      ]);

      let attendanceUpdated = false;
      const updatedAttendance = attendance.map(record => {
        let changed = false;
        let newRecord = { ...record };
        
        if (userIdChanged && record.userId === oldUserId) {
          newRecord.userId = updatedUser.userId;
          changed = true;
        }
        
        // If seat changed, update records that were using the old assigned seat
        if (seatChanged && record.userId === (userIdChanged ? updatedUser.userId : oldUserId) && record.seatCode === oldUser.assignedSeat) {
          newRecord.seatCode = updatedUser.assignedSeat;
          changed = true;
        }

        if (changed) attendanceUpdated = true;
        return newRecord;
      });

      if (attendanceUpdated) {
        await this.saveAttendance(updatedAttendance);
      }

      // Update Notices
      let noticesUpdated = false;
      const notices = await this.getNotices();
      const updatedNotices = notices.map(notice => {
        if (userIdChanged && notice.posterId === oldUserId) {
          noticesUpdated = true;
          return { ...notice, posterId: updatedUser.userId };
        }
        return notice;
      });

      if (noticesUpdated) {
        localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(updatedNotices));
        await googleSheetService.saveData(CONFIG.SHEETS.NOTICE, updatedNotices);
      }

      // Update Logs
      let logsUpdated = false;
      const updatedLogs = logs.map(log => {
        let logStr = JSON.stringify(log);
        if (userIdChanged) {
          // Replace oldUserId with updatedUser.userId in the whole log object (including JSON fields)
          const regex = new RegExp(`"${oldUserId}"`, 'g');
          if (logStr.includes(`"${oldUserId}"`)) {
            logStr = logStr.replace(regex, `"${updatedUser.userId}"`);
            logsUpdated = true;
          }
        }
        return logsUpdated ? JSON.parse(logStr) : log;
      });

      if (logsUpdated) {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
        await googleSheetService.saveData(CONFIG.SHEETS.HISTORY, updatedLogs.map(l => ({
          id: l.id,
          time: l.time,
          actor: l.actor,
          action: l.action,
          target: l.target,
          before_json: JSON.stringify(l.before),
          after_json: JSON.stringify(l.after)
        })), 'update');
      }
    }
    
    // Update local storage
    const newUsers = users.map(u => (u.userId === oldUserId || u.userId === updatedUser.userId) ? updatedUser : u);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(newUsers));
  },

  async saveUsersWithCascade(oldUsers: User[], newUsers: User[]) {
    // Find users that changed UserID or AssignedSeat
    for (const newUser of newUsers) {
      const oldUser = oldUsers.find(u => u.userId === newUser.userId) || 
                      oldUsers.find(u => u.name === newUser.name && u.team === newUser.team);
      
      if (oldUser) {
        if (oldUser.userId !== newUser.userId || oldUser.assignedSeat !== newUser.assignedSeat) {
          await this.updateUserWithCascade(oldUser.userId, newUser);
        }
      }
    }
    
    // Finally save the whole users list
    await this.saveUsers(newUsers);
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
    let records: AttendanceRecord[] = [];
    if (sheetAttendance.length > 0) {
      records = sheetAttendance.map(r => ({
        date: this.normalizeDate(this.getValue(r, 'date')),
        userId: this.getValue(r, 'userId'),
        mode: (this.getValue(r, 'mode') || 'WFO') as any,
        seatCode: this.getValue(r, 'seatCode'),
        note: this.getValue(r, 'note'),
        updatedAt: this.getValue(r, 'updatedAt') || new Date().toISOString(),
        updatedBy: this.getValue(r, 'updatedBy') || 'System'
      }));
      // Update cache
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    } else {
      const data = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      records = data ? JSON.parse(data) : [];
    }

    // Deduplicate by userId and date, keeping the latest updatedAt
    const uniqueRecords: Record<string, AttendanceRecord> = {};
    records.forEach(r => {
      if (!r.userId || !r.date) return;
      const key = `${r.userId}_${r.date}`;
      if (!uniqueRecords[key] || new Date(r.updatedAt) > new Date(uniqueRecords[key].updatedAt)) {
        uniqueRecords[key] = r;
      }
    });
    return Object.values(uniqueRecords);
  },

  async saveAttendance(records: AttendanceRecord[]) {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    await googleSheetService.saveData(CONFIG.SHEETS.ATTENDANCE, records);
  },

  async getLogs(): Promise<AuditLog[]> {
    const sheetLogs = await googleSheetService.fetchSheetData(CONFIG.SHEETS.HISTORY);
    if (sheetLogs.length > 0) {
      const logs = sheetLogs.map(l => ({
        id: l.id || l.ID || '',
        time: l.time || l.Time || '',
        actor: l.actor || l.Actor || '',
        action: (l.action || l.Action || 'CHANGE_MODE') as any,
        target: l.target || l.Target || '',
        before: (l.before_json || l.Before_json) ? JSON.parse(l.before_json || l.Before_json) : null,
        after: (l.after_json || l.After_json) ? JSON.parse(l.after_json || l.After_json) : null
      }));
      // Update cache
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
      return logs;
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

  async deleteLog(logId: string) {
    const logs = await this.getLogs();
    const updatedLogs = logs.filter(l => l.id !== logId);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));
    
    const sheetData = updatedLogs.map(l => ({
      id: l.id,
      time: l.time,
      actor: l.actor,
      action: l.action,
      target: l.target,
      before_json: JSON.stringify(l.before),
      after_json: JSON.stringify(l.after)
    }));
    await googleSheetService.saveData(CONFIG.SHEETS.HISTORY, sheetData, 'update');
    return updatedLogs;
  },

  async clearLogs() {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify([]));
    await googleSheetService.saveData(CONFIG.SHEETS.HISTORY, [], 'update');
    return [];
  },

  async getGuide(): Promise<string> {
    const sheetGuide = await googleSheetService.fetchSheetData(CONFIG.SHEETS.GUIDE);
    if (sheetGuide.length > 0) {
      const content = sheetGuide[0].content || sheetGuide[0].Content || '';
      localStorage.setItem(STORAGE_KEY_GUIDE, content);
      return content;
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
      // Update cache
      localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(notices));
    } else {
      const data = localStorage.getItem(STORAGE_KEY_NOTICES);
      notices = data ? JSON.parse(data) : [];
    }
    return notices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getCachedData() {
    return {
      users: JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]'),
      attendance: JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE) || '[]'),
      logs: JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]'),
      guide: localStorage.getItem(STORAGE_KEY_GUIDE) || '',
      notices: JSON.parse(localStorage.getItem(STORAGE_KEY_NOTICES) || '[]'),
      seats: MOCK_SEATS
    };
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

  async updateNotice(id: string, updates: Partial<Notice>) {
    const data = localStorage.getItem(STORAGE_KEY_NOTICES);
    const notices: Notice[] = data ? JSON.parse(data) : [];
    const updatedNotices = notices.map(n => n.id === id ? { ...n, ...updates } : n);
    localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(updatedNotices));
    await googleSheetService.saveData(CONFIG.SHEETS.NOTICE, updatedNotices);
    return updatedNotices;
  },

  async deleteNotice(id: string) {
    const data = localStorage.getItem(STORAGE_KEY_NOTICES);
    const notices = data ? JSON.parse(data) : [];
    const updatedNotices = notices.filter((n: Notice) => n.id !== id);
    localStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(updatedNotices));
    await googleSheetService.saveData(CONFIG.SHEETS.NOTICE, updatedNotices);
  }
};
