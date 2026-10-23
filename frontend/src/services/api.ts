const API_BASE = '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('microstream_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('microstream_token', token);
  } else {
    localStorage.removeItem('microstream_token');
  }
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMsg = errorJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // System Health
  getHealth: () => fetchJson<any>('/health'),

  // Auth
  login: async (email: string, password: string = 'Password123!') => {
    const res = await fetchJson<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },
  logout: async () => {
    try {
      await fetchJson('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },
  getAuthMe: () => fetchJson<{ user: any; worker?: any }>('/auth/me'),

  // Worker Self Records
  getWorkerMe: () => fetchJson<{ worker: any; activeLoan: any; activeMandate: any; earningsSummary: any }>('/workers/me'),
  getWorkerEarningsMe: (query?: { page?: number; limit?: number; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (query?.page) q.set('page', query.page.toString());
    if (query?.limit) q.set('limit', query.limit.toString());
    if (query?.startDate) q.set('startDate', query.startDate);
    if (query?.endDate) q.set('endDate', query.endDate);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ data: any[]; pagination: any }>(`/workers/me/earnings${qs}`);
  },
  getWorkerLoansMe: (status?: string) =>
    fetchJson<{ loans: any[]; total: number }>(`/workers/me/loans${status ? `?status=${status}` : ''}`),
  getWorkerRepaymentsMe: (query?: { page?: number; limit?: number; loanId?: string }) => {
    const q = new URLSearchParams();
    if (query?.page) q.set('page', query.page.toString());
    if (query?.limit) q.set('limit', query.limit.toString());
    if (query?.loanId) q.set('loanId', query.loanId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ data: any[]; pagination: any }>(`/workers/me/repayments${qs}`);
  },

  // Directory & Public Worker Profiles
  getWorkers: () => fetchJson<{ workers: any[]; total: number }>('/workers'),
  getWorker: (did: string) => fetchJson<any>(`/workers/${encodeURIComponent(did)}`),

  // Micro-Loans
  applyLoan: (payload: {
    amountRupees?: number;
    amountPaise?: number;
    deductionRatePct?: number;
    deductionRateBps?: number;
    dailyCapRupees?: number;
    dailyCapPaise?: number;
    purpose: string;
    lenderName?: string;
  }) =>
    fetchJson<any>('/loans/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveLoan: (loanId: string) =>
    fetchJson<any>(`/loans/${loanId}/approve`, {
      method: 'POST',
    }),
  getLoans: (params?: { workerId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.workerId) q.set('workerId', params.workerId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ loans: any[]; total: number }>(`/loans${qs}`);
  },
  getLoan: (loanId: string) => fetchJson<any>(`/loans/${loanId}`),

  // Consents
  getConsents: (workerId?: string) =>
    fetchJson<{ consents: any[]; total: number }>(`/consents${workerId ? `?workerId=${workerId}` : ''}`),
  grantConsent: (payload: { grantee: string; scope: string[] | string; purpose: string; expiresAt?: string }) =>
    fetchJson<any>('/consents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeConsent: (consentId: string) =>
    fetchJson<any>(`/consents/${consentId}`, {
      method: 'DELETE',
    }),

  // Lender & Portfolio
  getLenderPortfolio: () => fetchJson<any>('/lender/portfolio'),
  getLenderWorkerRisk: (workerId: string, windowDays: number = 30) =>
    fetchJson<any>(`/lender/workers/${encodeURIComponent(workerId)}/risk?window=${windowDays}`),
  getLenderWorkers: (params?: { search?: string; platform?: string; tier?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.platform) q.set('platform', params.platform);
    if (params?.tier) q.set('tier', params.tier);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ workers: any[]; total: number }>(`/lender/workers${qs}`);
  },
  getWorkerCashFlowAnalytics: (workerId: string, windowDays: number = 30) =>
    fetchJson<any>(`/analytics/workers/${encodeURIComponent(workerId)}/cashflow?window=${windowDays}`),
  getWorkerRiskAssessment: (workerId: string, windowDays: number = 30) =>
    fetchJson<any>(`/analytics/workers/${encodeURIComponent(workerId)}/risk-assessment?window=${windowDays}`),

  // Payouts & Simulator
  getPayouts: (params?: { workerId?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.workerId) q.set('workerId', params.workerId);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', params.limit.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ payouts: any[]; total: number }>(`/payouts${qs}`);
  },
  simulatePayout: (payload: {
    workerId?: string;
    did?: string;
    platformId: string;
    amountPaise?: number;
    amountRupees?: number;
    reference?: string;
    failureType?: 'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED' | 'NETWORK_ERROR';
  }) =>
    fetchJson<any>('/simulator/payouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Audit Logs
  getAuditLogs: (params?: { userId?: string; action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.userId) q.set('userId', params.userId);
    if (params?.action) q.set('action', params.action);
    if (params?.limit) q.set('limit', params.limit.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ events: any[]; total: number }>(`/audit${qs}`);
  },

  // Deterministic Repayment Engine & Transaction History
  getTransactionHistory: (params?: { workerId?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.workerId) q.set('workerId', params.workerId);
    if (params?.limit) q.set('limit', params.limit.toString());
    if (params?.offset) q.set('offset', params.offset.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<{ transactions: any[]; total: number }>(`/transactions/history${qs}`);
  },

  getEngineConfig: () =>
    fetchJson<{
      defaultRepaymentRateBps: number;
      defaultDailyCapPaise: number;
      minimumDeductionThresholdPaise: number;
      maxRetries: number;
    }>('/engine/config'),

  updateEngineConfig: (config: {
    repaymentRateBasisPoints?: number;
    dailyCapPaise?: number;
    minimumDeductionThresholdPaise?: number;
    retryLimit?: number;
  }) =>
    fetchJson<any>('/engine/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  retryDebitInstruction: (instructionId: string) =>
    fetchJson<any>(`/debits/${instructionId}/retry`, {
      method: 'POST',
    }),

  sendPaymentCallback: (payload: {
    instructionId: string;
    reference: string;
    amountPaise: number;
    success: boolean;
    upiRef?: string;
    failureReason?: string;
  }) =>
    fetchJson<any>('/payments/callback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Mandates
  getMandates: (did?: string) => {
    const q = did ? `?did=${encodeURIComponent(did)}` : '';
    return fetchJson<{ mandates: any[]; total: number }>(`/mandates${q}`);
  },
  createMandate: (payload: {
    did: string;
    vpa: string;
    bankAccountMasked?: string;
    ifscCode?: string;
    maxAmountPaise: number;
    frequency?: string;
    durationMonths?: number;
    autoApprove?: boolean;
  }) =>
    fetchJson<any>('/mandates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveMandate: (mandateId: string) =>
    fetchJson<any>(`/mandates/${mandateId}/approve`, {
      method: 'POST',
    }),
  cancelMandate: (mandateId: string) =>
    fetchJson<any>(`/mandates/${mandateId}/cancel`, {
      method: 'POST',
    }),

  // One-Click Demo
  runOneClickDemo: () =>
    fetchJson<any>('/simulator/one-click-demo', {
      method: 'POST',
    }),

  resetDemoStore: async () => {
    try {
      return await fetchJson<any>('/stream/reset', { method: 'POST' });
    } catch {
      return { success: true };
    }
  },
};
