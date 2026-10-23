import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.js';
import {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  setStoredUser,
  getStoredUser,
  clearAuthSession,
  isTokenValid,
  refreshAuthTokens,
  apiRequest,
} from '../api/httpClient.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  showProfileSetup: boolean;
  setShowProfileSetup: (show: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  signup: (phone: string, email: string, pass: string, confirm: string, fullName?: string) => Promise<void>;
  loginWithGoogle: (googleUser: { email: string; displayName?: string | null; photoURL?: string | null }) => Promise<void>;
  updateUserProfile: (data: { name: string; phone: string; spendingCeiling: number; targetSavings: number }) => Promise<void>;
  logout: () => Promise<void>;
}

function isProfileSetupNeeded(u: User | null): boolean {
  if (!u || !u.id) return false;
  if (u.id === 'demo-user-123') return false;
  if (u.profileSetupCompleted) return false;
  const doneForUser = localStorage.getItem(`profile_setup_done_${u.id}`);
  if (doneForUser === 'true') return false;
  return true;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = getStoredUser();
    const token = getAccessToken();
    const refresh = getRefreshToken();
    if (savedUser && (token || refresh)) {
      return savedUser;
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    const savedUser = getStoredUser();
    const token = getAccessToken();
    const refresh = getRefreshToken();

    if (savedUser && token && isTokenValid(token)) {
      return false;
    }
    if (refresh || savedUser) {
      return true;
    }
    return false;
  });

  const [showProfileSetup, setShowProfileSetup] = useState<boolean>(() => {
    const savedUser = getStoredUser();
    return isProfileSetupNeeded(savedUser);
  });

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const token = getAccessToken();
      const refresh = getRefreshToken();
      const savedUser = getStoredUser();

      // Case 1: Active session with valid token
      if (savedUser && token && isTokenValid(token)) {
        if (isMounted) {
          setUser(savedUser);
          setShowProfileSetup(isProfileSetupNeeded(savedUser));
          setLoading(false);
        }
        // Background verify /me
        try {
          const me = await apiRequest<User>('/api/me');
          if (isMounted && me?.id) {
            setUser(me);
            setStoredUser(me);
            setShowProfileSetup(isProfileSetupNeeded(me));
          }
        } catch {
          // If network temporarily unavailable, retain local user state
        }
        return;
      }

      // Case 2: Expired access token or needing refresh
      if (refresh || savedUser) {
        try {
          const res = await refreshAuthTokens();
          if (isMounted) {
            if (res?.accessToken && res?.user) {
              setUser(res.user);
              setShowProfileSetup(isProfileSetupNeeded(res.user));
            } else if (res?.accessToken) {
              const current = getStoredUser();
              setUser(current);
              setShowProfileSetup(isProfileSetupNeeded(current));
            } else {
              setUser(null);
              setShowProfileSetup(false);
            }
          }
        } catch {
          if (isMounted) {
            setUser(null);
            setShowProfileSetup(false);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
        return;
      }

      // Case 3: No local token, but let's check if a cookie exists on backend
      try {
        const res = await refreshAuthTokens();
        if (isMounted) {
          if (res?.accessToken && res?.user) {
            setUser(res.user);
            setShowProfileSetup(isProfileSetupNeeded(res.user));
          } else if (res?.accessToken) {
            const current = getStoredUser();
            setUser(current);
            setShowProfileSetup(isProfileSetupNeeded(current));
          } else {
            setUser(null);
            setShowProfileSetup(false);
          }
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setShowProfileSetup(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiRequest<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    setStoredUser(res.user);
    setUser(res.user);
    setShowProfileSetup(isProfileSetupNeeded(res.user));
  };

  const signup = async (phone: string, email: string, pass: string, confirm: string, fullName?: string) => {
    const res = await apiRequest<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ phone, email, password: pass, confirmPassword: confirm, fullName }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    setStoredUser(res.user);
    setUser(res.user);

    if (fullName) {
      localStorage.setItem('profile_fullname', fullName);
    }

    // New accounts ALWAYS show mandatory profile setup
    setShowProfileSetup(true);
  };

  const loginWithGoogle = async (googleUser: { email: string; displayName?: string | null; photoURL?: string | null }) => {
    const res = await apiRequest<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoURL,
      }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    setStoredUser(res.user);
    setUser(res.user);
    setShowProfileSetup(isProfileSetupNeeded(res.user));
  };

  const updateUserProfile = async (data: { name: string; phone: string; spendingCeiling: number; targetSavings: number }) => {
    const updatedUser = await apiRequest<User>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        phone: data.phone,
        spendingCeiling: data.spendingCeiling,
        targetSavings: data.targetSavings,
        profileSetupCompleted: true,
      }),
    });

    setStoredUser(updatedUser);
    setUser(updatedUser);
    if (updatedUser?.id) {
      localStorage.setItem(`profile_setup_done_${updatedUser.id}`, 'true');
    }
    localStorage.setItem('profile_fullname', data.name);
    localStorage.setItem('profile_phone', data.phone);
    localStorage.setItem('profile_ceiling', String(data.spendingCeiling));
    localStorage.setItem('profile_savings', String(data.targetSavings));
    setShowProfileSetup(false);
    window.dispatchEvent(new CustomEvent('splity:refresh'));
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthSession();
      setUser(null);
      setShowProfileSetup(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        showProfileSetup,
        setShowProfileSetup,
        login,
        signup,
        loginWithGoogle,
        updateUserProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
