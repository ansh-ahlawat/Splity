import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface ModalContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  maxWidthClass?: string;
  maxHeightClass?: string;
  children: React.ReactNode;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  headerRight,
  maxWidthClass = 'max-w-2xl sm:max-w-3xl',
  maxHeightClass = 'max-h-[85vh] sm:max-h-[520px]',
  children,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-3.5 sm:p-6 overflow-hidden pointer-events-auto"
        >
          {/* Outside outer container: smooth little blur and dark overlay spanning entire screen */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[6px] pointer-events-auto cursor-pointer"
          />

          {/* Extra container outside initial container with 50% opacity representing shading */}
          <motion.div
            ref={contentRef}
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
            className={`relative z-10 w-[94vw] ${maxWidthClass} p-2 rounded-[36px] bg-white/[0.325] border-none shadow-none pointer-events-auto -translate-y-2 sm:-translate-y-3`}
          >
            {/* Initial container: White popup with smooth curve radius like search bar (rounded-[28px]) */}
            <motion.div
              layout
              transition={{
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`bg-white rounded-[28px] border border-[#edf2ee] flex flex-col overflow-hidden ${maxHeightClass} shadow-none`}
            >
              {/* Header: Centered on screen, expansive width, compact height */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 sm:py-4 border-b border-[#edf2ee] bg-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight truncate">
                        {title}
                      </h2>
                      {badge}
                    </div>
                    {subtitle && (
                      <p className="text-[11px] sm:text-xs text-gray-500 font-light mt-0.5 truncate">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {headerRight}
                  {/* Close cross button */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body: Scrollable, horizontally wide and comfortable with smooth height layout */}
              <motion.div
                layout
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 sm:p-7 overflow-y-auto flex-1 overscroll-contain"
              >
                {children}
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
};
