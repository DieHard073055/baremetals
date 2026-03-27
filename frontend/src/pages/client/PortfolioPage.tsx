import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { Portfolio, Deposit, Withdrawal } from '../../types'

const METAL_CONFIG: Record<string, { label: string; bg: string; border: string; dot: string; icon: string }> = {
  gold:     { label: 'Gold',     bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-400',  icon: '◈' },
  silver:   { label: 'Silver',   bg: 'bg-slate-50',  border: 'border-slate-200', dot: 'bg-slate-400',  icon: '◈' },
  platinum: { label: 'Platinum', bg: 'bg-blue-50',   border: 'border-blue-200',  dot: 'bg-blue-400',   icon: '◈' },
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
    if (currency === 'USD') return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `MVR\u00a0${(usd * mvrRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-stone-400 text-sm">Loading portfolio…</p>
      </div>
    )
  }

  const totalUsd = portfolio.holdings.reduce((s, h) => s + (h.value_usd ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Portfolio</h1>
          <p className="text-sm text-slate-500 capitalize">{portfolio.account_type} account</p>
        </div>
        <div className="flex bg-stone-100 rounded-lg p-1 gap-1">
          {(['USD', 'MVR'] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                currency === c ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <span>⚠️</span>
          <span>Price data may be outdated — valuations are based on the last available prices.</span>
        </div>
      )}

      {/* Total value bar */}
      {totalUsd > 0 && (
        <div style={{ backgroundColor: 'var(--bm-navy)' }}
          className="rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-white mt-0.5">{displayValue(totalUsd)}</p>
          </div>
          <div style={{ color: 'var(--bm-gold-light)' }} className="text-4xl">◈</div>
        </div>
      )}

      {/* Holdings cards */}
      {portfolio.holdings.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-sm shadow-sm">
          <p className="text-3xl mb-3">💰</p>
          No holdings yet
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio.holdings.map(h => {
            const cfg = METAL_CONFIG[h.metal] ?? METAL_CONFIG.gold
            return (
              <div key={h.metal}
                className={`rounded-xl border ${cfg.bg} ${cfg.border} p-5 shadow-sm`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                    <span className="font-semibold capitalize text-slate-900">{h.metal}</span>
                  </div>
                  {h.stale && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Stale
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {h.weight_kg != null
                    ? `${h.weight_kg.toFixed(4)} kg`
                    : `${((h.total_weight_g ?? 0) / 1000).toFixed(4)} kg`}
                </p>
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--bm-gold)' }}>
                  {displayValue(h.value_usd)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        <div style={{ backgroundColor: 'var(--bm-navy)' }} className="px-5 py-3">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t as any)}
                className={`px-4 py-1.5 text-sm capitalize whitespace-nowrap rounded-md transition-colors ${
                  tab === t
                    ? 'bg-white/10 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'deposits' && (
            <div className="table-scroll">
              <table className="w-full text-sm min-w-[360px]">
                <thead><tr className="text-left text-xs text-stone-400 uppercase">
                  {['Deposit #', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-3 pr-4 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-stone-50">
                  {deposits.length === 0
                    ? <tr><td colSpan={4} className="text-center py-8 text-stone-400 text-xs">No deposits yet</td></tr>
                    : deposits.map(d => (
                      <tr key={d.id} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-4 font-mono text-xs text-stone-400">{d.deposit_number}</td>
                        <td className="py-2.5 pr-4 capitalize text-slate-700">{d.metal}</td>
                        <td className="py-2.5 pr-4 capitalize text-slate-600">{d.storage_type}</td>
                        <td className="py-2.5 font-medium text-slate-900">
                          {d.token_amount ? `${(d.token_amount * 0.1).toFixed(1)} g` : `${d.bars?.length ?? 0} bars`}
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
              <table className="w-full text-sm min-w-[340px]">
                <thead><tr className="text-left text-xs text-stone-400 uppercase">
                  {['ID', 'Metal', 'Type', 'Amount'].map(h => <th key={h} className="pb-3 pr-4 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-stone-50">
                  {withdrawals.length === 0
                    ? <tr><td colSpan={4} className="text-center py-8 text-stone-400 text-xs">No withdrawals yet</td></tr>
                    : withdrawals.map(w => (
                      <tr key={w.id} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-4 text-stone-400">{w.id}</td>
                        <td className="py-2.5 pr-4 capitalize text-slate-700">{w.metal ?? '—'}</td>
                        <td className="py-2.5 pr-4 capitalize text-slate-600">{w.storage_type}</td>
                        <td className="py-2.5 font-medium text-slate-900">
                          {w.token_amount ? `${(w.token_amount * 0.1).toFixed(1)} g` : 'allocated bars'}
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
                <div key={b.id} className="flex justify-between py-3 text-sm">
                  <span className="font-mono text-slate-700">{b.serial_number}</span>
                  <span className="text-stone-400">{b.weight_g} g</span>
                </div>
              )))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
