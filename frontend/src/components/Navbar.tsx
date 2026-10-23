import React from 'react';
import { NavLink } from 'react-router-dom';
import { Droplet, Users, ShieldAlert, Cpu, Activity, RotateCcw } from 'lucide-react';
import { api } from '../services/api.js';

interface NavbarProps {
  onReset?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onReset }) => {
  const [resetting, setResetting] = React.useState(false);

  const handleReset = async () => {
    if (!confirm('Reset local demo dataset back to initial state?')) return;
    setResetting(true);
    try {
      await api.resetDemoStore();
      if (onReset) onReset();
      window.location.reload();
    } catch (err) {
      alert('Failed to reset store');
    } finally {
      setResetting(false);
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
    }`;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 bg-surface-dark/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Droplet className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Micro<span className="text-cyan-400">Stream</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                Prototype Mocks
              </span>
            </div>
            <div className="text-[11px] text-slate-400 hidden sm:block">
              Real-Time Micro-Credit Streaming for Gig Workers
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/" className={navItemClass} id="nav-worker-portal">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Worker Portal</span>
          </NavLink>
          <NavLink to="/lender" className={navItemClass} id="nav-lender-portal">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Lender Risk Center</span>
          </NavLink>
          <NavLink to="/simulator" className={navItemClass} id="nav-stream-simulator">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="hidden md:inline">Stream Simulator</span>
          </NavLink>
          <NavLink to="/architecture" className={navItemClass} id="nav-architecture-docs">
            <Cpu className="w-4 h-4 text-brand-400" />
            <span className="hidden md:inline">Architecture</span>
          </NavLink>
        </nav>

        {/* Environment Badge & Reset */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Drunix Fabric (Mock)
            </span>
            <span className="text-slate-400">UPI AutoPay (Simulated)</span>
          </div>

          <button
            id="btn-reset-demo"
            onClick={handleReset}
            disabled={resetting}
            title="Reset store to synthetic demo data"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset Data</span>
          </button>
        </div>
      </div>
    </header>
  );
};
