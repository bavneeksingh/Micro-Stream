import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, User, Building2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext.js';

export const LoginPage: React.FC = () => {
  const { setCurrentUser, setActiveWorkerDid } = useApp();
  const navigate = useNavigate();

  const handleSelectAccount = (
    user: { id: string; name: string; role: 'WORKER' | 'LENDER' | 'AUDITOR'; did?: string; email: string; lenderId?: string },
    targetPath: string
  ) => {
    setCurrentUser({
      ...user,
      avatarText: user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    });

    if (user.did) {
      setActiveWorkerDid(user.did);
    }

    navigate(targetPath);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white mx-auto shadow-md">
            <Droplet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            MicroStream Demo Environment
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select a simulated role below to explore the real-time micro-credit streaming workflows.
          </p>
        </div>

        {/* Worker Profiles Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <User className="w-4 h-4 text-teal-600" />
            <span>Gig Worker Demo Profiles (Borrower View)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Ravi Kumar */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_ravi_01',
                    name: 'Ravi Kumar',
                    role: 'WORKER',
                    did: 'did:drunix:worker:ravi-kumar-01',
                    email: 'ravi.kumar@zomato-partner.in',
                  },
                  '/worker'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-teal-700">
                  Ravi Kumar
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  PRIME A
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Zomato Delivery Partner • Bangalore
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                <span>Active Loan: ₹8,755 remaining</span>
                <span className="text-teal-600 font-bold">5% stream</span>
              </div>
            </button>

            {/* Sunita Devi */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_sunita_02',
                    name: 'Sunita Devi',
                    role: 'WORKER',
                    did: 'did:drunix:worker:sunita-devi-02',
                    email: 'sunita.devi@swiggy-partner.in',
                  },
                  '/worker'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-teal-700">
                  Sunita Devi
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  STANDARD B
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Swiggy Delivery Partner • Delhi NCR
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                <span>Active Loan: ₹13,620 remaining</span>
                <span className="text-teal-600 font-bold">6% stream</span>
              </div>
            </button>

            {/* Mohammed Arif */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_arif_03',
                    name: 'Mohammed Arif',
                    role: 'WORKER',
                    did: 'did:drunix:worker:arif-uber-03',
                    email: 'arif.cab@uber-driver.in',
                  },
                  '/worker'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-teal-700">
                  Mohammed Arif
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  PRIME A
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Uber Rideshare Driver • Mumbai
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                <span>Active Loan: ₹22,800 remaining</span>
                <span className="text-teal-600 font-bold">5% stream</span>
              </div>
            </button>

            {/* Priya Sharma */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_priya_04',
                    name: 'Priya Sharma',
                    role: 'WORKER',
                    did: 'did:drunix:worker:priya-uc-04',
                    email: 'priya.salon@urbancompany.in',
                  },
                  '/worker'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-teal-700">
                  Priya Sharma
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  STANDARD B
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Urban Company Professional • Hyderabad
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                <span>Eligible for ₹20,000 credit</span>
                <span className="text-emerald-600 font-bold">Apply</span>
              </div>
            </button>

            {/* Vikram Singh */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_vikram_05',
                    name: 'Vikram Singh',
                    role: 'WORKER',
                    did: 'did:drunix:worker:vikram-zepto-05',
                    email: 'vikram.rider@zepto-rider.in',
                  },
                  '/worker'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-teal-700">
                  Vikram Singh
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  EMERGING C
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Zepto Quick Commerce Rider • Pune
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                <span>Eligible for ₹8,000 credit</span>
                <span className="text-emerald-600 font-bold">Apply</span>
              </div>
            </button>
          </div>
        </div>

        {/* Institutional & Lender Roles */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Institutional Lender & Auditor Profiles</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Kotak Microfinance */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_kotak_underwriter',
                    name: 'Kotak Microfinance Underwriter',
                    role: 'LENDER',
                    lenderId: 'lender-kotak-micro',
                    email: 'underwriting@kotakmicro.in',
                  },
                  '/lender'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700">
                  Kotak Microfinance
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  LENDER
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Portfolio risk monitoring, YugabyteDB SQL queries, and loan issuance.
              </div>
              <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 pt-1">
                <span>Open Portfolio Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Compliance Auditor */}
            <button
              onClick={() =>
                handleSelectAccount(
                  {
                    id: 'usr_auditor',
                    name: 'NPCI / RBI Compliance Auditor',
                    role: 'AUDITOR',
                    email: 'auditor@npci.org.in',
                  },
                  '/consent'
                )
              }
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-500 hover:shadow-card-hover transition-all text-left space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 group-hover:text-purple-700">
                  Compliance & Regulatory Auditor
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  AUDITOR
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Inspect immutable on-chain consent records, data scopes, and audit trail.
              </div>
              <div className="text-[11px] font-bold text-purple-600 flex items-center gap-1 pt-1">
                <span>Open Audit Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
