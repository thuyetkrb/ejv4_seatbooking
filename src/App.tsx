import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, 
  Calendar as CalendarIcon, User as UserIcon, Users as UsersIcon,
  MapPin, Info, History, BookOpen, LogOut, Save, X, Settings, Sliders,
  Lock, AlertCircle, CheckCircle, RefreshCw, Download, Bell
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  getDaysInMonth, formatDate, formatDisplayDate, getCW, formatTime, formatMonthYear, isWeekend
} from './utils/dateHelpers';
import { 
  User, Seat, AttendanceRecord, AuditLog, WorkingMode, Notice
} from './types';
import { 
  dataService 
} from './services/dataService';
import { 
  TEAM_COLORS, WORKING_MODE_LABELS, ZONES 
} from './constants';
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, parseISO, format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { NoticeBoard } from './components/NoticeBoard';
import { CONFIG } from './config';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'layout' | 'notice' | 'userinfo' | 'guide' | 'config'>('timeline');
  const [users, setUsers] = useState<User[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginData, setLoginData] = useState({ userId: '', password: '' });
  const [showLogin, setShowLogin] = useState(false);
  const [guideContent, setGuideContent] = useState<string>('');

  const isAdmin = currentUser?.role === 'admin';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const config = await dataService.fetchConfig();
      setUsers(config.users);
      setSeats(config.seats);
      
      const [att, lgs, gd, nts] = await Promise.all([
        dataService.getAttendance(),
        dataService.getLogs(),
        dataService.getGuide(),
        dataService.getNotices()
      ]);

      setAttendance(att);
      setLogs(lgs);
      setGuideContent(gd);
      setNotices(nts);

      // Requirement: If Google Sheets was empty (no users found), save mock data to it
      // We check if users came from MOCK_USERS (which happens in dataService.fetchConfig if sheet is empty)
      // Actually, let's check if the sheet was empty by looking at the fetch result.
      // For simplicity, if we have users but no attendance/notices in sheets, we might want to sync.
      // But specifically: "Trường hợp google chưa có data, thì ở lần đầu tiên mở web, lưu tất cả dữ liệu mẫu hiện tại vào database."
      if (config.users.length > 0 && att.length === 0 && nts.length === 0) {
        console.log("Initial sync: Saving mock data to Google Sheets...");
        await dataService.saveAllData({
          users: config.users,
          attendance: att,
          logs: lgs,
          guide: gd,
          notices: nts
        });
      }
      
      const savedUser = localStorage.getItem('currentUser');
      const savedPass = localStorage.getItem('currentPass');
      if (savedUser && savedPass) {
        try {
          const parsed = JSON.parse(savedUser);
          const found = config.users.find((u: User) => u.userId === parsed.userId);
          if (found) {
            setCurrentUser(found);
            setLoginData({ userId: found.userId, password: savedPass });
          }
        } catch (e) {
          console.error("Failed to parse saved user", e);
        }
      }
      
      setLoading(false);
    };
    init();
  }, []);

  const handleRefreshData = async () => {
    setLoading(true);
    const config = await dataService.fetchConfig();
    setUsers(config.users);
    setSeats(config.seats);
    const [att, lgs, gd, nts] = await Promise.all([
      dataService.getAttendance(),
      dataService.getLogs(),
      dataService.getGuide(),
      dataService.getNotices()
    ]);
    setAttendance(att);
    setLogs(lgs);
    setGuideContent(gd);
    setNotices(nts);
    setLoading(false);
    alert('Data refreshed from Google Sheets successfully!');
  };

  const handleSaveAllToSheets = async () => {
    setLoading(true);
    const success = await dataService.saveAllData({
      users,
      attendance,
      logs,
      guide: guideContent,
      notices
    });
    setLoading(false);
    if (success) {
      alert('All data saved to Google Sheets successfully!');
    } else {
      alert('Failed to save data. Please check your Google Script URL and permissions.');
    }
  };

  const handleExportData = () => {
    const exportData = {
      users,
      attendance,
      logs,
      guide: guideContent,
      notices,
      exportDate: new Date().toISOString(),
      author: CONFIG.AUTHOR
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ejv4_database_export_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogin = () => {
    const user = users.find(u => u.userId === loginData.userId);
    if (user && user.password === loginData.password) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('currentPass', loginData.password);
      setShowLogin(false);
    } else {
      alert('Invalid User or Password');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentPass');
    setLoginData({ userId: '', password: '' });
  };

  const handleSaveAttendance = async (userId: string, date: Date, mode: WorkingMode, seatCode?: string, note?: string) => {
    const dateStr = formatDate(date);
    const existingIndex = attendance.findIndex(r => r.userId === userId && r.date === dateStr);
    
    const before = existingIndex > -1 ? attendance[existingIndex] : null;
    const newRecord: AttendanceRecord = {
      userId,
      date: dateStr,
      mode,
      seatCode,
      note,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Unknown User',
    };

    let newAttendance = [...attendance];
    if (existingIndex > -1) {
      newAttendance[existingIndex] = newRecord;
    } else {
      newAttendance.push(newRecord);
    }

    setAttendance(newAttendance);
    dataService.saveAttendance(newAttendance);
    
    dataService.addLog({
      actor: currentUser?.name || 'Unknown User',
      action: 'CHANGE_MODE',
      target: `${userId} on ${dateStr}`,
      before,
      after: newRecord
    });
    const updatedLogs = await dataService.getLogs();
    setLogs(updatedLogs);
  };

  const handleSaveNotice = async (title: string, content: string) => {
    if (!currentUser) return;
    dataService.saveNotice({
      title,
      content,
      poster: currentUser.name,
      posterId: currentUser.userId
    });
    const updatedNotices = await dataService.getNotices();
    setNotices(updatedNotices);
  };

  const handleDeleteNotice = async (id: string) => {
    dataService.deleteNotice(id);
    const updatedNotices = await dataService.getNotices();
    setNotices(updatedNotices);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const newUsers = users.map(u => u.userId === updatedUser.userId ? updatedUser : u);
    setUsers(newUsers);
    await dataService.saveUsers(newUsers);
    if (currentUser?.userId === updatedUser.userId) {
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  const handleChangePassword = async (newPassword: string) => {
    if (!currentUser) return;
    const success = await dataService.changePassword(currentUser.userId, newPassword);
    if (success) {
      const updatedUser = { ...currentUser, password: newPassword };
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      localStorage.setItem('currentPass', newPassword);
      
      // Refresh users list to reflect change in memory
      const config = await dataService.fetchConfig();
      setUsers(config.users);
      return true;
    }
    return false;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#f5f5f5]">
      <div className="animate-pulse text-slate-500 font-medium">Loading data...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-slate-50/95 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 shadow-sm border-t-2 border-t-emerald-500">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
              <span className="text-sm sm:text-lg font-black relative z-10">EJV4</span>
            </div>
            <div className="block">
              <h1 className="font-bold text-sm sm:text-lg tracking-tight text-slate-900 leading-tight">Attendance Booking</h1>
              <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-slate-600 font-bold">Dashboard v1.0</p>
            </div>
          </div>

          <nav className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-xl">
            <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon={<CalendarIcon size={16} />} label="Timeline" />
            <TabButton active={activeTab === 'layout'} onClick={() => setActiveTab('layout')} icon={<MapPin size={16} />} label="Seat Map" />
            <TabButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon={<BookOpen size={16} />} label="Guide & Logs" />
            <TabButton active={activeTab === 'notice'} onClick={() => setActiveTab('notice')} icon={<Bell size={16} />} label="Notice" />
            <TabButton active={activeTab === 'userinfo'} onClick={() => setActiveTab('userinfo')} icon={<UserIcon size={16} />} label="User Info" />
            {isAdmin && (
              <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={16} />} label="Config" />
            )}
          </nav>

          {/* Mobile Nav Toggle */}
          <div className="md:hidden flex items-center bg-slate-100 p-1 rounded-lg">
            <select 
              className="bg-transparent border-none text-xs font-bold focus:ring-0 py-1 pl-2 pr-8"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
            >
              <option value="timeline">Timeline</option>
              <option value="layout">Seat Map</option>
              <option value="guide">Guide & Logs</option>
              <option value="notice">Notice</option>
              <option value="userinfo">User Info</option>
              {isAdmin && <option value="config">Config</option>}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {currentUser ? (
              <>
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold">{currentUser.name}</p>
                  <p className="text-xs text-slate-600">{currentUser.userId}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setShowLogin(!showLogin)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <UserIcon size={14} />
                  Login
                </button>
                
                {showLogin && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in duration-200">
                    <h4 className="font-bold text-slate-800 mb-3">User Login</h4>
                    <div className="space-y-3">
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={loginData.userId}
                        onChange={(e) => setLoginData(prev => ({ ...prev, userId: e.target.value }))}
                      >
                        <option value="">Select User...</option>
                        {users.map(u => <option key={u.userId} value={u.userId}>{u.name} ({u.userId})</option>)}
                      </select>
                      <input 
                        type="password" 
                        placeholder="Enter Password..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      />
                      <button 
                        onClick={handleLogin}
                        className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"
                      >
                        Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {activeTab === 'timeline' && (
          <TimelineTab 
            users={users} 
            attendance={attendance} 
            currentMonthDate={currentMonthDate}
            setCurrentMonthDate={setCurrentMonthDate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
            onSave={handleSaveAttendance}
            seats={seats}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'layout' && (
          <LayoutTab 
            seats={seats} 
            attendance={attendance} 
            users={users}
          />
        )}

        {activeTab === 'notice' && (
          <NoticeBoard 
            notices={notices}
            currentUser={currentUser}
            onAddNotice={handleSaveNotice}
            onDeleteNotice={handleDeleteNotice}
          />
        )}

        {activeTab === 'config' && isAdmin && (
          <ConfigurationTab 
            users={users} 
            onUpdateUsers={async (updatedUsers) => {
              setUsers(updatedUsers);
              await dataService.saveUsers(updatedUsers);
            }} 
          />
        )}

        {activeTab === 'userinfo' && (
          <UserInformationTab 
            users={users} 
            currentUser={currentUser} 
            onUpdateUser={handleUpdateUser}
            onChangePassword={handleChangePassword}
          />
        )}

        {activeTab === 'guide' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <UserGuide 
                isAdmin={currentUser?.role === 'admin'} 
                content={guideContent}
                onUpdate={(newContent: string) => {
                  setGuideContent(newContent);
                  dataService.saveGuide(newContent);
                }}
              />
            </div>
            <div className="lg:col-span-2">
              <AuditLogView logs={logs} />
            </div>
          </div>
        )}
      </main>

      {/* Footer Bar */}
      <footer className="bg-slate-50/95 backdrop-blur-md border-t border-slate-200/60 py-8 mt-12 shadow-inner">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Date</p>
                  <p className="text-sm font-bold text-slate-700">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Author</p>
                  <p className="text-sm font-bold text-slate-700">{CONFIG.AUTHOR}</p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap justify-center gap-3">
                <button 
                  onClick={handleRefreshData}
                  className="flex items-center gap-2 bg-white text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refresh Data
                </button>
                <button 
                  onClick={handleSaveAllToSheets}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Save size={14} />
                  Save to Database
                </button>
                <button 
                  onClick={handleExportData}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Download size={14} />
                  Export TXT
                </button>
              </div>
            )}

            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Author</p>
              <p className="text-sm font-bold text-slate-900">{CONFIG.AUTHOR}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
        active ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TimelineTab({ users, attendance, currentMonthDate, setCurrentMonthDate, searchQuery, setSearchQuery, teamFilter, setTeamFilter, onSave, seats, currentUser }: any) {
  const days = useMemo(() => getDaysInMonth(currentMonthDate), [currentMonthDate]);
  
  const filteredUsers = useMemo(() => {
    return users.filter((u: User) => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.userId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = teamFilter === 'All' || u.team === teamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [users, searchQuery, teamFilter]);

  const teams = ['All', ...Array.from(new Set(users.map((u: User) => u.team)))];

  return (
    <div className="space-y-4">
      {/* Header with Month and Legend */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18} /></button>
            <div className="px-4 text-sm font-bold text-slate-700 min-w-[140px] text-center">{formatMonthYear(currentMonthDate)}</div>
            <button onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronRight size={18} /></button>
          </div>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200" />
          
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {Object.entries(TEAM_COLORS).filter(([k]) => k !== 'Default' && k !== 'Admin').map(([team, color]) => (
              <div key={team} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] font-bold text-slate-600 uppercase">{team}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-1 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 w-12 sm:w-14 border-r border-slate-200">ID</th>
                <th className="p-1 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky left-[48px] sm:left-[56px] bg-slate-50 z-10 w-32 sm:w-48 border-r border-slate-200">Employee</th>
                <th className="p-1 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky left-[176px] sm:left-[248px] bg-slate-50 z-10 w-16 sm:w-20 border-r border-slate-200">Project</th>
                <th className="p-1 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky left-[240px] sm:left-[328px] bg-slate-50 z-10 w-14 sm:w-16 border-r border-slate-200">Seat</th>
                <th className="p-1 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky left-[296px] sm:left-[392px] bg-slate-50 z-10 w-20 sm:w-24 border-r border-slate-200">Status</th>
                {days.map(day => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th key={day.toString()} className={cn(
                      "p-0.5 text-center w-11 border-r border-slate-100",
                      isWeekend(day) ? "bg-slate-200" : "",
                      isToday ? "bg-emerald-100 ring-1 ring-inset ring-emerald-200" : ""
                    )}>
                      <p className="text-[8px] uppercase font-bold text-slate-600 leading-none">{format(day, 'EE', { locale: enUS }).charAt(0)}</p>
                      <p className={cn("text-[12px] font-bold leading-tight", isToday ? "text-emerald-700" : "text-slate-900")}>{format(day, 'd')}</p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: User) => {
                // Calculate planning status for the next 14 days
                const today = new Date();
                const next14Days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
                const workingDays = next14Days.filter(d => !isWeekend(d));
                const plannedDaysCount = workingDays.filter(d => {
                  const dateStr = formatDate(d);
                  return attendance.some(r => r.userId === user.userId && r.date === dateStr);
                }).length;

                let statusLabel = 'Plan OK';
                let statusClass = 'text-emerald-600 bg-emerald-50';
                if (plannedDaysCount === 0) {
                  statusLabel = 'Warning';
                  statusClass = 'text-rose-600 bg-rose-50 animate-pulse font-black shadow-[0_0_10px_rgba(225,29,72,0.4)]';
                } else if (plannedDaysCount < workingDays.length) {
                  statusLabel = 'Need Plan';
                  statusClass = 'text-amber-600 bg-amber-50 animate-pulse font-bold shadow-[0_0_10px_rgba(217,119,6,0.2)]';
                }

                return (
                  <tr key={user.userId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-1 sticky left-0 bg-white z-10 border-r border-slate-200">
                      <p className="text-[11px] text-slate-600 font-bold truncate">{user.userId}</p>
                    </td>
                    <td className="p-1 sticky left-[48px] sm:left-[56px] bg-white z-10 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0" style={{ backgroundColor: TEAM_COLORS[user.team] || TEAM_COLORS.Default }}>
                          {user.project.charAt(0)}
                        </div>
                        <p className="text-[12px] font-bold text-slate-900 truncate leading-tight">{user.name}</p>
                      </div>
                    </td>
                    <td className="p-1 sticky left-[176px] sm:left-[248px] bg-white z-10 border-r border-slate-200">
                      <p className="text-[11px] text-slate-700 font-bold uppercase truncate">{user.project}</p>
                    </td>
                    <td className="p-1 sticky left-[240px] sm:left-[328px] bg-white z-10 border-r border-slate-200">
                      <p className="text-[11px] font-black truncate" style={{ color: TEAM_COLORS[user.team] || TEAM_COLORS.Default }}>
                        {user.assignedSeat || '-'}
                      </p>
                    </td>
                    <td className="p-1 sticky left-[296px] sm:left-[392px] bg-white z-10 border-r border-slate-200">
                      <div className="flex items-center gap-1">
                        <div className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full text-center truncate flex-1", statusClass)}>
                          {statusLabel}
                        </div>
                      </div>
                    </td>
                    {days.map(day => (
                      <SeatCell 
                        key={day.toString()} 
                        user={user} 
                        day={day} 
                        attendance={attendance} 
                        seats={seats} 
                        allUsers={users}
                        onSave={onSave} 
                        currentUser={currentUser}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              {/* WFH Summary */}
              <tr>
                <td colSpan={5} className="p-1 text-[11px] font-bold text-blue-600 text-right pr-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Total WFH</td>
                {days.map(day => {
                  const count = attendance.filter((r: AttendanceRecord) => r.date === formatDate(day) && r.mode === 'WFH').length;
                  return (
                    <td key={day.toString()} className={cn("p-0.5 text-center text-[12px] font-black text-blue-600 border-r border-slate-100", isWeekend(day) ? "bg-slate-200" : "")}>
                      {count > 0 ? count : ''}
                    </td>
                  );
                })}
              </tr>
              {/* Occupied Summary */}
              <tr>
                <td colSpan={5} className="p-1 text-[11px] font-bold text-emerald-600 text-right pr-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Occupied Seats</td>
                {days.map(day => {
                  const count = attendance.filter((r: AttendanceRecord) => r.date === formatDate(day) && r.mode === 'WFO' && r.seatCode).length;
                  return (
                    <td key={day.toString()} className={cn("p-0.5 text-center text-[12px] font-black text-emerald-600 border-r border-slate-100", isWeekend(day) ? "bg-slate-200" : "")}>
                      {count > 0 ? count : ''}
                    </td>
                  );
                })}
              </tr>
              {/* Available Summary */}
              <tr>
                <td colSpan={5} className="p-1 text-[11px] font-bold text-slate-600 text-right pr-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Available Seats</td>
                {days.map(day => {
                  const occupiedCount = attendance.filter((r: AttendanceRecord) => r.date === formatDate(day) && r.mode === 'WFO' && r.seatCode).length;
                  const totalSeats = seats.filter((s: Seat) => !['EPS', 'ETA', 'X'].includes(s.zone)).length;
                  const count = totalSeats - occupiedCount;
                  return (
                    <td key={day.toString()} className={cn("p-0.5 text-center text-[12px] font-black text-slate-500 border-r border-slate-100", isWeekend(day) ? "bg-slate-200" : "")}>
                      {!isWeekend(day) ? count : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Today Layout Status (Grid Style) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Info size={18} className="text-emerald-500" />
            Today's Layout Status ({formatDisplayDate(new Date())})
          </h3>
          <div className="flex gap-4">
            {Object.entries(TEAM_COLORS).filter(([k]) => k !== 'Default' && k !== 'Admin').map(([team, color]) => (
              <div key={team} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{team}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
          <div className="grid grid-cols-11 gap-1 max-w-4xl mx-auto relative">
            {/* Kid Room Area */}
            <div className="col-span-6 row-span-7 bg-slate-200 rounded-lg flex items-center justify-center border-2 border-slate-300">
              <span className="text-lg font-bold text-slate-500">Kid room</span>
            </div>

            {seats.map((seat: Seat) => {
              const record = attendance.find((r: AttendanceRecord) => r.date === formatDate(new Date()) && r.seatCode === seat.seatCode);
              const user = record ? users.find((u: User) => u.userId === record.userId) : null;
              const isSpecial = ['EPS', 'ETA', 'X'].includes(seat.zone);
              
              // Determine default project for this seat
              const defaultUser = users.find((u: User) => u.assignedSeat === seat.seatCode);
              const defaultProject = defaultUser?.project || 'Default';
              const projectColor = TEAM_COLORS[defaultProject] || TEAM_COLORS.Default;

              return (
                <div 
                  key={seat.seatCode}
                  style={{ 
                    gridRowStart: seat.position.row + 1, 
                    gridColumnStart: seat.position.col + 1,
                    gridRowEnd: seat.position.row + 2,
                    gridColumnEnd: seat.position.col + 2,
                    backgroundColor: user ? projectColor : (isSpecial ? '#1e293b' : `${projectColor}33`)
                  }}
                  className={cn(
                    "aspect-square rounded border flex flex-col items-center justify-center p-0.5 transition-all relative",
                    user ? "border-slate-400 shadow-sm scale-105 z-10" : (isSpecial ? "border-slate-900" : "border-slate-200")
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 text-[13px] font-black uppercase",
                    user ? "text-white" : (isSpecial ? "text-slate-400" : "text-slate-500")
                  )}>
                    {seat.seatCode.includes('-') ? seat.zone : seat.seatCode}
                  </span>
                  
                  <div className="flex flex-col items-center justify-center w-full h-full pt-1.5 overflow-hidden">
                    {!isSpecial && (
                      <div className="flex flex-col items-center justify-center w-full">
                        {/* Default User (Small text) */}
                        {users.filter((u: User) => u.assignedSeat === seat.seatCode).slice(0, 1).map((u: User) => (
                          <p key={u.userId} className={cn(
                            "text-[11px] leading-none truncate w-full text-center mb-0.5",
                            user ? "text-white/70" : "text-slate-400 font-bold"
                          )}>
                            {u.name.split(' ').pop()}
                          </p>
                        ))}
                        
                        {/* Current Occupant (Bold text) */}
                        {user && (
                          <p className="text-[18px] font-black text-white text-center leading-tight truncate px-0.5">
                            {user.name.split(' ').pop()}
                          </p>
                        )}
                      </div>
                    )}
                    {isSpecial && user && (
                      <p className="text-[18px] font-black text-white text-center leading-tight truncate px-0.5">
                        {user.name.split(' ').pop()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatCell({ user, day, attendance, seats, allUsers, onSave, currentUser }: any) {
  const dateStr = formatDate(day);
  const record = attendance.find((r: AttendanceRecord) => r.userId === user.userId && r.date === dateStr);
  const isToday = isSameDay(day, new Date());
  const weekend = isWeekend(day);
  const isPastDay = !isToday && day < new Date(new Date().setHours(0, 0, 0, 0));
  const canEdit = !isPastDay || currentUser?.userId === 'GTH8HC';

  // Get occupied seats for this day (excluding current user)
  const occupiedSeats = useMemo(() => {
    return attendance
      .filter((r: AttendanceRecord) => r.date === dateStr && r.mode === 'WFO' && r.userId !== user.userId)
      .map((r: AttendanceRecord) => r.seatCode);
  }, [attendance, dateStr, user.userId]);

  // Group seats by priority
  const seatGroups = useMemo(() => {
    const available = seats.filter((s: Seat) => !occupiedSeats.includes(s.seatCode));
    const defaultSeat = available.find((s: Seat) => s.seatCode === user.assignedSeat);
    const normalSeats = available.filter((s: Seat) => !['EPS', 'ETA', 'X'].includes(s.zone) && s.seatCode !== user.assignedSeat);
    const sameProjectSeats = normalSeats.filter((s: Seat) => {
      const seatOwner = allUsers.find((u: User) => u.assignedSeat === s.seatCode);
      return seatOwner?.project === user.project;
    });
    const otherProjectSeats = normalSeats.filter((s: Seat) => !sameProjectSeats.includes(s));
    const specialSeats = available.filter((s: Seat) => ['EPS', 'ETA', 'X'].includes(s.zone));
    return { defaultSeat, sameProjectSeats, otherProjectSeats, specialSeats };
  }, [seats, occupiedSeats, user.assignedSeat, user.project, allUsers]);

  const handleSelectChange = (val: string) => {
    if (weekend || !canEdit || !currentUser) return; // Disable selection on weekends, past days or if not logged in
    if (val === 'WFH' || val === 'LEAVE' || val === 'FLEXID' || val === 'HOLIDAY') {
      onSave(user.userId, day, val, '', '');
    } else if (val === 'CLEAR') {
      onSave(user.userId, day, 'WFO', '', '');
    } else if (val !== '') {
      onSave(user.userId, day, 'WFO', val, '');
    }
  };

  const currentValue = record ? (record.mode !== 'WFO' ? record.mode : record.seatCode) : '';

  const getLabel = () => {
    if (!record) return !weekend && canEdit ? <Plus size={10} /> : '';
    if (record.mode === 'WFO') return record.seatCode;
    if (record.mode === 'WFH') return 'WFH';
    if (record.mode === 'LEAVE') return 'Leave';
    if (record.mode === 'FLEXID') return 'Flexi';
    if (record.mode === 'HOLIDAY') return 'Holiday';
    return record.mode;
  };

  return (
    <td className={cn(
      "p-0.5 text-center border-r border-slate-50 relative group",
      weekend ? "bg-slate-200" : "",
      isToday ? "bg-emerald-50/30 ring-1 ring-inset ring-emerald-100" : "",
      !canEdit && !weekend ? "bg-slate-50/50" : ""
    )}>
      <div className={cn(
        "w-full h-7 rounded flex items-center justify-center transition-all relative",
        record ? cn("shadow-sm", WORKING_MODE_LABELS[record.mode].bg) : "hover:bg-emerald-50/50",
        isToday && !record ? "border border-emerald-200" : "",
        (weekend || !canEdit) ? "opacity-50 cursor-not-allowed" : ""
      )}>
        {/* The label */}
        <span className={cn("text-[10px] font-black uppercase pointer-events-none", record ? WORKING_MODE_LABELS[record.mode].color : "text-slate-300 group-hover:text-emerald-300")}>
          {getLabel()}
        </span>

        {/* The hidden select that covers the cell */}
        {!weekend && canEdit && currentUser && (
          <select 
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={currentValue}
            onChange={(e) => handleSelectChange(e.target.value)}
          >
            <option value="">-- Select --</option>
            <optgroup label="Modes">
              <option value="WFH">🏠 Home</option>
              <option value="LEAVE">🏖️ Leave</option>
              <option value="FLEXID">⚡ FlexiD</option>
              <option value="HOLIDAY">🎉 Holiday</option>
            </optgroup>
            
            {seatGroups.defaultSeat && (
              <optgroup label="Priority">
                <option value={seatGroups.defaultSeat.seatCode}>⭐ Default: {seatGroups.defaultSeat.seatCode}</option>
              </optgroup>
            )}

            {seatGroups.sameProjectSeats.length > 0 && (
              <optgroup label="Team Seats">
                {seatGroups.sameProjectSeats.map(s => (
                  <option key={s.seatCode} value={s.seatCode}>🪑 {s.seatCode}</option>
                ))}
              </optgroup>
            )}

            {seatGroups.otherProjectSeats.length > 0 && (
              <optgroup label="Others">
                {seatGroups.otherProjectSeats.map(s => (
                  <option key={s.seatCode} value={s.seatCode}>🪑 {s.seatCode}</option>
                ))}
              </optgroup>
            )}

            <optgroup label="Actions">
              <option value="CLEAR">❌ Clear</option>
            </optgroup>
          </select>
        )}
      </div>
    </td>
  );
}

function LayoutTab({ seats, attendance, users }: any) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'all' | 'available'>('all');

  const dateStr = formatDate(selectedDate);
  const dayAttendance = attendance.filter((r: AttendanceRecord) => r.date === dateStr);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18} /></button>
            <span className="px-4 text-sm font-bold">{formatDisplayDate(selectedDate)}</span>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition-all"><ChevronRight size={18} /></button>
          </div>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200 mx-2" />
          
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button 
              onClick={() => setViewMode('all')}
              className={cn("flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all", viewMode === 'all' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500")}
            >
              All Seats
            </button>
            <button 
              onClick={() => setViewMode('available')}
              className={cn("flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all", viewMode === 'available' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500")}
            >
              Available Only
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(TEAM_COLORS).filter(([k]) => k !== 'Default' && k !== 'Admin').map(([team, color]) => (
            <div key={team} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-bold text-slate-500 uppercase">{team}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[400px] relative overflow-hidden">
        {/* Layout Container with Horizontal Scroll for Mobile */}
        <div className="overflow-x-auto custom-scrollbar pb-4">
          <div className="grid grid-cols-11 gap-1 min-w-[800px] max-w-5xl mx-auto relative">
          
          {/* Kid Room Area */}
          <div className="col-span-6 row-span-7 bg-slate-200 rounded-lg flex items-center justify-center border-2 border-slate-300">
            <span className="text-xl font-bold text-slate-500">Kid room</span>
          </div>

          {/* Render Seats */}
          {seats.map((seat: Seat) => {
            const record = dayAttendance.find((r: AttendanceRecord) => r.seatCode === seat.seatCode);
            const user = record ? users.find((u: User) => u.userId === record.userId) : null;
            
            if (viewMode === 'available' && user) return null;

            // Determine if it's a special seat (EPS, ETA, X)
            const isSpecial = ['EPS', 'ETA', 'X'].includes(seat.zone);
            
            // Determine default project for this seat
            const defaultUser = users.find((u: User) => u.assignedSeat === seat.seatCode);
            const defaultProject = defaultUser?.project || 'Default';
            const projectColor = TEAM_COLORS[defaultProject] || TEAM_COLORS.Default;

            return (
              <div 
                key={seat.seatCode}
                style={{ 
                  gridRowStart: seat.position.row + 1, 
                  gridColumnStart: seat.position.col + 1,
                  gridRowEnd: seat.position.row + 2,
                  gridColumnEnd: seat.position.col + 2,
                  backgroundColor: user ? projectColor : (isSpecial ? '#1e293b' : `${projectColor}33`)
                }}
                className={cn(
                  "aspect-square rounded border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer relative group",
                  user 
                    ? "border-slate-400 shadow-md scale-105 z-10" 
                    : isSpecial 
                      ? "border-slate-900"
                      : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 text-[11px] font-black uppercase",
                  user ? "text-white drop-shadow-sm" : isSpecial ? "text-slate-400" : "text-slate-500"
                )}>
                  {seat.seatCode.includes('-') ? seat.zone : seat.seatCode}
                </span>
                
                {/* Seat Content */}
                <div className="flex flex-col items-center justify-center w-full h-full pt-2 overflow-hidden">
                  {/* Default Users (1 or 2) */}
                  <div className="flex flex-col items-center mb-0.5">
                    {users.filter((u: User) => u.assignedSeat === seat.seatCode).slice(0, 2).map((u: User) => (
                      <p key={u.userId} className={cn(
                        "text-[13px] font-bold leading-none truncate w-full text-center",
                        user ? "text-white/80" : isSpecial ? "text-slate-500" : "text-slate-600"
                      )}>
                        {u.name.split(' ').pop()}
                      </p>
                    ))}
                  </div>
                  
                  {/* Current User (from attendance) */}
                  {user ? (
                    <div className="mt-auto pb-0.5 w-full">
                      <p className="text-[16px] font-black text-white text-center leading-tight truncate px-0.5 drop-shadow-sm">
                        {user.name.split(' ').pop()}
                      </p>
                    </div>
                  ) : !isSpecial && (
                    <div className="mt-auto pb-0.5 text-slate-300 group-hover:text-emerald-400"><Plus size={10} /></div>
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-slate-900 text-white p-2 rounded-lg text-[10px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-xl">
                  <p className="font-bold">Seat {seat.seatCode}</p>
                  {user ? (
                    <>
                      <p>Occupied by: {user.name}</p>
                      <p>Team: {user.team}</p>
                    </>
                  ) : (
                    <p>Status: {isSpecial ? seat.zone : 'Available'}</p>
                  )}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            );
          })}

          {/* Project Labels for Bottom Seats */}
          <div className="col-start-1 row-start-11 text-[8px] font-bold text-slate-400 text-center">Honda</div>
          <div className="col-start-2 row-start-11 text-[8px] font-bold text-slate-400 text-center">Nissan/Su</div>
          <div className="col-start-3 row-start-11 text-[8px] font-bold text-slate-400 text-center">FFV</div>
          <div className="col-start-4 row-start-11 text-[8px] font-bold text-slate-400 text-center">VCCU</div>

          {/* Legend Area (Bottom Right) */}
          <div className="col-start-8 col-span-3 row-start-11 row-span-4 bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 border-b border-slate-100 pb-1">Legend</p>
            {Object.entries(TEAM_COLORS).filter(([k]) => !['Admin', 'Default'].includes(k)).map(([team, color]) => (
              <div key={team} className="flex items-center justify-between px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '40' }}>
                <span className="text-[9px] font-bold text-slate-700">{team}</span>
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

function UserGuide({ isAdmin, content, onUpdate }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BookOpen size={22} className="text-emerald-500" />
          User Guide
        </h3>
        {isAdmin && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1.5"
          >
            {isEditing ? <><Save size={12} /> Save</> : <><Settings size={12} /> Edit</>}
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea 
          className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="Enter guide content here..."
        />
      ) : content ? (
        <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-bold text-slate-800 mb-2">General Rule</p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
              <li>Everyone must <strong>book a seat at least 1–2 weeks in advance</strong>.</li>
              <li>Teams may <strong>utilize available seats from other teams</strong> if needed.</li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800 mb-2">Booking Priority</p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold text-rose-600 uppercase">Priority 1 – Your own seat</p>
                <p className="text-xs text-slate-500">Always book <strong>your assigned seat first</strong>. Check Column G (Priority) for 1st priority.</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-rose-600 uppercase">Priority 2 – Same project team</p>
                <p className="text-xs text-slate-500">If your seat is not available, check for <strong>free seats within your project team</strong>.</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-rose-600 uppercase">Priority 3 – Other project teams</p>
                <p className="text-xs text-slate-500">If no seats are available in your team: Check SeatLayout to identify the seat owner/team. <strong>Align with the seat owner first</strong> before booking.</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <p className="text-xs font-bold text-amber-700 flex items-center gap-2 mb-2">
              <Info size={14} />
              Important Notes
            </p>
            <ul className="text-[11px] text-amber-600 space-y-1 list-disc pl-4 font-medium">
              <li>Do not overwrite other people's bookings.</li>
              <li>Update the file promptly if your plan changes (WFH / Leave).</li>
              <li>Always check the file before coming to the office.</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">Contact for improvements:</p>
            <p className="text-[11px] font-bold text-slate-600">Nguyen Huu Thuyet (MS/EJV4-PS)</p>
          </div>
        </div>
      )}
    </div>
  );
}

function UserInformationTab({ users, currentUser, onUpdateUser, onChangePassword }: any) {
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState<User | null>(currentUser);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => {
    setEditedUser(currentUser);
  }, [currentUser]);

  const handleSave = () => {
    if (editedUser) {
      onUpdateUser(editedUser);
      setEditMode(false);
    }
  };

  const handlePasswordChange = async () => {
    setPassError('');
    setPassSuccess(false);

    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setPassError('Please fill in all fields.');
      return;
    }

    if (passwords.current !== currentUser.password) {
      setPassError('Current password is incorrect.');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      setPassError('New passwords do not match.');
      return;
    }

    if (passwords.new.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }

    const success = await onChangePassword(passwords.new);
    if (success) {
      setPassSuccess(true);
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setShowPasswordModal(false), 2000);
    } else {
      setPassError('Failed to update password. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* My Info */}
      {currentUser && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <UserIcon size={22} className="text-emerald-500" />
              My Information
            </h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowPasswordModal(true)} 
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
              >
                <Lock size={14} /> Change Password
              </button>
              {editMode ? (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setEditMode(false)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Cancel</button>
                  <button onClick={handleSave} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                    <Save size={14} /> Save
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditMode(true)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Edit My Info</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <InfoField label="User ID" value={currentUser.userId} readOnly />
            <InfoField label="Name" value={editedUser?.name || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, name: v} : null)} readOnly={!editMode} />
            <InfoField label="Role" value={editedUser?.role || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, role: v} : null)} readOnly={!editMode} />
            <InfoField label="Project" value={editedUser?.project || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, project: v} : null)} readOnly={!editMode} />
            <InfoField label="Phone" value={editedUser?.phone || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, phone: v} : null)} readOnly={!editMode} />
            <InfoField label="Email" value={editedUser?.email || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, email: v} : null)} readOnly={!editMode} />
            <InfoField label="Address" value={editedUser?.address || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, address: v} : null)} readOnly={!editMode} />
            <InfoField label="Other Info" value={editedUser?.otherInfo || ''} onChange={(v: string) => setEditedUser(prev => prev ? {...prev, otherInfo: v} : null)} readOnly={!editMode} className="lg:col-span-3" />
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Lock size={22} className="text-amber-500" />
                Change Password
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Current Password</label>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={passwords.current}
                  onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">New Password</label>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={passwords.new}
                  onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Confirm New Password</label>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                />
              </div>

              {passError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={14} /> {passError}
                </div>
              )}

              {passSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-medium flex items-center gap-2">
                  <CheckCircle size={14} /> Password updated successfully!
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePasswordChange}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Members */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Sliders size={22} className="text-emerald-500" />
          Member Directory
        </h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">User ID</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Project</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user: User) => (
                <tr key={user.userId} className="hover:bg-slate-50 transition-all">
                  <td className="p-3 text-[12px] font-bold text-slate-600">{user.userId}</td>
                  <td className="p-3 text-[12px] font-bold text-slate-900">{user.name}</td>
                  <td className="p-3 text-[12px] font-bold text-slate-500 uppercase">{user.role}</td>
                  <td className="p-3 text-[12px] font-bold text-slate-700 uppercase">{user.project}</td>
                  <td className="p-3 text-[12px] text-slate-600">{user.phone || '-'}</td>
                  <td className="p-3 text-[12px] text-slate-600">{user.email || '-'}</td>
                  <td className="p-3 text-[12px] text-slate-600 truncate max-w-[200px]">{user.address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, onChange, readOnly, className }: any) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">{label}</label>
      {readOnly ? (
        <div className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-700">
          {value || '-'}
        </div>
      ) : (
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      )}
    </div>
  );
}

function ConfigurationTab({ users, onUpdateUsers }: { users: User[], onUpdateUsers: (users: User[]) => void }) {
  const [editUsers, setEditUsers] = useState<User[]>(users);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({
    userId: '',
    name: '',
    project: '',
    assignedSeat: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const projects = useMemo(() => ['All', ...Array.from(new Set(users.map(u => u.project)))], [users]);
  const seatsList = useMemo(() => ['All', ...Array.from(new Set(users.map(u => u.assignedSeat || '-')))], [users]);

  const handleInputChange = (index: number, field: keyof User, value: string) => {
    setEditUsers(prev => {
      const next = [...prev];
      const updatedUser = { ...next[index], [field]: value };
      // Sync team with project if project is changed
      if (field === 'project') {
        updatedUser.team = value;
      }
      next[index] = updatedUser;
      return next;
    });
  };

  const handleSave = async () => {
    // Check for duplicate User IDs
    const userIds = editUsers.map(u => u.userId.trim().toLowerCase());
    const hasDuplicates = userIds.some((id, index) => userIds.indexOf(id) !== index);

    if (hasDuplicates) {
      alert('Duplicate User IDs found. Please ensure all User IDs are unique.');
      return;
    }

    setIsSaving(true);
    onUpdateUsers(editUsers.map(u => ({ ...u, userId: u.userId.trim() })));
    setTimeout(() => setIsSaving(false), 500);
  };

  const filteredUsers = editUsers.map((u, i) => ({ ...u, originalIndex: i })).filter(u => {
    return (
      u.userId.toLowerCase().includes(filters.userId.toLowerCase()) &&
      u.name.toLowerCase().includes(filters.name.toLowerCase()) &&
      (filters.project === 'All' || filters.project === '' || u.project === filters.project) &&
      (filters.assignedSeat === 'All' || filters.assignedSeat === '' || (u.assignedSeat || '-') === filters.assignedSeat)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Settings size={24} className="text-emerald-500" />
              User Configuration
            </h3>
            <p className="text-[10px] sm:text-[12px] text-slate-500 font-bold uppercase tracking-wider">Manage default seat assignments and project details</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn("flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all", showFilters ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              <Sliders size={16} />
              Filters
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">User ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search ID..." 
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={filters.userId}
                  onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search Name..." 
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={filters.name}
                  onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Project</label>
              <select 
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={filters.project}
                onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
              >
                {projects.map(p => <option key={p} value={p === 'All' ? '' : p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Seat</label>
              <select 
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={filters.assignedSeat}
                onChange={(e) => setFilters(prev => ({ ...prev, assignedSeat: e.target.value }))}
              >
                {seatsList.map(s => <option key={s} value={s === 'All' ? '' : s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 text-left w-24 text-[11px] font-bold text-slate-500 uppercase tracking-wider">User ID</th>
                <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="p-3 text-left w-24 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="p-3 text-left w-32 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Project</th>
                <th className="p-3 text-left w-24 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const projectColor = TEAM_COLORS[user.project] || TEAM_COLORS.Default;
                return (
                  <tr 
                    key={user.originalIndex} 
                    className="hover:bg-slate-50 transition-all"
                  >
                    <td className="p-3 border-r border-slate-50">
                      <input 
                        type="text" 
                        value={user.userId} 
                        onChange={(e) => handleInputChange(user.originalIndex, 'userId', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-[12px] font-bold p-0 text-center text-slate-600"
                      />
                    </td>
                    <td className="p-3 border-r border-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: projectColor }} />
                        <input 
                          type="text" 
                          value={user.name} 
                          onChange={(e) => handleInputChange(user.originalIndex, 'name', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-[12px] font-bold p-0 text-slate-900"
                        />
                      </div>
                    </td>
                    <td className="p-3 border-r border-slate-50">
                      <input 
                        type="text" 
                        value={user.project} 
                        onChange={(e) => handleInputChange(user.originalIndex, 'project', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-[12px] font-bold uppercase p-0 text-slate-700"
                      />
                    </td>
                    <td className="p-3 border-r border-slate-50">
                      <input 
                        type="text" 
                        value={user.role} 
                        onChange={(e) => handleInputChange(user.originalIndex, 'role', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-[12px] font-bold uppercase p-0 text-slate-500"
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="text" 
                        value={user.assignedSeat || ''} 
                        onChange={(e) => handleInputChange(user.originalIndex, 'assignedSeat', e.target.value)}
                        placeholder="-"
                        className="w-full bg-transparent border-none focus:ring-0 text-[12px] font-black uppercase p-0"
                        style={{ color: projectColor }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditLogView({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={22} className="text-emerald-500" />
          Update History
        </h3>
        <button className="text-xs font-bold text-emerald-600 hover:underline">Export CSV</button>
      </div>
      
      <div className="overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-20 text-slate-300 font-medium italic">No activities recorded yet.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <UserIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-slate-800 truncate">{log.actor}</p>
                    <span className="text-[10px] font-bold text-slate-400">{formatTime(parseISO(log.time))}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Performed <span className="font-bold text-emerald-600">{log.action}</span> for <span className="font-bold text-slate-700">{log.target}</span>
                  </p>
                  {log.after && (
                    <div className="mt-2 text-[10px] bg-white p-2 rounded-lg border border-slate-100 font-mono text-slate-400">
                      {JSON.stringify(log.after)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Plus({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
}
