import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'settings' | 'wallets' | 'analysis' | 'dune-debug';
  onPageChange: (page: 'settings' | 'wallets' | 'analysis' | 'dune-debug') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onPageChange }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Meme Coin Tracker
              </h1>
            </div>
            <div className="flex space-x-8">
              <button
                onClick={() => onPageChange('settings')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'settings'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                設定
              </button>
              <button
                onClick={() => onPageChange('wallets')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'wallets'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                有望アドレス
              </button>
              <button
                onClick={() => onPageChange('analysis')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'analysis'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                分析
              </button>
              <button
                onClick={() => onPageChange('dune-debug')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'dune-debug'
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Dune デバッグ
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
};