import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  FilePlus,
  Coins,
  Repeat,
  ShieldCheck,
  Building2,
  UserCheck,
  Activity,
  FileText,
  Settings,
  Globe,
  LogOut,
  X,
  Droplet,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
    onClose();
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
      isActive
        ? 'bg-teal-500/15 text-teal-400 border-l-2 border-teal-400 font-bold'
        : 'text-slate-400 hover:text-slate-100 hover:bg-navy-850'
    }`;

  const navSectionHeader = (title: string) => (
    <div className="px-3.5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {title}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Deep Navy Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-navy-950 text-slate-100 flex flex-col border-r border-navy-850 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-navy-850 bg-navy-950">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm group-hover:bg-teal-500 transition">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">
                Micro<span className="text-teal-400">Stream</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-mono tracking-tighter -mt-0.5">
                Fintech Micro-Credit
              </span>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-850 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          {navSectionHeader('Gig Worker Portal')}
          <NavLink to="/worker" onClick={onClose} className={navLinkClass}>
            <LayoutDashboard className="w-4 h-4 text-teal-400" />
            <span>Worker Dashboard</span>
          </NavLink>
          <NavLink to="/earnings" onClick={onClose} className={navLinkClass}>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Earnings & Payouts</span>
          </NavLink>
          <NavLink to="/loans/apply" onClick={onClose} className={navLinkClass}>
            <FilePlus className="w-4 h-4 text-emerald-400" />
            <span>Apply for Loan</span>
          </NavLink>
          <NavLink to="/loans" onClick={onClose} className={navLinkClass}>
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Loan Details & Terms</span>
          </NavLink>
          <NavLink to="/repayments" onClick={onClose} className={navLinkClass}>
            <Repeat className="w-4 h-4 text-indigo-400" />
            <span>Repayment Activity</span>
          </NavLink>
          <NavLink to="/mandates" onClick={onClose} className={navLinkClass}>
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>AutoPay Mandates</span>
          </NavLink>

          {navSectionHeader('Lender & Risk')}
          <NavLink to="/lender" onClick={onClose} className={navLinkClass}>
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Lender Dashboard</span>
          </NavLink>
          <NavLink to="/risk" onClick={onClose} className={navLinkClass}>
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span>Worker Risk Profiles</span>
          </NavLink>

          {navSectionHeader('Testing & Governance')}
          <NavLink to="/simulator" onClick={onClose} className={navLinkClass}>
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Stream Simulator</span>
          </NavLink>
          <NavLink to="/consent" onClick={onClose} className={navLinkClass}>
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Consent & Audit Log</span>
          </NavLink>
          <NavLink to="/settings" onClick={onClose} className={navLinkClass}>
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </NavLink>

          {navSectionHeader('Public')}
          <NavLink to="/welcome" onClick={onClose} className={navLinkClass}>
            <Globe className="w-4 h-4 text-slate-400" />
            <span>Landing Page</span>
          </NavLink>
        </nav>

        {/* User Session & Logout Footer */}
        <div className="p-3 border-t border-navy-850 bg-navy-900/60">
          <div className="flex items-center justify-between p-2 rounded-lg bg-navy-850 border border-navy-700/40">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-teal-600/30 text-teal-300 border border-teal-500/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {currentUser.avatarText}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Switch demo account / Logout"
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-navy-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
