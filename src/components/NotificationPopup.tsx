import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  X,
  Download,
  User,
  AlertTriangle,
  Receipt,
  FileText,
  Bell,
  Trash2
} from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { NotificationItem, NotificationCategory, NotificationType } from '../types.js';

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  unreadCount: number;
  onMarkAsRead: () => void;
}

const CATEGORIES: NotificationCategory[] = ['General', 'Expenses', 'Reports', 'Friends'];

export function resolveNotificationCategory(n: NotificationItem): NotificationCategory {
  if (n.category) return n.category;
  switch (n.type) {
    case 'BUDGET_WARNING':
    case 'EXPENSE_ADDED':
    case 'EXPENSE_DELETED':
    case 'EXPENSE_SETTLED':
      return 'Expenses';
    case 'REPORT_READY':
    case 'IMPORT_READY':
      return 'Reports';
    case 'FRIEND_ADDED':
    case 'FRIEND_DELETED':
    case 'FRIEND_ACTIVITY':
      return 'Friends';
    case 'SYSTEM':
    default:
      return 'General';
  }
}

export const NotificationPopup: React.FC<NotificationPopupProps> = ({
  isOpen,
  onClose,
  onRefresh,
  unreadCount,
  onMarkAsRead
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('General');
  const popupRef = useRef<HTMLDivElement>(null);

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
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Click outside and Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      onMarkAsRead();
      onRefresh();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onMarkAsRead();
      onRefresh();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDeleteNotification = async (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      onRefresh();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Filter notifications strictly by active category
  const filteredNotifications = notifications.filter((n) => {
    const cat = resolveNotificationCategory(n);
    return cat === activeCategory;
  });

  const getCategoryCount = (cat: NotificationCategory) => {
    return notifications.filter((n) => resolveNotificationCategory(n) === cat).length;
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'BUDGET_WARNING':
        return <AlertTriangle className="w-4 h-4 text-[#166534]" />;
      case 'EXPENSE_ADDED':
      case 'EXPENSE_DELETED':
      case 'EXPENSE_SETTLED':
        return <Receipt className="w-4 h-4 text-[#166534]" />;
      case 'IMPORT_READY':
        return <Download className="w-4 h-4 text-[#166534]" />;
      case 'REPORT_READY':
        return <FileText className="w-4 h-4 text-[#166534]" />;
      case 'FRIEND_ADDED':
      case 'FRIEND_DELETED':
      case 'FRIEND_ACTIVITY':
        return <User className="w-4 h-4 text-[#166534]" />;
      case 'SYSTEM':
      default:
        return <Bell className="w-4 h-4 text-[#166534]" />;
    }
  };

  const getCategoryPillBadge = (_type: NotificationType) => {
    return 'bg-[rgba(22,101,52,0.08)] text-[#166534] border-[rgba(22,101,52,0.14)]';
  };

  const getEmptyStateMessage = () => {
    switch (activeCategory) {
      case 'Expenses':
        return 'No expense alerts. Recorded expenses, deletions, and settlements will appear here.';
      case 'Reports':
        return 'No report alerts. Monthly financial audits and statement import logs will appear here.';
      case 'Friends':
        return 'No friend activities. Newly added friends, deletions, and split balances will appear here.';
      case 'General':
      default:
        return 'No general notifications. System notices and announcements will appear here.';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-6 overflow-hidden pointer-events-auto">
          {/* Outside outer container: Smooth little blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/25 backdrop-blur-[6px]"
          />

          {/* Extra container outside initial container with opacity 50 percent for shading */}
          <motion.div
            ref={popupRef}
            layout
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
              layout: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-[94vw] max-w-2xl sm:max-w-3xl p-2 rounded-[36px] bg-white/[0.325] border-none shadow-none pointer-events-auto"
          >
            {/* Initial container: White popup with smooth curve radius like search bar (rounded-[28px]) */}
            <motion.div
              layout
              transition={{
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="bg-white rounded-[28px] border border-[#edf2ee] flex flex-col overflow-hidden max-h-[82vh] sm:max-h-[500px] shadow-none"
            >
              {/* Header: Centered on screen, expansive width, compact height */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 sm:py-4 border-b border-[#edf2ee] bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-medium bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full border border-green-200/50">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-green-700 hover:text-green-800 font-medium px-3 py-1 rounded-full hover:bg-green-50 transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {/* Close cross button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Close notifications"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Categorized Filter Tabs: No outside container, clean underline like top navbar */}
              <div className="flex items-center gap-1 sm:gap-2 px-5 sm:px-7 pt-2.5 pb-2 border-b border-[#edf2ee] overflow-x-auto no-scrollbar shrink-0">
                {CATEGORIES.map((category) => {
                  const count = getCategoryCount(category);
                  const isActive = activeCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCategory(category);
                      }}
                      className={`relative px-3 sm:px-3.5 py-1 text-xs transition-colors duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer select-none ${
                        isActive ? 'text-green-800 font-bold' : 'text-gray-500 hover:text-gray-950 font-light'
                      }`}
                    >
                      <span className="relative z-10">{category}</span>
                      <span
                        className={`relative z-10 text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                          isActive ? 'bg-[rgba(22,101,52,0.12)] text-green-800 font-semibold' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="activeNotificationTabUnderline"
                          className="absolute bottom-[-8px] inset-x-2 h-[2px] bg-green-700 rounded-full"
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 32,
                            mass: 0.6,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Notifications List: Clean rows separated by lines with no outer boxed components */}
              <div className="overflow-y-auto divide-y divide-[#edf2ee] px-5 sm:px-7 py-1 flex-1 overscroll-contain">
                {loading ? (
                  <div className="flex items-center justify-center h-36 text-gray-400 text-xs">
                    <div className="w-4 h-4 border-2 border-green-700/40 border-t-green-700 rounded-full animate-spin mr-2" />
                    <span>Loading notifications...</span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-gray-400 space-y-2">
                    <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-gray-600">No {activeCategory.toLowerCase()} notifications</p>
                    <p className="text-[11px] text-gray-400 max-w-sm leading-relaxed">
                      {getEmptyStateMessage()}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const cat = resolveNotificationCategory(n);
                    return (
                      <div
                        key={n.id}
                        className={`group relative py-3.5 transition-colors ${
                          !n.read
                            ? 'bg-green-50/25 px-2 rounded-xl'
                            : 'hover:bg-gray-50/50 px-2 rounded-xl'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Icon */}
                          <div className="relative shrink-0">
                            <div
                              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border ${getCategoryPillBadge(
                                n.type
                              )}`}
                            >
                              {getNotificationIcon(n.type)}
                            </div>
                            {!n.read && (
                              <span className="absolute top-0 right-0 w-2 h-2 bg-[#166534] rounded-full ring-2 ring-white" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-xs sm:text-[13px] text-gray-900 leading-snug font-normal select-text">
                              {n.message}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[11px] text-gray-400">{formatTimestamp(n.createdAt)}</span>
                              <span className="text-[11px] text-gray-300">•</span>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.2 rounded-full border ${getCategoryPillBadge(
                                  n.type
                                )}`}
                              >
                                {cat}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Mark Read + Dismiss Cross Button */}
                          <div className="flex items-center gap-1.5 shrink-0 self-center">
                            {!n.read && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-green-700 hover:bg-green-100/70 transition-colors cursor-pointer"
                                title="Mark as read"
                              >
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            )}
                            {/* Dismiss cross button on each item */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteNotification(n.id, e)}
                              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Dismiss notification"
                            >
                              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
