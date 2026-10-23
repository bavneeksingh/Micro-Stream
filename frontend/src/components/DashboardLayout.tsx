import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';

const ROUTE_TITLES: Record<string, string> = {
  '/worker': 'Worker Dashboard',
  '/earnings': 'Earnings & Payout History',
  '/loans/apply': 'Apply for Micro-Credit',
  '/loans': 'Loan Details & Velocity',
  '/repayments': 'Repayment Stream Activity',
  '/mandates': 'AutoPay Mandate Management',
  '/lender': 'Lender Portfolio Dashboard',
  '/risk': 'Worker Cash-Flow Risk Underwriting',
  '/simulator': 'Payout & Payment Simulator',
  '/consent': 'Data Consent & Blockchain Audit Ledger',
  '/settings': 'System Settings & Profile',
};

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Deep Navy Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          pageTitle={currentTitle}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Minimal Fintech Footer */}
        <footer className="h-12 border-t border-slate-200/80 bg-white/50 px-6 flex items-center justify-between text-[11px] text-slate-500">
          <div>
            <span className="font-bold text-slate-700">MicroStream</span> — Real-Time Micro-Credit Streaming
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span>Drunix Lite Peer / Fabric Endorsed</span>
            <span>•</span>
            <span className="text-teal-700 font-bold">Integer Paise Precision</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">Prototype Mock Mode</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
