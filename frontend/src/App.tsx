import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { WorkerDashboard } from './pages/WorkerDashboard.js';
import { EarningsHistoryPage } from './pages/EarningsHistoryPage.js';
import { LoanApplicationPage } from './pages/LoanApplicationPage.js';
import { LoanDetailsPage } from './pages/LoanDetailsPage.js';
import { RepaymentsActivityPage } from './pages/RepaymentsActivityPage.js';
import { MandateManagementPage } from './pages/MandateManagementPage.js';
import { LenderDashboard } from './pages/LenderDashboard.js';
import { WorkerRiskProfilePage } from './pages/WorkerRiskProfilePage.js';
import { SimulatorPage } from './pages/SimulatorPage.js';
import { ConsentAuditPage } from './pages/ConsentAuditPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Pages */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Dashboard Pages wrapped in Deep Navy Sidebar Layout */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<WorkerDashboard />} />
            <Route path="/worker" element={<WorkerDashboard />} />
            <Route path="/earnings" element={<EarningsHistoryPage />} />
            <Route path="/loans/apply" element={<LoanApplicationPage />} />
            <Route path="/loans" element={<LoanDetailsPage />} />
            <Route path="/repayments" element={<RepaymentsActivityPage />} />
            <Route path="/mandates" element={<MandateManagementPage />} />
            <Route path="/lender" element={<LenderDashboard />} />
            <Route path="/risk" element={<WorkerRiskProfilePage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/consent" element={<ConsentAuditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
