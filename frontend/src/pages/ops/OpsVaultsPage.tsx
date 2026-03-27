import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Vault, VaultDetail } from '../../types'

function tokensToKg(tokens: number) { return (tokens * 0.1 / 1000).toFixed(3) }

export function OpsVaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [selected, setSelected] = useState<VaultDetail | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    api.get<Vault[]>('/vaults').then(r => setVaults(r.data))
  }, [])

  async function selectVault(v: Vault) {
    const { data } = await api.get<VaultDetail>(`/vaults/${v.id}`)
    setSelected(data)
    setPickerOpen(false)
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Vault Inventory</h1>
        <p className="text-sm text-slate-500">View unallocated pools and active bars per vault</p>
      </div>

      {/* Mobile picker */}
      <div className="md:hidden mb-3">
        <button onClick={() => setPickerOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-stone-200 text-sm font-medium text-slate-700 shadow-sm">
          <span>{selected ? selected.name : 'Select a vault…'}</span>
          <span className="text-stone-400">{pickerOpen ? '▲' : '▼'}</span>
        </button>
        {pickerOpen && (
          <div className="mt-1 bg-white rounded-xl border border-stone-200 overflow-hidden shadow-lg">
            {vaults.map(v => (
              <button key={v.id} onClick={() => selectVault(v)}
                className="w-full text-left px-4 py-3 text-sm border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <div className="font-medium text-slate-900">{v.name}</div>
                <div className="text-xs text-stone-400">{tokensToKg(v.gold_tokens ?? 0)} kg gold</div>
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vaults</p>
            </div>
            {vaults.map(v => (
              <button key={v.id} onClick={() => selectVault(v)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors ${
                  selected?.id === v.id ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''
                }`}>
                <div className="font-medium text-slate-900">{v.name}</div>
                <div className="text-xs text-stone-400">{tokensToKg(v.gold_tokens ?? 0)} kg gold</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!selected
            ? (
              <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-sm shadow-sm">
                <p className="text-3xl mb-3">🏛️</p>
                Select a vault to view its inventory
              </div>
            )
            : (
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                <div style={{ backgroundColor: 'var(--bm-navy)' }} className="px-5 py-4">
                  <h2 className="font-bold text-white">{selected.name}</h2>
                  <p className="text-xs text-slate-400">Vault #{selected.id}</p>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                      Unallocated Pools
                    </h3>
                    {selected.pools.length === 0
                      ? <p className="text-sm text-stone-400">No pools</p>
                      : selected.pools.map(p => (
                        <div key={p.metal} className="flex justify-between text-sm py-2.5 border-b border-stone-100 capitalize">
                          <span className="text-slate-700">{p.metal}</span>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">{tokensToKg(p.total_tokens)} kg</div>
                            <div className="text-xs text-stone-400">{p.total_tokens} tokens</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                      Active Bars ({selected.bars.length})
                    </h3>
                    <div className="max-h-72 overflow-y-auto border border-stone-100 rounded-lg divide-y">
                      {selected.bars.length === 0
                        ? <p className="text-sm text-stone-400 p-4">No active bars</p>
                        : selected.bars.map(b => (
                          <div key={b.id} className="flex items-center gap-2 text-xs px-3 py-2.5">
                            <span className="capitalize text-stone-400 w-12 shrink-0">[{b.metal}]</span>
                            <span className="font-mono text-slate-700 flex-1 truncate">{b.serial_number}</span>
                            <span className="text-stone-400 shrink-0">{b.weight_g}g</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
