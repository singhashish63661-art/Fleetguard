'use client'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// We use direct URLs for the icons to bypass Next.js image compilation bugs
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function Map({ data, onMarkerClick }: { data: any[], onMarkerClick: (accident: any) => void }) {
  // Default map center (India), but if there's data, center on the latest accident
  const mapCenter = data.length > 0 && data[0].lat ? [data[0].lat, data[0].lng] as [number, number] : [20.5937, 78.9629] as [number, number];

  return (
    <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
      {/* Premium minimal map tiles */}
      <TileLayer 
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
      />
      
      {data.map(acc => {
        if (!acc.lat || !acc.lng) return null;
        return (
          <Marker key={acc.id} position={[acc.lat, acc.lng]} icon={customIcon}>
            <Popup className="rounded-xl">
              <div className="p-1 min-w-[200px]">
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
          </Marker>
        )
      })}
    </MapContainer>
  )
}