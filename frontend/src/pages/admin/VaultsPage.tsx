import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import type { Vault, VaultDetail, Metal } from '../../types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const METALS: Metal[] = ['gold', 'silver', 'platinum']

function tokensToKg(tokens: number) { return (tokens * 0.1 / 1000).toFixed(3) }

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
    // CartoDB Voyager — English labels worldwide
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map)
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
        <strong style="font-size:13px">${v.name}</strong><br/>
        <span style="color:#6b7280;font-size:12px">
          Gold: ${tokensToKg(v.gold_tokens ?? 0)} kg<br/>
          Silver: ${tokensToKg(v.silver_tokens ?? 0)} kg<br/>
          Platinum: ${tokensToKg(v.platinum_tokens ?? 0)} kg
        </span>
      `)
      marker.on('click', () => onVaultClick(v))
      return marker
    })
  }, [vaults])

  return <div ref={mapRef} className="h-64 md:h-96 rounded-xl border border-stone-200 shadow-sm" />
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
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">New Vault</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
        </div>
        <p className="text-xs text-stone-400 mb-4 font-mono">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Vault name" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-stone-200 rounded-lg py-2.5 text-sm text-slate-700 hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--bm-gold)' }}>
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Vaults</h1>
        <p className="text-sm text-slate-500">Click on the map to add a new vault location.</p>
      </div>

      <VaultMap vaults={vaults} onVaultClick={loadDetail} onMapClick={(lat, lng) => setPending({ lat, lng })} />

      {/* Vault cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vaults.map(v => (
          <div key={v.id}
            onClick={() => loadDetail(v)}
            className="bg-white rounded-xl border border-stone-200 p-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="font-semibold text-slate-900">{v.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
                v.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
              }`}>
                {v.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="space-y-1">
              {METALS.map(m => (
                <div key={m} className="flex justify-between text-xs text-slate-500 capitalize">
                  <span>{m}</span>
                  <span className="font-medium text-slate-700">
                    {tokensToKg((v as any)[`${m}_tokens`] ?? 0)} kg
                  </span>
                </div>
              ))}
            </div>
            {v.is_active && (
              <button
                onClick={(e) => { e.stopPropagation(); deactivate(v.id) }}
                disabled={deactivating === v.id}
                className="mt-3 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
              >
                Deactivate
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
              <p className="text-xs text-stone-400">Vault #{selected.id}</p>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Unallocated Pools
              </h3>
              {selected.pools.length === 0
                ? <p className="text-sm text-stone-400">No pools</p>
                : selected.pools.map(p => (
                  <div key={p.metal}
                    className="flex justify-between text-sm py-2 border-b border-stone-100 capitalize">
                    <span className="text-slate-700">{p.metal}</span>
                    <span className="font-medium text-slate-900">{tokensToKg(p.total_tokens)} kg</span>
                  </div>
                ))
              }
            </div>
            <div>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Active Bars ({selected.bars.length})
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {selected.bars.length === 0
                  ? <p className="text-sm text-stone-400">No active bars</p>
                  : selected.bars.map(b => (
                    <div key={b.id}
                      className="flex justify-between text-xs py-1.5 border-b border-stone-50">
                      <span className="text-stone-500 capitalize mr-2">[{b.metal}]</span>
                      <span className="font-mono text-slate-700 flex-1">{b.serial_number}</span>
                      <span className="text-stone-400 ml-2">{b.weight_g}g</span>
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
          lat={pending.lat} lng={pending.lng}
          onClose={() => setPending(null)}
          onCreated={() => { load(); setPending(null) }}
        />
      )}
    </div>
  )
}
