const API_BASE = '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
  getHealth: () => fetchJson<any>('/health'),
  getWorkers: () => fetchJson<{ workers: any[]; total: number }>('/workers'),
  getWorker: (did: string) => fetchJson<any>(`/workers/${encodeURIComponent(did)}`),
  getWorkerEarnings: (did: string) => fetchJson<any>(`/workers/${encodeURIComponent(did)}/earnings`),
  getLoans: () => fetchJson<{ loans: any[]; total: number }>('/loans'),
  getLoan: (loanId: string) => fetchJson<any>(`/loans/${loanId}`),
  simulatePayout: (payload: { did: string; platformId: string; amountPaise: number; reference?: string }) =>
    fetchJson<any>('/payouts/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getPayouts: () => fetchJson<{ payouts: any[]; total: number }>('/payouts'),
  getRepayments: (loanId?: string) => fetchJson<any>(`/stream/repayments${loanId ? `?loanId=${loanId}` : ''}`),
  getPortfolio: () => fetchJson<any>('/analytics/portfolio'),
  getRiskProfiles: () => fetchJson<{ profiles: any[]; count: number }>('/analytics/risk'),
  resetDemoStore: () =>
    fetchJson<any>('/stream/reset', {
      method: 'POST',
    }),
};
