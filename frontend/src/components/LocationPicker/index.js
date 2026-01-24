import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix pour l'icone marker par defaut de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
})

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition({
        lat: e.latlng.lat,
        lng: e.latlng.lng
      })
    }
  })

  return position ? <Marker position={[position.lat, position.lng]} /> : null
}

function LocationPicker({ value, onChange, defaultCenter = { lat: 47.68, lng: -3.40 } }) {
  const [position, setPosition] = useState(value || null)

  useEffect(() => {
    if (value && (value.lat !== position?.lat || value.lng !== position?.lng)) {
      setPosition(value)
    }
  }, [value])

  const handlePositionChange = (newPosition) => {
    setPosition(newPosition)
    if (onChange) {
      onChange(newPosition)
    }
  }

  const center = position || defaultCenter

  return (
    <div className="space-y-2">
      <div className="h-64 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={handlePositionChange} />
        </MapContainer>
      </div>
      {position && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}
          </span>
          <button
            type="button"
            onClick={() => handlePositionChange(null)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            Effacer
          </button>
        </div>
      )}
      {!position && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cliquez sur la carte pour definir le lieu
        </p>
      )}
    </div>
  )
}

export default LocationPicker
