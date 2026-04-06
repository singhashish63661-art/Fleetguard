'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'

// We use direct URLs for the icons to bypass Next.js image compilation bugs
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const clusterIcon = (count: number) =>
  L.divIcon({
    html: `<div style="background:#1d4ed8;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;border:2px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.2)">${count}</div>`,
    className: 'cluster-icon',
    iconSize: [32, 32],
  })

type ClusterBucket = {
  clusterCount: number
  members: any[]
  lat: number
  lng: number
  id?: string
  vehicle_number?: string
  company_name?: string
  place?: string
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [points, map])
  return null
}

export default function Map({ data, onMarkerClick, autoFit = false, cluster = true }: { data: any[], onMarkerClick: (accident: any) => void, autoFit?: boolean, cluster?: boolean }) {
  // Default map center (India), but if there's data, center on the latest accident
  const mapCenter = data.length > 0 && data[0].lat ? [data[0].lat, data[0].lng] as [number, number] : [20.5937, 78.9629] as [number, number];
  const points = data.filter(acc => acc.lat && acc.lng).map(acc => [acc.lat, acc.lng]) as [number, number][];

  const clustered = useMemo(() => {
    if (!cluster) return data.map(item => ({ ...item, clusterCount: 1, lat: item.lat, lng: item.lng }))
    const buckets = new globalThis.Map<string, ClusterBucket>()
    data.forEach(item => {
      if (!item.lat || !item.lng) return
      const key = `${item.lat.toFixed(2)}|${item.lng.toFixed(2)}`
      if (!buckets.has(key)) {
        buckets.set(key, { ...item, clusterCount: 0, members: [], lat: item.lat, lng: item.lng })
      }
      const bucket = buckets.get(key)
      if (!bucket) return
      bucket.clusterCount += 1
      bucket.members.push(item)
    })
    return Array.from(buckets.values())
  }, [data, cluster])

  return (
    <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
      {autoFit && points.length > 0 ? <FitBounds points={points}/> : null}
      {/* Premium minimal map tiles */}
      <TileLayer 
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
      />
      
      {clustered.map(acc => {
        if (!acc.lat || !acc.lng) return null;
        const isCluster = acc.clusterCount && acc.clusterCount > 1
        const markerIcon = isCluster ? clusterIcon(acc.clusterCount) : customIcon
        const markerKey = isCluster ? `cluster-${acc.lat}-${acc.lng}` : acc.id
        return (
          <Marker key={markerKey} position={[acc.lat, acc.lng]} icon={markerIcon}>
            {!isCluster && (
              <Popup className="rounded-xl">
                <div className="p-1 min-w- [200px]">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 mb-2">{acc.vehicle_number}</span>
                  <h3 className="font-black text-slate-800 text-sm mb-1">{acc.company_name || 'Unknown Company'}</h3>
                  <p className="text-xs text-slate-500 font-medium mb-3 border-b pb-2">{acc.place}</p>
                  <button 
                    onClick={() => onMarkerClick(acc)} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    Open Evidence Profile
                  </button>
                </div>
              </Popup>
            )}
            {isCluster && (
              <Popup className="rounded-xl">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-black text-slate-800 text-sm mb-2">Cluster ({acc.clusterCount})</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {acc.members.slice(0,6).map((m:any) => (
                      <button key={m.id} onClick={() => onMarkerClick(m)} className="w-full text-left text-xs font-semibold text-indigo-700 hover:underline block">
                        {m.vehicle_number} — {m.company_name || 'Unknown'}
                      </button>
                    ))}
                    {acc.members.length > 6 && <div className="text-[10px] text-slate-500 font-semibold">+{acc.members.length - 6} more</div>}
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        )
      })}
    </MapContainer>
  )
}
