import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Deposit, Withdrawal } from '../../types'

function tokensToG(tokens: number) { return (tokens * 0.1).toFixed(1) }

const METAL_DOT: Record<string, string> = {
  gold: 'bg-amber-400',
  silver: 'bg-slate-400',
  platinum: 'bg-blue-300',
}

export function ReportsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [tab, setTab] = useState<'deposits' | 'withdrawals'>('deposits')

  useEffect(() => {
    api.get<Deposit[]>('/deposits').then(r => setDeposits(r.data))
    api.get<Withdrawal[]>('/withdrawals').then(r => setWithdrawals(r.data))
  }, [])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">All transactions across the system</p>
      </div>

      <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1 w-fit">
        {(['deposits', 'withdrawals'] as const).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t} {t === 'deposits' ? `(${deposits.length})` : `(${withdrawals.length})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        {tab === 'deposits' && (
          <div className="table-scroll">
            <table className="w-full text-sm min-w-[520px]">
              <thead style={{ backgroundColor: 'var(--bm-navy)' }}>
                <tr>
                  {['Deposit #', 'Account', 'Vault', 'Metal', 'Type', 'Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {deposits.map(d => (
                  <tr key={d.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-mono text-xs text-stone-400">{d.deposit_number}</td>
                    <td className="px-4 py-3 text-slate-700">{d.account_id}</td>
                    <td className="px-4 py-3 text-slate-700">{d.vault_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${METAL_DOT[d.metal] ?? 'bg-stone-300'}`} />
                        <span className="capitalize text-slate-700">{d.metal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{d.storage_type}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {d.storage_type === 'unallocated'
                        ? `${tokensToG(d.token_amount ?? 0)} g`
                        : `${d.bars?.length ?? 0} bar(s)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deposits.length === 0 && <p className="text-center py-10 text-stone-400 text-sm">No deposits</p>}
          </div>
        )}

        {tab === 'withdrawals' && (
          <div className="table-scroll">
            <table className="w-full text-sm min-w-[460px]">
              <thead style={{ backgroundColor: 'var(--bm-navy)' }}>
                <tr>
                  {['ID', 'Account', 'Metal', 'Type', 'Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-400 text-xs">{w.id}</td>
                    <td className="px-4 py-3 text-slate-700">{w.account_id}</td>
                    <td className="px-4 py-3">
                      {w.metal
                        ? <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${METAL_DOT[w.metal] ?? 'bg-stone-300'}`} />
                            <span className="capitalize text-slate-700">{w.metal}</span>
                          </div>
                        : <span className="text-stone-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{w.storage_type}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {w.storage_type === 'unallocated' && w.token_amount
                        ? `${tokensToG(w.token_amount)} g`
                        : 'allocated bars'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {withdrawals.length === 0 && <p className="text-center py-10 text-stone-400 text-sm">No withdrawals</p>}
          </div>
        )}
      </div>
    </div>
  )
}
