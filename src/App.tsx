import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SimpleSettingsPage } from './components/SimpleSettingsPage';
import { DuneDebugPage } from './components/DuneDebugPage';
import { PromisingAddressesPage } from './components/PromisingAddressesPage';

type Page = 'settings' | 'wallets' | 'analysis' | 'dune-debug';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('settings');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'settings':
        return <SimpleSettingsPage />;
      case 'wallets':
        return <PromisingAddressesPage />;
      case 'analysis':
        return <div className="text-center py-12">分析画面（実装予定）</div>;
      case 'dune-debug':
        return <DuneDebugPage />;
      default:
        return <SimpleSettingsPage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
}

export default App;
