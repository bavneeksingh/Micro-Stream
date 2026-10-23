import React from 'react';
import {
  Settings,
  User,
  RotateCcw,
  ShieldCheck,
  Server,
  Coins,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';

export const SettingsPage: React.FC = () => {
  const { currentUser, activeWorker, resetAllData, isBackendConnected } = useApp();

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all simulated demo data back to the default synthetic seed state?')) {
      resetAllData();
      alert('Demo state reset successfully.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          System Settings & Simulation Environment
        </h2>
        <p className="text-xs text-slate-500">
          Manage your session, connected endpoints, and prototype demo parameters.
        </p>
      </div>

      {/* User Session Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4 text-teal-600" />
          <span>Active Session Details</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Session Name</span>
            <span className="font-bold text-slate-900 text-sm">{currentUser.name}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Role Authorization</span>
            <span className="font-bold text-teal-700 text-sm">{currentUser.role}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Decentralized Identifier (DID)</span>
            <span className="font-mono text-[11px] text-slate-700 break-all">{activeWorker?.did || 'N/A'}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Default UPI VPA</span>
            <span className="font-mono text-[11px] text-slate-700">{activeWorker?.vpa || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Integration Environment Status */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-600" />
          <span>Adapter & Network Configuration</span>
        </h3>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="flex justify-between py-3">
            <div>
              <div className="font-bold text-slate-800">Backend API Gateway</div>
              <div className="text-[11px] text-slate-500">http://localhost:4000/api</div>
            </div>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={isBackendConnected ? 'text-emerald-700' : 'text-slate-500'}>
                {isBackendConnected ? 'Connected & Healthy' : 'In-Memory Offline Fallback'}
              </span>
            </div>
          </div>

          <div className="flex justify-between py-3">
            <div>
              <div className="font-bold text-slate-800">Currency Precision</div>
              <div className="text-[11px] text-slate-500">Zero floating-point rounding errors</div>
            </div>
            <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Strict Integer Paise (1 INR = 100 paise)
            </span>
          </div>

          <div className="flex justify-between py-3">
            <div>
              <div className="font-bold text-slate-800">UPI AutoPay Adapter Mode</div>
              <div className="text-[11px] text-slate-500">Safety isolation boundary</div>
            </div>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Simulated MOCK (No Real Bank Debits)
            </span>
          </div>

          <div className="flex justify-between py-3">
            <div>
              <div className="font-bold text-slate-800">Blockchain State DB</div>
              <div className="text-[11px] text-slate-500">Permissioned state queries</div>
            </div>
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              YugabyteDB / PostgreSQL Distributed SQL
            </span>
          </div>
        </div>
      </div>

      {/* Demo State Reset Box */}
      <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-900">
              Reset Prototype Demo Data
            </h3>
            <p className="text-xs text-slate-500 max-w-md">
              Clears localStorage and resets all 5 worker loans, earnings records, and AutoPay mandates to their pristine synthetic seed state.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo State</span>
          </button>
        </div>
      </div>
    </div>
  );
};
