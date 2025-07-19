
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<{
    label: string;
    value: number;
  }>;
}

interface ChartsContextType {
  charts: ChartData[];
  fileName: string | null;
  setCharts: (charts: ChartData[]) => void;
  setFileName: (fileName: string | null) => void;
  clearCharts: () => void;
}

const ChartsContext = createContext<ChartsContextType | undefined>(undefined);

export const useCharts = () => {
  const context = useContext(ChartsContext);
  if (!context) {
    throw new Error('useCharts must be used within a ChartsProvider');
  }
  return context;
};

interface ChartsProviderProps {
  children: ReactNode;
}

export const ChartsProvider = ({ children }: ChartsProviderProps) => {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const clearCharts = () => {
    setCharts([]);
    setFileName(null);
  };

  return (
    <ChartsContext.Provider
      value={{
        charts,
        fileName,
        setCharts,
        setFileName,
        clearCharts,
      }}
    >
      {children}
    </ChartsContext.Provider>
  );
};
