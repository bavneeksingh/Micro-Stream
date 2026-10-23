import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar.js';
import { WorkerDashboard } from './pages/WorkerDashboard.js';
import { LenderDashboard } from './pages/LenderDashboard.js';
import { SimulatorPage } from './pages/SimulatorPage.js';
import { ArchitecturePage } from './pages/ArchitecturePage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-dark text-slate-100 flex flex-col font-sans">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<WorkerDashboard />} />
            <Route path="/lender" element={<LenderDashboard />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="glass-panel border-t border-white/5 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-300">MicroStream</span> — Real-Time Micro-Credit Streaming for Gig Workers
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Powered by NPCI Drunix & UPI AutoPay</span>
              <span>•</span>
              <span className="text-cyan-400">Strict Integer Paise Math</span>
              <span>•</span>
              <span className="text-amber-400">Mock Integrations</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
