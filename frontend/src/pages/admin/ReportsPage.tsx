import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Deposit, Withdrawal } from '../../types'

function tokensToG(tokens: number) { return (tokens * 0.1).toFixed(1) }

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
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Reports</h1>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['deposits', 'withdrawals'] as const).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'deposits' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Account', 'Vault', 'Metal', 'Type', 'Amount'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deposits.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{d.deposit_number}</td>
                  <td className="px-4 py-3">{d.account_id}</td>
                  <td className="px-4 py-3">{d.vault_id}</td>
                  <td className="px-4 py-3 capitalize">{d.metal}</td>
                  <td className="px-4 py-3 capitalize">{d.storage_type}</td>
                  <td className="px-4 py-3">
                    {d.storage_type === 'unallocated'
                      ? `${tokensToG(d.token_amount ?? 0)}g`
                      : `${d.bars?.length ?? 0} bar(s)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deposits.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No deposits</p>}
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['ID', 'Account', 'Metal', 'Type', 'Amount'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withdrawals.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{w.id}</td>
                  <td className="px-4 py-3">{w.account_id}</td>
                  <td className="px-4 py-3 capitalize">{w.metal ?? '—'}</td>
                  <td className="px-4 py-3 capitalize">{w.storage_type}</td>
                  <td className="px-4 py-3">
                    {w.storage_type === 'unallocated' && w.token_amount
                      ? `${tokensToG(w.token_amount)}g`
                      : 'allocated bars'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {withdrawals.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No withdrawals</p>}
        </div>
      )}
    </div>
  )
}
