import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { Portfolio, Deposit, Withdrawal } from '../../types'

const METAL_ICON: Record<string, string> = { gold: '🥇', silver: '🥈', platinum: '⬜' }
const METAL_COLOR: Record<string, string> = {
  gold: 'border-yellow-200 bg-yellow-50',
  silver: 'border-gray-200 bg-gray-50',
  platinum: 'border-blue-100 bg-blue-50',
}

export function PortfolioPage() {
  const { user } = useAuth()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [currency, setCurrency] = useState<'USD' | 'MVR'>('USD')
  const [tab, setTab] = useState<'deposits' | 'withdrawals' | 'bars'>('deposits')
  const [mvrRate, setMvrRate] = useState(15.42)

  useEffect(() => {
    if (!user) return
    api.get<Portfolio>(`/portfolio/${user.id}`).then(r => setPortfolio(r.data))
    api.get<Deposit[]>('/deposits').then(r => setDeposits(r.data.filter(d => d.account_id === user.id)))
    api.get<Withdrawal[]>('/withdrawals').then(r => setWithdrawals(r.data.filter(w => w.account_id === user.id)))
    api.get('/config').then(r => setMvrRate(r.data.mvr_usd_rate))
  }, [user])

  const isStale = portfolio?.holdings.some(h => h.stale === true)
  const isInstitutional = portfolio?.account_type === 'institutional'

  const tabs = ['deposits', 'withdrawals', ...(isInstitutional ? ['bars'] : [])] as const

  function displayValue(usd: number | null): string {
    if (usd === null) return '—'
    if (currency === 'USD') return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    return `MVR ${(usd * mvrRate).toLocaleString('en-MV', { minimumFractionDigits: 2 })}`
  }

  if (!portfolio) {
    return <div className="text-sm text-gray-400 text-center py-20">Loading portfolio…</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Portfolio</h1>
          <p className="text-sm text-gray-500 capitalize">{portfolio.account_type} account</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['USD', 'MVR'] as const).map(c => (
            <button key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currency === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isStale && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm">
          ⚠️ Price data may be outdated — valuations are based on the last available prices.
        </div>
      )}

      {/* Holdings cards */}
      {portfolio.holdings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          No holdings yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {portfolio.holdings.map(h => (
            <div key={h.metal} className={`rounded-xl border p-5 ${METAL_COLOR[h.metal]}`}>
              <div className="text-2xl mb-2">{METAL_ICON[h.metal]}</div>
              <div className="text-sm font-medium capitalize text-gray-700 mb-1">{h.metal}</div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                {h.weight_kg != null
                  ? `${h.weight_kg.toFixed(4)} kg`
                  : `${((h.total_weight_g ?? 0) / 1000).toFixed(4)} kg`}
              </div>
              <div className="text-sm text-gray-600">
                {displayValue(h.value_usd)}
              </div>
              {h.stale && (
                <span className="mt-2 inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  Stale price
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 pb-0">
          {tabs.map(t => (
            <button key={t}
              onClick={() => setTab(t as any)}
              className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${
                tab === t ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'deposits' && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500">
                {['#', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-6">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {deposits.length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-xs">No deposits</td></tr>
                  : deposits.map(d => (
                    <tr key={d.id}>
                      <td className="py-2 pr-6 text-gray-400 text-xs">{d.deposit_number}</td>
                      <td className="py-2 pr-6 capitalize">{d.metal}</td>
                      <td className="py-2 pr-6 capitalize">{d.storage_type}</td>
                      <td className="py-2">
                        {d.token_amount ? `${(d.token_amount * 0.1).toFixed(1)}g` : `${d.bars?.length ?? 0} bars`}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}

          {tab === 'withdrawals' && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500">
                {['ID', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-2 pr-6">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {withdrawals.length === 0
                  ? <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-xs">No withdrawals</td></tr>
                  : withdrawals.map(w => (
                    <tr key={w.id}>
                      <td className="py-2 pr-6 text-gray-400">{w.id}</td>
                      <td className="py-2 pr-6 capitalize">{w.metal ?? '—'}</td>
                      <td className="py-2 pr-6 capitalize">{w.storage_type}</td>
                      <td className="py-2">
                        {w.token_amount ? `${(w.token_amount * 0.1).toFixed(1)}g` : 'allocated bars'}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}

          {tab === 'bars' && (
            <div className="divide-y divide-gray-50">
              {portfolio.holdings.flatMap(h => (h.bars ?? []).map(b => (
                <div key={b.id} className="flex justify-between py-2 text-sm">
                  <span className="font-mono text-gray-700">{b.serial_number}</span>
                  <span className="text-gray-400">{b.weight_g}g</span>
                </div>
              )))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
