import React, { useState } from 'react';
import { Menu, Zap, ShieldAlert, Sparkles, Check, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { SimulatePayoutModal } from './SimulatePayoutModal.js';

interface HeaderProps {
  onToggleSidebar: () => void;
  pageTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, pageTitle = 'Dashboard' }) => {
  const { workers, activeWorker, setActiveWorkerDid } = useApp();
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showWorkerMenu, setShowWorkerMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-subtle">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight hidden sm:block">
              {pageTitle}
            </h1>
            <div className="text-[11px] text-slate-500 font-medium hidden md:block">
              Income-Linked Real-Time Micro-Credit
            </div>
          </div>
        </div>

        {/* Right: Worker Selector, Mock Indicator, Simulate Action */}
        <div className="flex items-center gap-3">
          {/* Active Worker Selector */}
          <div className="relative">
            <button
              onClick={() => setShowWorkerMenu(!showWorkerMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 transition shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="truncate max-w-[120px] sm:max-w-none">
                {activeWorker?.name || 'Worker'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                ({activeWorker?.primaryPlatform})
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showWorkerMenu && (
              <div
                className="absolute right-0 mt-1 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 animate-fadeIn"
                onMouseLeave={() => setShowWorkerMenu(false)}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Switch Active Gig Worker
                </div>
                {workers.map((w) => (
                  <button
                    key={w.did}
                    onClick={() => {
                      setActiveWorkerDid(w.did);
                      setShowWorkerMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                      activeWorker?.did === w.did ? 'bg-teal-50/70 text-teal-800 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div>{w.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {w.primaryPlatform} • {w.creditTier}
                      </div>
                    </div>
                    {activeWorker?.did === w.did && <Check className="w-4 h-4 text-teal-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mock Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>MOCK MODE</span>
          </div>

          {/* Quick Payout Simulation Action */}
          <button
            onClick={() => setShowSimulateModal(true)}
            id="btn-global-simulate"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Simulate Payout</span>
            <span className="sm:hidden">Stream</span>
          </button>
        </div>
      </header>

      {/* Reusable Simulation Modal */}
      {showSimulateModal && (
        <SimulatePayoutModal onClose={() => setShowSimulateModal(false)} />
      )}
    </>
  );
};
