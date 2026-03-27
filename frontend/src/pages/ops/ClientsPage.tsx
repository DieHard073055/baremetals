import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Account, Portfolio, Deposit, Withdrawal } from '../../types'

const METAL_ICON: Record<string, string> = { gold: '🥇', silver: '🥈', platinum: '⬜' }

export function ClientsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState<Account | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [tab, setTab] = useState<'holdings' | 'deposits' | 'withdrawals' | 'bars'>('holdings')

  useEffect(() => {
    api.get<Account[]>('/accounts').then(r => setAccounts(r.data.filter(a => a.role === 'client')))
  }, [])

  async function selectClient(a: Account) {
    setSelected(a)
    setPortfolio(null)
    setDeposits([])
    setWithdrawals([])
    setTab('holdings')
    const [pRes, dRes, wRes] = await Promise.all([
      api.get<Portfolio>(`/portfolio/${a.id}`),
      api.get<Deposit[]>('/deposits'),
      api.get<Withdrawal[]>('/withdrawals'),
    ])
    setPortfolio(pRes.data)
    setDeposits(dRes.data.filter(d => d.account_id === a.id))
    setWithdrawals(wRes.data.filter(w => w.account_id === a.id))
  }

  const tabs = ['holdings', 'deposits', 'withdrawals', ...(selected?.account_type === 'institutional' ? ['bars'] : [])] as const

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Client Portfolios</h1>

      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {accounts.length === 0
              ? <p className="text-sm text-gray-400 p-4">No clients found</p>
              : accounts.map(a => (
                <button key={a.id}
                  onClick={() => selectClient(a)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${selected?.id === a.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="font-medium text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{a.account_type}</div>
                </button>
              ))
            }
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1">
          {!selected && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Select a client to view their portfolio
            </div>
          )}

          {selected && portfolio && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-400 capitalize">{selected.account_type} · {selected.email}</p>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pt-3">
                {tabs.map(t => (
                  <button key={t}
                    onClick={() => setTab(t as any)}
                    className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                      tab === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === 'holdings' && (
                  <div className="space-y-3">
                    {portfolio.holdings.length === 0
                      ? <p className="text-sm text-gray-400">No holdings</p>
                      : portfolio.holdings.map(h => (
                        <div key={h.metal} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <span className="font-medium capitalize text-gray-900">
                            {METAL_ICON[h.metal]} {h.metal}
                          </span>
                          <div className="text-right text-sm">
                            <div className="text-gray-900">
                              {h.weight_kg != null ? `${h.weight_kg} kg` : `${(h.total_weight_g ?? 0) / 1000} kg`}
                            </div>
                            {h.value_usd != null && (
                              <div className="text-gray-500 text-xs">
                                ${h.value_usd.toFixed(2)} USD
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {tab === 'deposits' && (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-500">
                      {['#', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {deposits.map(d => (
                        <tr key={d.id}>
                          <td className="py-2 pr-4 text-gray-400">{d.deposit_number}</td>
                          <td className="py-2 pr-4 capitalize">{d.metal}</td>
                          <td className="py-2 pr-4 capitalize">{d.storage_type}</td>
                          <td className="py-2">{d.token_amount ? `${(d.token_amount * 0.1).toFixed(1)}g` : `${d.bars?.length} bars`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'withdrawals' && (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-500">
                      {['ID', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {withdrawals.map(w => (
                        <tr key={w.id}>
                          <td className="py-2 pr-4 text-gray-400">{w.id}</td>
                          <td className="py-2 pr-4 capitalize">{w.metal ?? '—'}</td>
                          <td className="py-2 pr-4 capitalize">{w.storage_type}</td>
                          <td className="py-2">{w.token_amount ? `${(w.token_amount * 0.1).toFixed(1)}g` : 'allocated'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === 'bars' && (
                  <div className="space-y-1">
                    {portfolio.holdings.flatMap(h => (h.bars ?? []).map(b => (
                      <div key={b.id} className="flex justify-between text-sm py-2 border-b border-gray-50">
                        <span className="font-mono text-gray-700">{b.serial_number}</span>
                        <span className="text-gray-500">{b.weight_g}g</span>
                      </div>
                    )))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
