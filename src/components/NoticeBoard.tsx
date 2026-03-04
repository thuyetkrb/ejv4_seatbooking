import React, { useState } from 'react';
import { Notice, User } from '../types';
import { Bell, Plus, Trash2, User as UserIcon, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NoticeBoardProps {
  notices: Notice[];
  currentUser: User | null;
  onAddNotice: (title: string, content: string) => void;
  onDeleteNotice: (id: string) => void;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ 
  notices, 
  currentUser, 
  onAddNotice, 
  onDeleteNotice 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', content: '' });
  
  // Only users with roles containing "PjM" or "PgM" can post notices, or the admin
  const canPostNotice = (currentUser?.role && (
    currentUser.role.includes('PjM') || 
    currentUser.role.includes('PgM')
  )) || currentUser?.name === 'Nguyen Huu Thuyet';
  
  const isAdmin = currentUser?.name === 'Nguyen Huu Thuyet' || (currentUser?.role && currentUser.role.includes('PjM'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNotice.title.trim() && newNotice.content.trim()) {
      onAddNotice(newNotice.title, newNotice.content);
      setNewNotice({ title: '', content: '' });
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-black/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Bell className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Notice Board</h2>
            <p className="text-xs text-slate-500">Latest updates and announcements</p>
          </div>
        </div>
        {canPostNotice && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Post Notice
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-xl shadow-md border border-indigo-100"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter notice title..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Content</label>
                <textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[120px]"
                  placeholder="Enter notice content..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
                >
                  Post Now
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {notices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No notices yet.</p>
          </div>
        ) : (
          notices.map((notice) => (
            <motion.div
              key={notice.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-xl shadow-sm border border-black/5 hover:shadow-md transition-shadow relative group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">{notice.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5" />
                      {notice.poster}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(notice.date).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => onDeleteNotice(notice.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{notice.content}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
