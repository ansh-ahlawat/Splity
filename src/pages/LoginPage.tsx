import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/httpClient.js';
import { loginWithGooglePopup } from '../lib/firebase.js';

export interface AuthPageProps {
  mode?: 'login' | 'signup';
  onSwitchMode?: (nextMode?: 'login' | 'signup') => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Background Blur Backdrop: Same background and progressive blurs as dashboard
// ═══════════════════════════════════════════════════════════════════════════
const AuthBackgroundBackdrop: React.FC = () => {
  return (
    <>
      {/* White blur backdrop overlay */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[6px] z-0" />

      {/* Top Progressive Blur Backdrop */}
      <div className="fixed inset-x-0 top-0 h-28 sm:h-36 pointer-events-none z-10 overflow-hidden select-none">
        <div
          className="absolute inset-0 backdrop-blur-[4px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0 backdrop-blur-[10px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
          }}
        />
        <div
          className="absolute inset-0 backdrop-blur-[18px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/45 to-transparent"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
          }}
        />
      </div>

      {/* Bottom Progressive Blur Backdrop */}
      <div className="fixed inset-x-0 bottom-0 h-36 sm:h-48 pointer-events-none z-10 overflow-hidden select-none">
        <div
          className="absolute inset-0 backdrop-blur-[4px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 78%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0 backdrop-blur-[10px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.4) 65%, transparent 92%)',
          }}
        />
        <div
          className="absolute inset-0 backdrop-blur-[18px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.7) 35%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/45 to-transparent"
          style={{
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.3) 80%, transparent 100%)',
          }}
        />
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Splity Brand Logo Pill Badge
// ═══════════════════════════════════════════════════════════════════════════
const SplityBrandBadge: React.FC = () => {
  return (
    <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-gray-200/60 bg-white/70 shadow-none select-none">
      <span className="text-[16px] sm:text-[17px] splity-brand-text text-[#166534] tracking-wide font-normal">
        Splity
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Right Side Visual Component: 100% Opacity with Subtle Right Alignment
// ═══════════════════════════════════════════════════════════════════════════
const OnboardVisualPanel: React.FC = () => {
  return (
    <div className="w-full md:flex-1 hidden md:flex items-center justify-center self-stretch relative overflow-hidden bg-transparent md:rounded-l-[34px] sm:md:rounded-l-[42px] md:rounded-r-[42px] sm:md:rounded-r-[50px] lg:md:rounded-r-[56px]">
      <img
        src="/onboard.png"
        alt="Splity Onboarding"
        className="w-full h-full object-cover object-center pointer-events-none select-none scale-[1.05] -translate-x-0.5 sm:-translate-x-1 opacity-100"
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Unified AuthPage: Smooth Transition Between Sign In and Sign Up
// ═══════════════════════════════════════════════════════════════════════════
export const AuthPage: React.FC<AuthPageProps> = ({ mode = 'login', onSwitchMode }) => {
  const { login, signup, loginWithGoogle } = useAuth();
  const [internalMode, setInternalMode] = useState<'login' | 'signup'>(mode);

  // Sync mode prop if passed from parent
  const currentMode = onSwitchMode ? mode : internalMode;

  const handleSwitch = (next: 'login' | 'signup') => {
    if (onSwitchMode) {
      onSwitchMode(next);
    } else {
      setInternalMode(next);
    }
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up form state
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Status & loading state
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (signupPassword.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    setSubmitting(true);
    try {
      await signup('', signupEmail.trim(), signupPassword, signupPassword, signupFullName.trim());
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (forgotNewPassword !== forgotConfirmPassword) {
      return setForgotError('Passwords do not match.');
    }
    if (forgotNewPassword.length < 8) {
      return setForgotError('Password must be at least 8 characters long.');
    }

    setForgotSubmitting(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotIdentifier.trim(),
          newPassword: forgotNewPassword,
        }),
      });

      setForgotSuccess(res.message || 'Password reset successfully! You can now sign in.');
      setLoginEmail(forgotIdentifier.trim());
      setLoginPassword(forgotNewPassword);

      setTimeout(() => {
        setShowForgotModal(false);
        setForgotSuccess('');
        setForgotError('');
      }, 1800);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please check your credentials.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setSubmitting(true);
    try {
      const googleUser = await loginWithGooglePopup();
      if (!googleUser?.email) {
        throw new Error('Google authentication did not return an email');
      }
      await loginWithGoogle({
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoURL,
      });
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized in Firebase. Please add this origin to Firebase Console > Authentication > Settings > Authorized domains.');
      } else {
        setError(err.message || 'Google sign in failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      localStorage.setItem('profile_fullname', 'Ansh Ahlawat');
      localStorage.setItem('profile_phone', '+91 00000 00000');
      localStorage.setItem('profile_ceiling', '45000');
      localStorage.setItem('profile_savings', '40000');
      localStorage.setItem('profile_setup_done_demo-user-123', 'true');
      await login('demo@expensebuddy.app', 'Password123!');
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-screen max-w-full overflow-hidden flex items-center justify-center p-3 sm:p-5 lg:p-8 select-none relative">
      {/* Background dark blur with progressive blurs */}
      <AuthBackgroundBackdrop />

      {/* Outside container: Soft translucent halo with smooth, curvy radius and NO stroke borders (opacity +5% -> 0.22) */}
      <div className="relative z-20 p-2.5 sm:p-3.5 rounded-[48px] sm:rounded-[56px] lg:rounded-[64px] bg-white/[0.22] backdrop-blur-2xl border-none shadow-none pointer-events-auto">
        {/* Main Card: Smooth, curvy corners, zero stroke borders */}
        <div className="w-[980px] lg:w-[1040px] xl:w-[1080px] max-w-[96vw] min-h-[560px] sm:min-h-[580px] max-h-[90vh] bg-gradient-to-br from-[#ffffff] via-[#f7faf8] to-[#eaf5ee] rounded-[42px] sm:rounded-[50px] lg:rounded-[56px] border-none shadow-none flex flex-col md:flex-row overflow-hidden relative">
          {/* Ambient soft light-green gradient texture at bottom & bottom-left */}
          <div
            className="absolute -bottom-24 -left-20 w-96 h-96 rounded-full pointer-events-none select-none blur-3xl opacity-75"
            style={{
              background: 'radial-gradient(circle, rgba(167, 243, 208, 0.65) 0%, rgba(187, 247, 208, 0.35) 45%, transparent 70%)',
            }}
          />
          <div
            className="absolute bottom-0 inset-x-0 h-32 pointer-events-none select-none opacity-40"
            style={{
              background: 'linear-gradient(to top, rgba(187, 247, 208, 0.45) 0%, rgba(240, 253, 244, 0.2) 60%, transparent 100%)',
            }}
          />

          {/* Left Panel: Form Content with Smooth Mode Transitions & Airy Spacing */}
          <div className="w-full md:w-[47%] lg:w-[45%] p-6 sm:p-8 md:p-9 flex flex-col justify-between relative z-10 overflow-y-auto no-scrollbar">
            {/* Top Badge: Splity Logo */}
            <div className="flex items-center justify-start">
              <SplityBrandBadge />
            </div>

            {/* Middle Section: Smooth Transition Form Container */}
            <div className="w-full max-w-[320px] sm:max-w-[330px] mx-auto my-auto py-2">
              <AnimatePresence mode="wait" initial={false}>
                {showForgotModal ? (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                    className="w-full"
                  >
                    <div className="text-center md:text-left pt-2 pb-1">
                      <h2 className="text-2xl sm:text-[27px] font-normal text-gray-800 tracking-tight font-sans">
                        Reset Password
                      </h2>
                      <p className="text-xs sm:text-[12.5px] text-gray-400 font-extralight tracking-normal leading-relaxed mt-1.5">
                        Enter your email or phone &amp; new password
                      </p>
                    </div>

                    {forgotError && (
                      <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs font-normal rounded-2xl border-none">
                        {forgotError}
                      </div>
                    )}

                    {forgotSuccess && (
                      <div className="mt-3 p-2.5 bg-green-50 text-green-700 text-xs font-normal rounded-2xl border-none flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span>{forgotSuccess}</span>
                      </div>
                    )}

                    {/* Generous downward spacing to inputs */}
                    <form onSubmit={handleResetPassword} className="mt-6 space-y-3.5">
                      <div>
                        <input
                          type="text"
                          required
                          value={forgotIdentifier}
                          onChange={(e) => setForgotIdentifier(e.target.value)}
                          placeholder="Registered Email or Mobile"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 px-5 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                      </div>

                      <div className="relative">
                        <input
                          type={showForgotPass ? 'text' : 'password'}
                          required
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="New Password (min 8 chars)"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 pl-5 pr-11 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotPass(!showForgotPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                        >
                          {showForgotPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div>
                        <input
                          type={showForgotPass ? 'text' : 'password'}
                          required
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          placeholder="Confirm New Password"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 px-5 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                      </div>

                      {/* Generous downward spacing to Submit button with arrow */}
                      <div className="pt-2 mt-5">
                        <button
                          type="submit"
                          disabled={forgotSubmitting}
                          className="group w-full h-11 sm:h-12 rounded-full font-sans font-medium text-sm text-white flex items-center justify-center gap-2.5 bg-[#166534] hover:bg-[#14532d] active:scale-[0.99] transition-all cursor-pointer border-none shadow-none disabled:opacity-60"
                        >
                          {forgotSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="font-sans font-medium tracking-normal text-[14px]">Submit</span>
                              <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform shrink-0" />
                            </>
                          )}
                        </button>
                      </div>

                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotModal(false);
                            setForgotError('');
                            setForgotSuccess('');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : currentMode === 'login' ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                    className="w-full"
                  >
                    {/* Header: Sign In */}
                    <div className="text-center md:text-left pt-2 pb-1">
                      <h2 className="text-2xl sm:text-[27px] font-normal text-gray-800 tracking-tight font-sans">
                        Sign in
                      </h2>
                      <p className="text-[11px] sm:text-[11.5px] text-gray-400 font-extralight tracking-normal leading-relaxed mt-1">
                        Enter your credentials to access your dashboard
                      </p>
                    </div>

                    {error && (
                      <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs font-normal rounded-2xl border-none">
                        {error}
                      </div>
                    )}

                    {/* Form with natural spacing as before */}
                    <form onSubmit={handleLoginSubmit} className="mt-6 space-y-3.5">
                      {/* Email or Username */}
                      <div>
                        <input
                          type="text"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="Email or Username"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 px-5 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                      </div>

                      {/* Password with Eye Toggle & Forgot Link */}
                      <div className="space-y-1.5">
                        <div className="relative">
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 pl-5 pr-11 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                          >
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {/* Forgot Password Link */}
                        <div className="flex justify-end pr-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForgotIdentifier(loginEmail);
                              setForgotError('');
                              setForgotSuccess('');
                              setShowForgotModal(true);
                            }}
                            className="text-[11px] sm:text-[11.5px] text-[#166534] hover:text-[#14532d] hover:underline cursor-pointer transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>
                      </div>

                      {/* Generous downward spacing to Submit Button */}
                      <div className="pt-2 mt-5">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="group w-full h-11 sm:h-12 rounded-full font-sans font-medium text-sm text-white flex items-center justify-center gap-2.5 bg-[#166534] hover:bg-[#14532d] active:scale-[0.99] transition-all cursor-pointer border-none shadow-none disabled:opacity-60"
                        >
                          {submitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="font-sans font-medium tracking-normal text-[14px]">Submit</span>
                              <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform shrink-0" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Downward spacing to Switcher Buttons */}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => handleSwitch('signup')}
                          className="w-full h-10 sm:h-11 rounded-full border border-gray-200/70 bg-white/80 hover:bg-white active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs sm:text-[13px] text-gray-700 font-normal cursor-pointer shadow-none px-2"
                        >
                          <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span className="truncate font-sans">Sign Up</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleGoogleAuth}
                          disabled={submitting}
                          className="w-full h-10 sm:h-11 rounded-full border border-gray-200/70 bg-white/80 hover:bg-white active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs sm:text-[13px] text-gray-700 font-normal cursor-pointer shadow-none px-2"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                          </svg>
                          <span className="truncate font-sans">Google</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                    className="w-full"
                  >
                    {/* Header: Sign Up */}
                    <div className="text-center md:text-left pt-2 pb-1">
                      <h2 className="text-2xl sm:text-[27px] font-normal text-gray-800 tracking-tight font-sans">
                        Create an account
                      </h2>
                      <p className="text-[11px] sm:text-[11.5px] text-gray-400 font-extralight tracking-normal leading-relaxed mt-1">
                        Sign up and manage your expenses with ease
                      </p>
                    </div>

                    {error && (
                      <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs font-normal rounded-2xl border-none">
                        {error}
                      </div>
                    )}

                    {/* Form with natural spacing as before */}
                    <form onSubmit={handleSignupSubmit} className="mt-6 space-y-3.5">
                      {/* Full name input */}
                      <div>
                        <input
                          type="text"
                          required
                          value={signupFullName}
                          onChange={(e) => setSignupFullName(e.target.value)}
                          placeholder="Full name"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 px-5 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                      </div>

                      {/* Email input */}
                      <div>
                        <input
                          type="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 px-5 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                        />
                      </div>

                      {/* Password input with eye toggle */}
                      <div>
                        <div className="relative">
                          <input
                            type={showSignupPassword ? 'text' : 'password'}
                            required
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full h-11 sm:h-12 rounded-full bg-white hover:bg-white focus:bg-white border border-gray-200/70 focus:border-[#166534]/50 focus:ring-2 focus:ring-[#166534]/10 pl-5 pr-11 text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 outline-none transition-all shadow-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                          >
                            {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Generous downward spacing to Submit Button */}
                      <div className="pt-2 mt-5">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="group w-full h-11 sm:h-12 rounded-full font-sans font-medium text-sm text-white flex items-center justify-center gap-2.5 bg-[#166534] hover:bg-[#14532d] active:scale-[0.99] transition-all cursor-pointer border-none shadow-none disabled:opacity-60"
                        >
                          {submitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="font-sans font-medium tracking-normal text-[14px]">Submit</span>
                              <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform shrink-0" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Downward spacing to Switcher Buttons */}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => handleSwitch('login')}
                          className="w-full h-10 sm:h-11 rounded-full border border-gray-200/70 bg-white/80 hover:bg-white active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs sm:text-[13px] text-gray-700 font-normal cursor-pointer shadow-none px-2"
                        >
                          <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span className="truncate font-sans">Sign In</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleGoogleAuth}
                          disabled={submitting}
                          className="w-full h-10 sm:h-11 rounded-full border border-gray-200/70 bg-white/80 hover:bg-white active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs sm:text-[13px] text-gray-700 font-normal cursor-pointer shadow-none px-2"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                          </svg>
                          <span className="truncate font-sans">Google</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Row: Demo Login only */}
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting}
                className="text-[12px] font-light text-[#166534] hover:text-[#14532d] hover:underline cursor-pointer transition-colors py-1"
              >
                Demo login
              </button>
            </div>
          </div>

          {/* Right Panel: Visual Image Component with uncropped onboard.png */}
          <OnboardVisualPanel />
        </div>
      </div>
    </div>
  );
};

// Export individual components for backward compatibility
export const LoginPage: React.FC<AuthPageProps> = ({ onSwitchMode }) => {
  return <AuthPage mode="login" onSwitchMode={onSwitchMode} />;
};

export const SignUpPage: React.FC<AuthPageProps> = ({ onSwitchMode }) => {
  return <AuthPage mode="signup" onSwitchMode={onSwitchMode} />;
};
