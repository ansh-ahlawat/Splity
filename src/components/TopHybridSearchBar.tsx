import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FaMicrophoneLines,
  FaAngleRight,
  FaCircleCheck,
  FaVolumeHigh,
  FaXmark,
  FaBell,
} from './FaIcons.js';
import { SmartSearchResult } from '../types.js';
import { apiRequest } from '../api/httpClient.js';
import { useAuth } from '../context/AuthContext.js';
import { NotificationPopup } from './NotificationPopup.js';
import { DemoProfileModal } from './DemoProfileModal.js';

interface TopHybridSearchBarProps {
  onActionResult?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
}

const ROTATING_TEXTS = [
  'Add 500 expense split with Ram',
  'Clear my dues with Ram',
  'Add Priya paid 300 for dinner',
  'Clear all pending balances with friends',
  'How much spent on Food this month?',
  'Can I buy iPhone in November?',
  'Add 200 for coffee',
  'Set Food budget to 5000',
  'Show biggest expenses this month',
  'Clear all pending debts',
];

// Kinetic Typography / Sequential Text Reveal Animation Variants
const kineticContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.052,
      delayChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.026,
      staggerDirection: 1,
    },
  },
};

const kineticWordVariants = {
  initial: {
    y: '120%',
    opacity: 0,
    filter: 'blur(3px)',
  },
  animate: {
    y: '0%',
    opacity: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    y: '-120%',
    opacity: 0,
    filter: 'blur(2px)',
    transition: {
      duration: 0.28,
      ease: [0.36, 0, 0.66, 0],
    },
  },
};

