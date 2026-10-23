import React from 'react';
import { FileQuestion, Home } from 'lucide-react';

export const NotFoundPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="card-base p-8 max-w-md w-full text-center space-y-4 rounded-3xl border border-[#edf2ee] bg-white">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-700 flex items-center justify-center mx-auto border border-gray-200">
          <FileQuestion className="w-6 h-6 text-gray-500" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">404 - Page Not Found</h2>
          <p className="text-xs text-gray-500 font-light">
            The view or financial record you are trying to access does not exist or has been moved.
          </p>
        </div>
        <button
          onClick={onNavigateHome}
          className="btn-primary mx-auto text-xs"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
