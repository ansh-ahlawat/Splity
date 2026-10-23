import React, { useRef, useState } from 'react';
import { useDate } from '../context/DateContext.js';

const MONTHS_LIST = [
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
  '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06',
  '2027-07', '2027-08', '2027-09', '2027-10', '2027-11', '2027-12'
];

const renderMonthLabel = (mStr: string) => {
  const [year, month] = mStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
  const yearShort = year.slice(-2);
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{monthShort}</span>
      <span className="font-mono-num font-normal tracking-tight">{yearShort}</span>
    </span>
  );
};

export const CircularDateDial: React.FC = () => {
  const { selectedMonth, setSelectedMonth } = useDate();
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  // Wheel accumulation for silky smooth wheel / trackpad scrolling
  const wheelAccumulatorRef = useRef(0);
  const wheelDebounceTimerRef = useRef<any>(null);
  const lastStepTimeRef = useRef<number>(0);

  const selectedIndex = Math.max(0, MONTHS_LIST.indexOf(selectedMonth));

  // Smooth Stretched Vertical Ellipse dimensions
  const RADIUS_X = 240; // horizontal curvature radius
  const RADIUS_Y = 380; // vertical elongation radius
  const ANGLE_STEP = 11.5; // smooth spacing between consecutive dates

  const handleSelectMonthByIndex = (index: number) => {
    if (index >= 0 && index < MONTHS_LIST.length) {
      setSelectedMonth(MONTHS_LIST[index]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    wheelAccumulatorRef.current += e.deltaY;

    if (wheelDebounceTimerRef.current) {
      clearTimeout(wheelDebounceTimerRef.current);
    }
    wheelDebounceTimerRef.current = setTimeout(() => {
      wheelAccumulatorRef.current = 0;
    }, 160);

    const THRESHOLD = 40; // accumulation threshold to step 1 discrete month
    const COOLDOWN_MS = 220; // smooth cooldown matching slower glide

    if (now - lastStepTimeRef.current >= COOLDOWN_MS) {
      if (wheelAccumulatorRef.current >= THRESHOLD) {
        if (selectedIndex < MONTHS_LIST.length - 1) {
          setSelectedMonth(MONTHS_LIST[selectedIndex + 1]);
          lastStepTimeRef.current = now;
          wheelAccumulatorRef.current = 0;
        }
      } else if (wheelAccumulatorRef.current <= -THRESHOLD) {
        if (selectedIndex > 0) {
          setSelectedMonth(MONTHS_LIST[selectedIndex - 1]);
          lastStepTimeRef.current = now;
          wheelAccumulatorRef.current = 0;
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientY - dragStartY;
    if (Math.abs(diff) > 32) {
      if (diff > 0 && selectedIndex > 0) {
        setSelectedMonth(MONTHS_LIST[selectedIndex - 1]);
        setDragStartY(e.clientY);
      } else if (diff < 0 && selectedIndex < MONTHS_LIST.length - 1) {
        setSelectedMonth(MONTHS_LIST[selectedIndex + 1]);
        setDragStartY(e.clientY);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Continuous blur, scale, and opacity curve along the ellipse:
  // Increased opacity by 2% and reduced blur by 2%
  const getBlurAndOpacity = (dist: number) => {
    switch (dist) {
      case 0:
        return { blur: 0.47, opacity: 1, scale: 1.05 };
      case 1:
        return { blur: 0.57, opacity: 0.94, scale: 0.98 };
      case 2:
        return { blur: 1.04, opacity: 0.76, scale: 0.93 };
      case 3:
        return { blur: 1.41, opacity: 0.48, scale: 0.87 };
      case 4:
        return { blur: 1.88, opacity: 0.21, scale: 0.81 };
      case 5:
        return { blur: 2.45, opacity: 0.06, scale: 0.75 };
      default:
        return { blur: 2.82, opacity: 0.02, scale: 0.70 };
    }
  };

  return (
    <aside
      ref={dialRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`fixed -left-[415px] top-1/2 -translate-y-1/2 z-30 w-[500px] h-[800px] select-none pointer-events-auto ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      title="Scroll mouse wheel or drag vertically to rotate date dial"
    >
      {/* Exact Transparent Ellipse Canvas (Zero circle lines) */}
      <div className="relative w-full h-full bg-transparent">
        {/* Orbiting Date Labels along Smooth Vertical Ellipse */}
        {MONTHS_LIST.map((mStr, idx) => {
          const offset = idx - selectedIndex;
          const dist = Math.abs(offset);
          const angleDeg = offset * ANGLE_STEP;

          // Keep items rendered along the arc up to dist 6 so they transition smoothly into/out of shape
          if (dist > 6) return null;

          const angleRad = (angleDeg * Math.PI) / 180;
          const cx = 250;
          const cy = 400;
          const x = cx + RADIUS_X * Math.cos(angleRad);
          const y = cy + RADIUS_Y * Math.sin(angleRad);

          const isSelected = dist === 0;
          const { blur, opacity, scale } = getBlurAndOpacity(dist);

          return (
            <div
              key={mStr}
              onClick={(e) => {
                e.stopPropagation();
                if (opacity > 0) {
                  handleSelectMonthByIndex(idx);
                }
              }}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity: opacity,
                filter: blur > 0 ? `blur(${blur}px)` : 'none',
                WebkitFilter: blur > 0 ? `blur(${blur}px)` : 'none',
                willChange: 'transform, left, top, opacity, filter',
                pointerEvents: opacity > 0 ? 'auto' : 'none',
              }}
              className="group absolute z-10 transition-all duration-650 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer origin-center px-8 py-4 flex items-center justify-center"
            >
              {isSelected ? (
                // Current Date: Themed green colour, bold font weight, 0.5 blur backing, Space Grotesk year
                <div className="relative text-green-800 font-bold text-sm tracking-tight whitespace-nowrap select-none transition-all duration-500">
                  {/* Subtle 0.49 blur behind current date */}
                  <span className="absolute inset-0 -inset-x-2 -inset-y-0.5 backdrop-blur-[0.49px] pointer-events-none -z-10 rounded-full" />
                  {renderMonthLabel(mStr)}
                </div>
              ) : (
                // Inactive Dates: Turns dark on hover (group-hover:text-gray-950), font-light, Space Grotesk year
                <div className="text-gray-500 group-hover:text-gray-950 font-light text-xs whitespace-nowrap select-none transition-colors duration-300">
                  {renderMonthLabel(mStr)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
