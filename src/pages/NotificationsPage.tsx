import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Info,
  Check,
  Bell,
  X,
  Receipt,
  Download,
  FileText,
  User,
  Trash2
} from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { NotificationItem, NotificationCategory, NotificationType } from '../types.js';
import { resolveNotificationCategory } from '../components/NotificationPopup.js';

const CATEGORIES: NotificationCategory[] = ['General', 'Expenses', 'Reports', 'Friends'];

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('General');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<NotificationItem[]>('/api/notifications');
      setNotifications(res || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getCategoryCount = (cat: NotificationCategory) => {
    return notifications.filter((n) => resolveNotificationCategory(n) === cat).length;
  };

  const filteredNotifications = notifications.filter((n) => {
    const cat = resolveNotificationCategory(n);
    return cat === activeCategory;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'BUDGET_WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'EXPENSE_ADDED':
      case 'EXPENSE_DELETED':
      case 'EXPENSE_SETTLED':
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case 'IMPORT_READY':
        return <Download className="w-4 h-4 text-blue-600" />;
      case 'REPORT_READY':
        return <FileText className="w-4 h-4 text-purple-600" />;
      case 'FRIEND_ADDED':
      case 'FRIEND_DELETED':
      case 'FRIEND_ACTIVITY':
        return <User className="w-4 h-4 text-teal-600" />;
      case 'SYSTEM':
      default:
        return <Bell className="w-4 h-4 text-green-700" />;
    }
  };

  const getCategoryPillBadge = (type: NotificationType) => {
    const cat = resolveNotificationCategory({ type } as NotificationItem);
    switch (cat) {
      case 'Expenses':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'Reports':
        return 'bg-purple-50 text-purple-700 border-purple-200/60';
      case 'Friends':
        return 'bg-teal-50 text-teal-700 border-teal-200/60';
      case 'General':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Notifications & Activity Feed
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Categorized audit logs of expenses, friends, reports, and system alerts.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="btn-secondary self-start sm:self-auto text-xs"
          >
            <Check className="w-3.5 h-3.5 text-green-700" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 border-b border-[#edf2ee] pb-3 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((category) => {
          const count = getCategoryCount(category);
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-green-800 text-white font-semibold shadow-none'
                  : 'text-gray-600 hover:text-gray-900 bg-white border border-[#edf2ee] hover:bg-gray-50'
              }`}
            >
              <span>{category}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="card-base p-12 text-center text-gray-400">
            <div className="w-5 h-5 border-2 border-green-700/40 border-t-green-700 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="card-base p-12 text-center text-gray-400 space-y-2 rounded-[24px]">
            <Bell className="w-8 h-8 mx-auto text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-800">No {activeCategory.toLowerCase()} notifications</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Activity related to {activeCategory.toLowerCase()} will be logged here automatically.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const cat = resolveNotificationCategory(n);
            return (
              <div
                key={n.id}
                className={`p-4 card-base flex items-start justify-between gap-3 rounded-[20px] transition-all ${
                  n.read ? 'opacity-70' : 'border-green-300/80 bg-green-50/15'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${getCategoryPillBadge(
                      n.type
                    )}`}
                  >
                    {getNotificationIcon(n.type)}
                  </div>
                  <div>
                    <p className="text-xs sm:text-[13px] font-medium text-gray-900 leading-snug">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-mono-num text-gray-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.2 rounded-full border ${getCategoryPillBadge(
                          n.type
                        )}`}
                      >
                        {cat}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(n.id)}
                      className="btn-secondary h-7 px-2 text-xs"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3 text-green-600" />
                      <span>Mark Read</span>
                    </button>
                  )}
                  {/* Cross button to dismiss/delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteNotification(n.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
