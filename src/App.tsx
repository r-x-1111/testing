import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/views/Dashboard';
import { SendFlow } from '@/views/SendFlow';
import { Recipients } from '@/views/Recipients';
import { History } from '@/views/History';
import { Settings } from '@/views/Settings';
import { VeriPlan } from '@/views/VeriPlan';
import { LanguageProvider } from '@/lib/LanguageContext';
import type { Page } from '@/lib/types';

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sendKey, setSendKey] = useState(0);

  function navigate(p: Page) {
    if (p === 'send') setSendKey((k) => k + 1);
    setPage(p);
  }

  return (
    <LanguageProvider>
      <div className="flex min-h-screen">
        <Sidebar current={page} onNavigate={navigate} />
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {page === 'dashboard' && <Dashboard onNavigate={(p) => navigate(p)} />}
            {page === 'send' && <SendFlow key={sendKey} onComplete={() => navigate('dashboard')} />}
            {page === 'recipients' && <Recipients />}
            {page === 'history' && <History />}
            {page === 'settings' && <Settings />}
            {page === 'veriplan' && <VeriPlan />}
          </div>
        </main>
      </div>
    </LanguageProvider>
  );
}

export default App;
