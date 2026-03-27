import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import type { Vault, VaultDetail, Metal } from '../../types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet's default icon path issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const METALS: Metal[] = ['gold', 'silver', 'platinum']

function tokensToKg(tokens: number) {
  return (tokens * 0.1 / 1000).toFixed(3)
}

function VaultMap({ vaults, onVaultClick, onMapClick }: {
  vaults: Vault[]
  onVaultClick: (v: Vault) => void
  onMapClick: (lat: number, lng: number) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current).setView([4.0, 73.5], 7)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng))
    mapInstanceRef.current = map
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = vaults.map(v => {
      const marker = L.marker([v.latitude, v.longitude]).addTo(map)
      marker.bindPopup(`
        <b>${v.name}</b><br/>
        Gold: ${tokensToKg(v.gold_tokens ?? 0)} kg<br/>
        Silver: ${tokensToKg(v.silver_tokens ?? 0)} kg<br/>
        Platinum: ${tokensToKg(v.platinum_tokens ?? 0)} kg
      `)
      marker.on('click', () => onVaultClick(v))
      return marker
    })
  }, [vaults])

  return <div ref={mapRef} className="h-96 rounded-xl border border-gray-200" />
}

function CreateVaultModal({ lat, lng, onClose, onCreated }: {
  lat: number; lng: number; onClose: () => void; onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/vaults', { name, latitude: lat, longitude: lng })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to create vault')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-1">New Vault</h2>
        <p className="text-sm text-gray-500 mb-4">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Vault name" value={name} onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function VaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [selected, setSelected] = useState<VaultDetail | null>(null)
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null)
  const [deactivating, setDeactivating] = useState<number | null>(null)

  async function load() {
    const { data } = await api.get<Vault[]>('/vaults')
    setVaults(data)
  }

  async function loadDetail(v: Vault) {
    const { data } = await api.get<VaultDetail>(`/vaults/${v.id}`)
    setSelected(data)
  }

  useEffect(() => { load() }, [])

  async function deactivate(id: number) {
    if (!confirm('Deactivate vault?')) return
    setDeactivating(id)
    try {
      await api.patch(`/vaults/${id}/deactivate`)
      await load()
      if (selected?.id === id) setSelected(null)
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Cannot deactivate')
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Vaults</h1>
      <p className="text-sm text-gray-500 -mt-4">Click on the map to create a new vault.</p>

      <VaultMap
        vaults={vaults}
        onVaultClick={loadDetail}
        onMapClick={(lat, lng) => setPending({ lat, lng })}
      />

      {/* Vault list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vaults.map(v => (
          <div key={v.id}
            onClick={() => loadDetail(v)}
            className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{v.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {v.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {METALS.map(m => (
                <div key={m} className="flex justify-between capitalize">
                  <span>{m}</span>
                  <span>{tokensToKg((v as any)[`${m}_tokens`] ?? 0)} kg</span>
                </div>
              ))}
            </div>
            {v.is_active && (
              <button
                onClick={(e) => { e.stopPropagation(); deactivate(v.id) }}
                disabled={deactivating === v.id}
                className="mt-3 text-xs text-red-500 hover:text-red-700"
              >
                Deactivate
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{selected.name} — Inventory</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Unallocated Pools</h3>
              {selected.pools.length === 0
                ? <p className="text-sm text-gray-400">No pools</p>
                : selected.pools.map(p => (
                  <div key={p.metal} className="flex justify-between text-sm py-1 border-b border-gray-100 capitalize">
                    <span>{p.metal}</span>
                    <span>{tokensToKg(p.total_tokens)} kg</span>
                  </div>
                ))
              }
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Allocated Bars ({selected.bars.length})</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {selected.bars.length === 0
                  ? <p className="text-sm text-gray-400">No active bars</p>
                  : selected.bars.map(b => (
                    <div key={b.id} className="text-xs text-gray-600 flex justify-between py-1 border-b border-gray-50">
                      <span className="capitalize">[{b.metal}] {b.serial_number}</span>
                      <span>{b.weight_g}g</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <CreateVaultModal
          lat={pending.lat}
          lng={pending.lng}
          onClose={() => setPending(null)}
          onCreated={() => { load(); setPending(null) }}
        />
      )}
    </div>
  )
}
