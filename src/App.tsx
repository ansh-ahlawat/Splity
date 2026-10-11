import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { DateProvider } from './context/DateContext.js';
import { AppShell } from './components/AppShell.js';
import { AuthPage, LoginPage, SignUpPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { CategoryDetailPage } from './pages/CategoryDetailPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { FriendsGroupsPage } from './pages/FriendsGroupsPage.js';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage.js';
import { ProfileSetupModal } from './components/ProfileSetupModal.js';
import { SoftFlowCursor } from './components/SoftFlowCursor.js';

const TAB_POSITIONS: Record<string, number> = {
  dashboard: 0,
  'friends-groups': 1,
  transactions: 2,
  categories: 3,
  reports: 4,
  notifications: 5,
  profile: 6,
};

const MainAppContent: React.FC = () => {
  const { user, loading, showProfileSetup, setShowProfileSetup } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentTab, setCurrentTab] = useState(() => {
    try {
      return localStorage.getItem('splity_active_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (!user) {
      try {
        localStorage.removeItem('splity_active_tab');
      } catch {}
      setCurrentTab('dashboard');
    }
  }, [user]);

  const handleTabChange = (nextTab: string) => {
    if (nextTab === currentTab) return;
    const currentPos = TAB_POSITIONS[currentTab] ?? 0;
    const nextPos = TAB_POSITIONS[nextTab] ?? 0;
    setDirection(nextPos >= currentPos ? 1 : -1);
    setCurrentTab(nextTab);
    try {
      localStorage.setItem('splity_active_tab', nextTab);
    } catch {}
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-2.5">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-green-700 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-medium">Loading Expense Buddy...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        mode={authMode}
        onSwitchMode={(next) => setAuthMode(next || (authMode === 'login' ? 'signup' : 'login'))}
      />
    );
  }

  if (showProfileSetup) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#fafbfa]">
        <ProfileSetupModal
          isOpen={true}
          onComplete={() => setShowProfileSetup(false)}
        />
      </div>
    );
  }

  return (
    <>
      <AppShell currentTab={currentTab} onTabChange={handleTabChange}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentTab}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                x: dir > 0 ? 22 : -22,
                opacity: 0,
              }),
              center: {
                x: 0,
                opacity: 1,
              },
              exit: (dir: number) => ({
                x: dir > 0 ? -22 : 22,
                opacity: 0,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 560, damping: 36, mass: 0.35 },
              opacity: { duration: 0.08, ease: 'easeOut' },
            }}
            className="w-full"
          >
            {currentTab === 'dashboard' && <DashboardPage onNavigate={handleTabChange} />}
            {currentTab === 'friends-groups' && <FriendsGroupsPage />}
            {currentTab === 'transactions' && <TransactionsPage />}
            {currentTab === 'categories' && <CategoryDetailPage />}
            {currentTab === 'reports' && <ReportsPage />}
            {currentTab === 'notifications' && <NotificationsPage />}
            {currentTab === 'profile' && <ProfileSettingsPage />}
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <ProfileSetupModal
        isOpen={showProfileSetup}
        onComplete={() => setShowProfileSetup(false)}
      />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DateProvider>
        <SoftFlowCursor />
        <MainAppContent />
      </DateProvider>
    </AuthProvider>
  );
}
