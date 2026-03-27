import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Portfolio, Deposit, Withdrawal } from '../../types'

const METAL_CONFIG: Record<string, { dot: string }> = {
  gold: { dot: 'bg-amber-400' },
  silver: { dot: 'bg-slate-400' },
  platinum: { dot: 'bg-blue-400' },
}

export function ClientsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<Account | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [tab, setTab] = useState<'holdings' | 'deposits' | 'withdrawals' | 'bars'>('holdings')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.get<Account[]>('/accounts').then(r => setAccounts(r.data.filter(a => a.role === 'client')))
  }, [])

  async function selectClient(a: Account) {
    setSelected(a)
    setTab('holdings')
    setLoading(true)
    setSidebarOpen(false)
    try {
      const [pRes, dRes, wRes] = await Promise.all([
        api.get<Portfolio>(`/portfolio/${a.id}`),
        api.get<Deposit[]>('/deposits'),
        api.get<Withdrawal[]>('/withdrawals'),
      ])
      setPortfolio(pRes.data)
      setDeposits(dRes.data.filter(d => d.account_id === a.id))
      setWithdrawals(wRes.data.filter(w => w.account_id === a.id))
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    'holdings', 'deposits', 'withdrawals',
    ...(selected?.account_type === 'institutional' ? ['bars'] : []),
  ] as const

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Client Portfolios</h1>
        <p className="text-sm text-slate-500">View holdings and transaction history for any client</p>
      </div>

      {/* Mobile: client picker button */}
      <div className="md:hidden mb-3">
        <button onClick={() => setSidebarOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-stone-200 text-sm font-medium text-slate-700 shadow-sm">
          <span>{selected ? selected.name : 'Select a client…'}</span>
          <span className="text-stone-400">{sidebarOpen ? '▲' : '▼'}</span>
        </button>
        {sidebarOpen && (
          <div className="mt-1 bg-white rounded-xl border border-stone-200 overflow-hidden shadow-lg">
            {accounts.map(a => (
              <button key={a.id} onClick={() => selectClient(a)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-stone-100 last:border-0 hover:bg-stone-50 ${selected?.id === a.id ? 'bg-amber-50' : ''}`}>
                <div className="font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-stone-400 capitalize">{a.account_type}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-56 shrink-0">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div style={{ backgroundColor: 'var(--bm-navy)' }} className="px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clients</p>
            </div>
            {accounts.length === 0
              ? <p className="text-sm text-stone-400 p-4">No clients found</p>
              : accounts.map(a => (
                <button key={a.id} onClick={() => selectClient(a)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-stone-100 last:border-0 transition-colors hover:bg-stone-50 ${
                    selected?.id === a.id ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''
                  }`}>
                  <div className="font-medium text-slate-900">{a.name}</div>
                  <div className="text-xs text-stone-400 capitalize">{a.account_type}</div>
                </button>
              ))
            }
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {!selected && (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-sm shadow-sm">
              <p className="text-3xl mb-3">👤</p>
              Select a client to view their portfolio
            </div>
          )}

          {selected && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
              <div style={{ backgroundColor: 'var(--bm-navy)' }} className="px-5 py-4">
                <h2 className="font-bold text-white">{selected.name}</h2>
                <p className="text-xs text-slate-400 capitalize">{selected.account_type} · {selected.email}</p>
              </div>

              <div className="flex gap-0 border-b border-stone-100 overflow-x-auto">
                {tabs.map(t => (
                  <button key={t} onClick={() => setTab(t as any)}
                    className={`px-4 py-3 text-sm capitalize whitespace-nowrap border-b-2 transition-colors ${
                      tab === t
                        ? 'border-amber-500 text-amber-600 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {loading && <p className="text-sm text-stone-400 text-center py-10">Loading…</p>}

              {!loading && portfolio && (
                <div className="p-4">
                  {tab === 'holdings' && (
                    <div className="space-y-2">
                      {portfolio.holdings.length === 0
                        ? <p className="text-sm text-stone-400 text-center py-6">No holdings</p>
                        : portfolio.holdings.map(h => (
                          <div key={h.metal} className="flex items-center justify-between bg-stone-50 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${METAL_CONFIG[h.metal]?.dot ?? 'bg-stone-400'}`} />
                              <span className="font-medium capitalize text-slate-900">{h.metal}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">
                                {h.weight_kg != null
                                  ? `${h.weight_kg.toFixed(4)} kg`
                                  : `${((h.total_weight_g ?? 0) / 1000).toFixed(4)} kg`}
                              </div>
                              {h.value_usd != null && (
                                <div className="text-xs text-stone-400">${h.value_usd.toFixed(2)}</div>
                              )}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {tab === 'deposits' && (
                    <div className="table-scroll">
                      <table className="w-full text-sm min-w-[380px]">
                        <thead><tr className="text-left text-xs text-stone-400 uppercase">
                          {['#', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-stone-50">
                          {deposits.length === 0
                            ? <tr><td colSpan={4} className="text-center py-6 text-stone-400 text-xs">No deposits</td></tr>
                            : deposits.map(d => (
                              <tr key={d.id}>
                                <td className="py-2 pr-4 font-mono text-xs text-stone-400">{d.deposit_number}</td>
                                <td className="py-2 pr-4 capitalize text-slate-700">{d.metal}</td>
                                <td className="py-2 pr-4 capitalize text-slate-600">{d.storage_type}</td>
                                <td className="py-2 text-slate-700">
                                  {d.token_amount ? `${(d.token_amount * 0.1).toFixed(1)}g` : `${d.bars?.length} bars`}
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tab === 'withdrawals' && (
                    <div className="table-scroll">
                      <table className="w-full text-sm min-w-[360px]">
                        <thead><tr className="text-left text-xs text-stone-400 uppercase">
                          {['ID', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-stone-50">
                          {withdrawals.length === 0
                            ? <tr><td colSpan={4} className="text-center py-6 text-stone-400 text-xs">No withdrawals</td></tr>
                            : withdrawals.map(w => (
                              <tr key={w.id}>
                                <td className="py-2 pr-4 text-stone-400">{w.id}</td>
                                <td className="py-2 pr-4 capitalize text-slate-700">{w.metal ?? '—'}</td>
                                <td className="py-2 pr-4 capitalize text-slate-600">{w.storage_type}</td>
                                <td className="py-2 text-slate-700">
                                  {w.token_amount ? `${(w.token_amount * 0.1).toFixed(1)}g` : 'bars'}
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tab === 'bars' && (
                    <div className="divide-y divide-stone-50">
                      {portfolio.holdings.flatMap(h => (h.bars ?? []).map(b => (
                        <div key={b.id} className="flex justify-between py-2.5 text-sm">
                          <span className="font-mono text-slate-700">{b.serial_number}</span>
                          <span className="text-stone-400">{b.weight_g}g</span>
                        </div>
                      )))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
