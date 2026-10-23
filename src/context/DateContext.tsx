import React, { createContext, useContext, useState } from 'react';

interface DateContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const DateContext = createContext<DateContextType>({
  selectedMonth: '2026-09',
  setSelectedMonth: () => {},
});

export const DateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <DateContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </DateContext.Provider>
  );
};

export const useDate = () => useContext(DateContext);
