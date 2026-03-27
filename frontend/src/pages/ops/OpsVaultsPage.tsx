import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { Vault, VaultDetail } from '../../types'

function tokensToKg(tokens: number) { return (tokens * 0.1 / 1000).toFixed(3) }

export function OpsVaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [selected, setSelected] = useState<VaultDetail | null>(null)

  useEffect(() => {
    api.get<Vault[]>('/vaults').then(r => setVaults(r.data))
  }, [])

  async function selectVault(v: Vault) {
    const { data } = await api.get<VaultDetail>(`/vaults/${v.id}`)
    setSelected(data)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Vault Inventory</h1>

      <div className="flex gap-4">
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {vaults.map(v => (
              <button key={v.id}
                onClick={() => selectVault(v)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50 ${selected?.id === v.id ? 'bg-blue-50' : ''}`}
              >
                <div className="font-medium text-gray-900">{v.name}</div>
                <div className="text-xs text-gray-400">
                  {tokensToKg(v.gold_tokens ?? 0)} kg gold
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {!selected
            ? <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Select a vault</div>
            : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <h2 className="font-semibold text-gray-900">{selected.name}</h2>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Unallocated Pools</h3>
                  {selected.pools.length === 0
                    ? <p className="text-sm text-gray-400">No pools</p>
                    : selected.pools.map(p => (
                      <div key={p.metal} className="flex justify-between text-sm py-1.5 border-b border-gray-50 capitalize">
                        <span>{p.metal}</span>
                        <span className="text-gray-600">{tokensToKg(p.total_tokens)} kg ({p.total_tokens} tokens)</span>
                      </div>
                    ))
                  }
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Active Bars ({selected.bars.length})</h3>
                  {selected.bars.length === 0
                    ? <p className="text-sm text-gray-400">No active bars</p>
                    : (
                      <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
                        {selected.bars.map(b => (
                          <div key={b.id} className="flex justify-between text-sm px-3 py-2">
                            <span className="capitalize text-gray-500 w-16">[{b.metal}]</span>
                            <span className="font-mono flex-1 text-gray-700">{b.serial_number}</span>
                            <span className="text-gray-400">{b.weight_g}g</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
