import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FaTableColumns,
  FaReceipt,
  FaChartPie,
  FaChartSimple,
  FaBell,
  FaRightFromBracket,
  FaBars,
  FaXmark,
  FaUsers
} from './FaIcons.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/httpClient.js';
import { NotificationItem } from '../types.js';
import { TopHybridSearchBar } from './TopHybridSearchBar.js';
import { CircularDateDial } from './CircularDateDial.js';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onActionResult?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onTabChange, onActionResult, children }) => {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh all data
  const refreshAllData = () => {
    setRefreshKey(prev => prev + 1);
    if (user) {
      apiRequest<NotificationItem[]>('/api/notifications')
        .then((items) => {
          setUnreadCount(items.filter((n) => !n.read).length);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (user) {
      apiRequest<NotificationItem[]>('/api/notifications')
        .then((items) => {
          setUnreadCount(items.filter((n) => !n.read).length);
        })
        .catch(() => {});
    }

    const handleGlobalRefresh = () => {
      refreshAllData();
    };

    window.addEventListener('splity:refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('splity:refresh', handleGlobalRefresh);
    };
  }, [user, currentTab, refreshKey]);

  // Enhanced action handler with real-time refresh
  const handleActionResult = () => {
    refreshAllData();
    if (onActionResult) {
      onActionResult();
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: FaTableColumns },
    { id: 'friends-groups', label: 'Splits', icon: FaUsers },
    { id: 'transactions', label: 'Ledger', icon: FaReceipt },
    { id: 'categories', label: 'Budgets', icon: FaChartPie },
    { id: 'reports', label: 'Analytics', icon: FaChartSimple },
  ];

  const userDisplayName = user?.email?.split('@')[0] || 'User';
  const userInitials = userDisplayName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col font-sans relative select-none">
      {/* ═══════ PROJECT-WIDE LIGHTENING OVERLAY (Increases background opacity by 3% - 82% overlay) ═══════ */}
      <div className="fixed inset-0 bg-white/82 pointer-events-none z-0" aria-hidden="true" />

      {/* ═══════ TOP BLUR BACKDROP (Smooth vertical progressive gradient blur & dark tint) ═══════ */}
      <div className="fixed inset-x-0 top-0 h-24 sm:h-28 pointer-events-none z-20 overflow-hidden select-none">
        {/* Layer 1: Soft broad progressive blur */}
        <div
          className="absolute inset-0 backdrop-blur-[4px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
          }}
        />
        {/* Layer 2: Medium progressive blur */}
        <div
          className="absolute inset-0 backdrop-blur-[10px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
          }}
        />
        {/* Layer 3: Deep rich blur near very top */}
        <div
          className="absolute inset-0 backdrop-blur-[18px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
          }}
        />
        {/* White shaded neutral gradient wash behind navbar */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/45 to-transparent"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
          }}
        />
      </div>

      {/* ═══════ FIXED TOP LEFT BRAND (Splity exact above current date) ═══════ */}
      <div className="fixed top-3.5 left-[75px] -translate-x-1/2 z-30 flex items-center justify-center">
        <button
          onClick={() => onTabChange('dashboard')}
          className="flex items-center justify-center cursor-pointer select-none py-1 px-2 text-[19px] sm:text-[21px] tracking-tight whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          {/* Clean simple themed green text with Qoeg font */}
          <span className="splity-brand-text">
            Splity
          </span>
        </button>
      </div>

      {/* ═══════ TOP CENTER NAVIGATION (Dashboard to Import in the Middle) ═══════ */}
      <header className="sticky top-3.5 z-30 px-4 w-full flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-transparent text-gray-900 rounded-full px-4 sm:px-6 py-1.5 sm:py-2 flex items-center justify-center transition-all">
          {/* Navigation links with smooth flowing active indicator */}
          <nav className="hidden md:flex items-center gap-1.5 sm:gap-2.5 lg:gap-3">
            {menuItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative px-3 sm:px-3.5 py-1 text-xs sm:text-[13px] transition-colors duration-250 cursor-pointer ${
                    isActive ? 'text-green-800 font-bold' : 'text-gray-500 hover:text-gray-950 font-light'
                  }`}
                >
                  <span className="relative z-10">{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="activeMenuUnderline"
                      className="absolute bottom-[-5px] inset-x-2 h-[2px] bg-green-700 rounded-full"
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
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            {mobileMenuOpen ? <FaXmark className="w-4 h-4" /> : <FaBars className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ═══════ CIRCULAR LEFT-SIDE DATE DIAL ═══════ */}
      <CircularDateDial />

      {/* Mobile Drawer (When Open) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-4 top-16 z-30 p-4 bg-white/95 backdrop-blur-xl text-gray-900 rounded-3xl space-y-2 border border-black/[0.06] shadow-none animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2">
            {menuItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2 rounded-full text-xs font-semibold text-center transition-all ${
                    isActive ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 pt-10 sm:pt-14 pl-4 sm:pl-24 lg:pl-28 max-w-7xl w-full mx-auto pb-64 select-text overflow-x-hidden">
        {children}
      </main>

      {/* Seamless Progressive Gradient Blur at Bottom (Matching same dark tint and progressive blur as above) */}
      <div className="fixed inset-x-0 bottom-0 h-48 pointer-events-none z-20 overflow-hidden select-none">
        {/* Layer 1: Soft broad blur */}
        <div
          className="absolute inset-0 backdrop-blur-[4px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
          }}
        />
        {/* Layer 2: Medium progressive blur */}
        <div
          className="absolute inset-0 backdrop-blur-[10px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
          }}
        />
        {/* Layer 3: Rich deep blur near bottom */}
        <div
          className="absolute inset-0 backdrop-blur-[18px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
          }}
        />
        {/* White shaded neutral gradient wash - matching upper blur */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/45 to-transparent"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
          }}
        />
      </div>

      {/* Floating AI Chatbot Search Bar with Notifications & Profile/Logout Dock */}
      <TopHybridSearchBar
        key={refreshKey}
        onActionResult={handleActionResult}
        onNavigate={onTabChange}
        unreadCount={unreadCount}
      />
    </div>
  );
};