export const TopHybridSearchBar: React.FC<TopHybridSearchBarProps> = ({
  onActionResult,
  onNavigate,
  unreadCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const [textIndex, setTextIndex] = useState(0);
  const [notificationPopupOpen, setNotificationPopupOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [hasSeenNotifications, setHasSeenNotifications] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoSendTimerRef = useRef<any>(null);

  // Dismiss search result when clicking outside the expanded rectangle
  useEffect(() => {
    if (!result) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setResult(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [result]);

  // Extract only first name and single character monogram
  const storedName = typeof window !== 'undefined' ? localStorage.getItem('profile_fullname') : null;
  const rawName = user?.name || storedName || (user?.email ? user.email.split('@')[0] : 'User') || 'User';
  let firstName = rawName.trim().split(/[\s._-]+/)[0] || 'User';
  if (firstName.toLowerCase() === 'demo') {
    firstName = 'User';
  }
  const displayFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const monogramChar = displayFirstName.charAt(0).toUpperCase();

  // Play sphere ball video seamlessly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
      }
    };
  }, []);

  // Cycle placeholder sentence with flowing word-by-word train animation
  useEffect(() => {
    if (query) return;
    const timer = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % ROTATING_TEXTS.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [query]);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofill current suggested query on Tab
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (e.key === 'Tab' && !query.trim()) {
      e.preventDefault();
      const curr = ROTATING_TEXTS[textIndex];
      if (curr) {
        setQuery(curr);
      }
    }
  };

  const handleToggleVoice = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    setVoiceError(null);
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser.');
      setTimeout(() => setVoiceError(null), 1500);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        try {
          recognition.stop();
        } catch (_) {}

        if (transcript) {
          setQuery(transcript);
          // Wait 300ms after speaking before auto-sending for faster response
          if (autoSendTimerRef.current) {
            clearTimeout(autoSendTimerRef.current);
          }
          autoSendTimerRef.current = setTimeout(() => {
            executeSearch(transcript);
          }, 300);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        try {
          recognition.stop();
        } catch (_) {}
        const errorType = event?.error;
        if (errorType === 'aborted') return;

        let msg = 'Voice input interrupted. Try again.';
        if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
          msg = 'Microphone permission blocked.';
        } else if (errorType === 'no-speech') {
          msg = 'No speech detected.';
        }
        setVoiceError(msg);
        setTimeout(() => setVoiceError(null), 1500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setVoiceError('Could not initialize microphone.');
      setTimeout(() => setVoiceError(null), 1500);
    }
  };

  const executeSearch = async (textToSearch: string) => {
    if (!textToSearch.trim()) return;
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    setLoading(true);

    try {
      const data = await apiRequest<SmartSearchResult>('/api/smart-search', {
        method: 'POST',
        body: JSON.stringify({ query: textToSearch }),
      });

      setResult(data);
      // Clear search bar like new after providing the answer
      setQuery('');

      if (onActionResult && data.actionTaken) {
        onActionResult();
      }
    } catch (err: any) {
      setResult({
        intent: 'ERROR',
        source: 'gemini',
        query: textToSearch,
        message: err?.message || 'Unable to process query. Please try again.',
      });
      setQuery('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    executeSearch(query);
  };

  const handleNotificationClick = () => {
    setNotificationPopupOpen(true);
    setHasSeenNotifications(true);
  };

  const handleNotificationClose = () => {
    setNotificationPopupOpen(false);
  };

  const handleNotificationRefresh = () => {
    if (onActionResult) {
      onActionResult();
    }
  };

  const handleMarkAsRead = () => {
    setHasSeenNotifications(true);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-9 inset-x-0 z-40 flex items-end justify-center gap-2 sm:gap-2.5 pointer-events-none px-3 sm:px-4"
    >
      {/* Left: Notifications Pill Button - thin minimalist bell design */}
      <button
        type="button"
        onClick={handleNotificationClick}
        title="Notifications"
        className="pointer-events-auto h-12 sm:h-[49px] w-12 sm:w-[49px] shrink-0 bg-white border border-[#edf2ee] hover:border-[#dfe6e0] active:scale-95 rounded-full flex items-center justify-center text-[#166534] hover:text-[#14532d] transition-colors cursor-pointer relative"
        style={{ boxShadow: 'none' }}
      >
        <svg
          className="w-4 h-4 text-[#166534] shrink-0 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#166534"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && !hasSeenNotifications && (
          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#dc2626] ring-2 ring-white" />
        )}
      </button>

      {/* Center: Search Bar with Smooth Flow Morphing Animation and Zero Shadow */}
      <div ref={searchBoxRef} className="pointer-events-auto w-full max-w-[320px] xs:max-w-[360px] sm:max-w-[430px] md:max-w-[470px] relative flex flex-col items-center">
        <motion.div
          layout
          animate={{
            borderRadius: result ? 28 : 9999,
          }}
          transition={{
            layout: {
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
            },
            borderRadius: {
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
            },
          }}
          className="w-full bg-white text-gray-900 border border-[#edf2ee] hover:border-[#dfe6e0] focus-within:border-[#dfe6e0] flex flex-col overflow-hidden"
          style={{ boxShadow: 'none' }}
        >
          {/* Top section: Answer rectangle expanding upwards with ultra-smooth slow flow animation */}
          <AnimatePresence initial={false}>
            {result && (
              <motion.div
                key="smart-search-result-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  height: { duration: 0.62, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.48, ease: 'easeInOut' },
                }}
                className="overflow-hidden border-b border-[#edf2ee]/80 select-text"
              >
                <div className="px-4 pt-3.5 pb-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span className="text-[11px] font-light tracking-wide text-gray-500 uppercase">
                        Smart search • {result.intent.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <FaXmark className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thin text answer */}
                  <p className="text-xs sm:text-[13px] text-gray-700 leading-relaxed font-light">
                    {result.message}
                  </p>

                  {result.actionTaken && (
                    <div className="flex items-center gap-2 text-xs font-light text-emerald-800 bg-emerald-50/70 px-3 py-1.5 rounded-full">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-light">Updated in your finances successfully.</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom section: Search bar form (Permanent zero shadow, light stroke) */}
          <form
            onSubmit={handleSubmit}
            className="w-full h-12 sm:h-[49px] px-2 pl-2 sm:pl-2.5 pr-2 sm:pr-2.5 flex items-center gap-2.5 sm:gap-3 select-none bg-white focus-within:ring-0 focus-within:outline-none"
            style={{ boxShadow: 'none' }}
          >
            {/* Sphere Ball Rolling Video Emblem - outer circle removed, shifted between current and previous */}
            <div className="w-7 h-7 sm:w-[28px] sm:h-[28px] ml-0.5 sm:ml-0.5 rounded-full overflow-hidden shrink-0 flex items-center justify-center select-none">
              <video
                ref={videoRef}
                src="/rolling-ball.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover pointer-events-none rounded-full scale-105"
              />
            </div>

            {/* Search Input, Fixed Listening State, and Inline Error Text */}
            <div className="relative flex-1 flex items-center h-9 min-w-0">
              {voiceError ? (
                <span className="text-xs sm:text-[13.5px] font-light text-rose-500/90 truncate select-none">
                  {voiceError}
                </span>
              ) : isListening ? (
                <span className="text-xs sm:text-[13.5px] font-light text-gray-400 select-none truncate">
                  Listening your voice...
                </span>
              ) : (
                <>
                  {/* Word-by-Word Kinetic Typography / Sequential Text Reveal */}
                  {!query && (
                    <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden select-none">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={textIndex}
                          variants={kineticContainerVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap overflow-hidden pointer-events-none select-none"
                        >
                          {ROTATING_TEXTS[textIndex].split(' ').map((word, wIdx) => (
                            <span key={wIdx} className="inline-flex overflow-hidden py-0.5 mr-[3.5px]">
                              <motion.span
                                variants={kineticWordVariants}
                                className="inline-block text-xs sm:text-[13px] font-light text-gray-400 select-none leading-none tracking-normal"
                              >
                                {word}
                              </motion.span>
                            </span>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onFocus={() => {
                      if (voiceError) setVoiceError(null);
                    }}
                    onChange={(e) => {
                      if (autoSendTimerRef.current) {
                        clearTimeout(autoSendTimerRef.current);
                        autoSendTimerRef.current = null;
                      }
                      if (voiceError) setVoiceError(null);
                      setQuery(e.target.value);
                      // Auto-send after 500ms of typing stops for faster response
                      if (e.target.value.trim()) {
                        autoSendTimerRef.current = setTimeout(() => {
                          executeSearch(e.target.value);
                        }, 500);
                      }
                    }}
                    onKeyDown={handleInputKeyDown}
                    className="w-full bg-transparent text-xs sm:text-[13.5px] font-light text-gray-900 focus:outline-none focus:ring-0 py-1 relative z-10 border-none shadow-none"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                </>
              )}
            </div>

            {/* Right Action Controls: shifted little right, send button color darkened like downward arrow in receivables */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-0 mr-0">
              {/* Clear input cross button */}
              {Boolean(query) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    if (autoSendTimerRef.current) {
                      clearTimeout(autoSendTimerRef.current);
                      autoSendTimerRef.current = null;
                    }
                    inputRef.current?.focus();
                  }}
                  title="Clear input"
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-black/[0.04] transition-all cursor-pointer"
                >
                  <FaXmark className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              )}

              {/* Voice Mic / Speaker button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                title={isListening ? 'Stop listening' : 'Voice input'}
                className="w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-all cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-black/[0.04]"
              >
                {isListening ? (
                  <FaVolumeHigh className="w-3 h-3" style={{ color: '#9ca3af' }} />
                ) : (
                  <FaMicrophoneLines
                    className="w-3 h-3"
                    style={{ color: '#9ca3af' }}
                  />
                )}
              </button>

              {/* Send button with colors matching downward arrow in receivables */}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                title="Submit command"
                className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-[#edf4ed] hover:bg-[#e2ede2] text-green-800 active:scale-95 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-none"
                style={{ boxShadow: 'none' }}
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-green-800/40 border-t-green-800 rounded-full animate-spin" />
                ) : (
                  <FaAngleRight
                    className="w-3.5 h-3.5 text-green-800"
                  />
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Right: Profile monogram & first name (black text), tightened width & centered hover */}
      <div
        className="pointer-events-auto h-12 sm:h-[49px] shrink-0 bg-white border border-[#edf2ee] hover:border-[#dfe6e0] rounded-full flex items-center pl-1 sm:pl-1.5 pr-1 sm:pr-1.5 gap-1 sm:gap-1.5 transition-colors"
      >
        {/* Profile / Demo Button: opens Account popup modal with first name only */}
        <button
          type="button"
          onClick={() => setDemoModalOpen(true)}
          title="Account Settings"
          className="flex items-center gap-1.5 p-0.5 pr-2 sm:pr-2.5 rounded-full hover:bg-black/[0.03] transition-colors cursor-pointer"
        >
          {/* Monogram: same size as send button, Import Statement green background & text */}
          <div className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] select-none transition-transform active:scale-95 text-xs sm:text-[13px] font-semibold">
            {monogramChar}
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-gray-900 select-none">
            {displayFirstName}
          </span>
        </button>

        <div className="w-px h-3.5 bg-gray-200/80 my-auto shrink-0" />

        {/* Logout beside it: red sign out button as before */}
        <button
          type="button"
          onClick={() => logout()}
          title="Sign out"
          className="w-8 h-8 sm:w-8.5 sm:h-8.5 shrink-0 rounded-full flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50/70 active:scale-95 transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 sm:w-[16px] sm:h-[16px] shrink-0 block"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {/* Notification Popup */}
      <NotificationPopup
        isOpen={notificationPopupOpen}
        onClose={handleNotificationClose}
        onRefresh={handleNotificationRefresh}
        unreadCount={unreadCount}
        onMarkAsRead={handleMarkAsRead}
      />

      {/* Demo & Profile Sandbox Popup */}
      <DemoProfileModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onActionResult={onActionResult}
      />
    </div>
  );
};
