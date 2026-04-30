import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { BusFront, Navigation, Search, Map as MapIcon, Sun, Moon, X, List } from 'lucide-react';
import { ROUTE_CATALOG, COMMON_ROUTES } from '../lib/constants';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import ruterosData from '../lib/ruterosData.json';

// Havana center coordinates
const HAVANA_CENTER: [number, number] = [23.1136, -82.3666];

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const { userLocation, setUserLocation, isSharingLocation, setIsSharingLocation, selectedRoute, setSelectedRoute, isLightMap, setIsLightMap } = useAppStore();
  const [activeUsers, setActiveUsers] = useState<Record<string, { lat: number; lng: number; route: string }>>({});
  
  // Exact OSM Data
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][][]>([]);
  const [routeStops, setRouteStops] = useState<[number, number][]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [searchInput, setSearchInput] = useState(selectedRoute || "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      }, (error) => console.error("Error getting location: ", error), { enableHighAccuracy: true });
    }
  }, [setUserLocation]);

  // Fetch EXACT routes from OpenStreetMap via Overpass API
  useEffect(() => {
    if (!selectedRoute) {
      setRouteCoordinates([]);
      setRouteStops([]);
      return;
    }

    const fetchOSMRoute = async () => {
      setIsLoadingRoute(true);

      // Handle custom local Ruteros from DB dump
      if (selectedRoute.startsWith('RUT-')) {
        const routeId = selectedRoute.replace('RUT-', '');
        const localRoute = (ruterosData as any)[routeId];
        
        if (localRoute && localRoute.lines) {
          setRouteCoordinates(localRoute.lines);
          setRouteStops([]); // No discrete stops mapped yet
          setIsLoadingRoute(false);
          return;
        }
      }

      try {
        const cacheKey = `osm-route-${selectedRoute}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          const { ways, stops } = JSON.parse(cachedData);
          setRouteCoordinates(ways);
          setRouteStops(stops);
          setIsLoadingRoute(false);
          return;
        }

        // Find relations of type route, bus, matching the "ref" in Havana bounding box
        const query = `
          [out:json][timeout:25];
          (
            relation["type"="route"]["route"~"bus|share_taxi|trolleybus"]["ref"~"^${selectedRoute}$",i](22.90,-82.55,23.20,-82.20);
          );
          out geom;
        `;
        
        const response = await fetch(`https://overpass-api.de/api/interpreter`, {
          method: 'POST',
          body: query
        });
        
        const data = await response.json();
        
        if (data.elements && data.elements.length > 0) {
          const ways: [number, number][][] = [];
          const stops: [number, number][] = [];
          
          data.elements.forEach((rel: any) => {
            if (rel.members) {
              rel.members.forEach((m: any) => {
                // Parse exact streets
                if (m.type === 'way' && m.geometry && m.role !== 'platform' && m.role !== 'stop') {
                  ways.push(m.geometry.map((g: any) => [g.lat, g.lon]));
                }
                // Parse stops/paradas
                if (m.type === 'node' && (m.role === 'stop' || m.role === 'platform' || m.role === 'stop_entry_only' || m.role === 'stop_exit_only')) {
                  if (m.lat && m.lon) stops.push([m.lat, m.lon]);
                }
              });
            }
          });
          
          setRouteCoordinates(ways);
          setRouteStops(stops);

          // Cache the route for offline use
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ways, stops }));
          } catch (storageError) {
            console.warn("Could not cache route, possibly storage is full:", storageError);
          }

        } else {
          alert(`Ruta ${selectedRoute} no encontrada en OpenStreetMap Cuba.`);
          setRouteCoordinates([]);
          setRouteStops([]);
        }
      } catch (e) {
        console.error("OSRM/Overpass Error:", e);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchOSMRoute();
  }, [selectedRoute]);


  useEffect(() => {
    let geoWatchId: number;
    let trackChannel: ReturnType<typeof supabase.channel> | null = null;

    if (isSharingLocation && selectedRoute) {
      trackChannel = supabase.channel(`route_tracking_${selectedRoute}`);
      
      trackChannel
        .on('broadcast', { event: 'location_update' }, (payload) => {
          setActiveUsers((prev) => ({
            ...prev,
            [payload.payload.user_id]: {
              lat: payload.payload.lat,
              lng: payload.payload.lng,
              route: payload.payload.route
            }
          }));
        })
        .subscribe();

      geoWatchId = navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        
        trackChannel?.send({
          type: 'broadcast',
          event: 'location_update',
          payload: {
            user_id: supabase.auth.getUser() || 'anonymous_' + Math.floor(Math.random()*1000),
            lat: latitude,
            lng: longitude,
            route: selectedRoute,
          }
        });
      }, console.error, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    } else {
      setActiveUsers({}); 
    }

    return () => {
      if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
      if (trackChannel) supabase.removeChannel(trackChannel);
    };
  }, [isSharingLocation, selectedRoute, setUserLocation]);

  const handleToggleTracking = () => {
    if (!selectedRoute) {
      alert("Selecciona una ruta primero (ej. Arriba pulsa P7)");
      return;
    }
    setIsSharingLocation(!isSharingLocation);
  };

  const getActiveRouteColor = () => {
    // Dynamic color based on route prefix
    if (!selectedRoute) return '#3b82f6';
    if (selectedRoute.startsWith('P')) return '#e11d48'; // Red for Metrobus
    if (selectedRoute.startsWith('A')) return '#0ea5e9'; // Blue for Alimentadoras
    return '#f59e0b'; // Amber for others
  };

  const handleRouteSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput) {
      setSelectedRoute(searchInput.toUpperCase());
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Search Bar / Route Selector (Floating) - z-[1000] to sit above Map */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
        <button 
          onClick={() => setIsCatalogOpen(true)}
          className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg text-slate-100 shrink-0 hover:bg-slate-700"
        >
          <List className="w-6 h-6" />
        </button>

        <form onSubmit={handleRouteSearchSubmit} className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 p-3 pl-10 rounded-xl shadow-lg font-bold placeholder:font-normal uppercase focus:outline-none focus:border-blue-500"
            placeholder="Buscar (Ej. P7, A40)..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          
          {/* Autocomplete Dropdown */}
          {isDropdownOpen && searchInput && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-white">
               {COMMON_ROUTES.filter(r => r.includes(searchInput.toUpperCase())).map((r) => (
                 <div 
                   key={r}
                   className="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0 font-bold"
                   onClick={() => {
                     setSearchInput(r);
                     setSelectedRoute(r);
                     setIsDropdownOpen(false);
                   }}
                 >
                   Guagua {r}
                 </div>
               ))}
               <div 
                  className="p-3 bg-blue-900/30 text-blue-300 font-medium cursor-pointer text-sm"
                  onClick={() => {
                    setSelectedRoute(searchInput.toUpperCase());
                    setIsDropdownOpen(false);
                  }}
               >
                 Buscar "{searchInput.toUpperCase()}" en OpenStreetMap...
               </div>
            </div>
          )}
        </form>
        
        <button 
          onClick={() => {
            // Force location refresh
            if ("geolocation" in navigator) {
               navigator.geolocation.getCurrentPosition((pos) => {
                 setUserLocation([pos.coords.latitude, pos.coords.longitude]);
               });
            }
          }}
          className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg text-blue-400 shrink-0"
        >
          <Navigation className="w-6 h-6" />
        </button>
      </div>

      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setIsLightMap(!isLightMap)}
          className="bg-slate-800 p-3 rounded-full border border-slate-700 shadow-lg text-yellow-400 hover:bg-slate-700"
        >
          {isLightMap ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-yellow-400" />}
        </button>
      </div>

      <MapContainer 
        center={HAVANA_CENTER} 
        zoom={13} 
        zoomControl={false}
        className="w-full h-full z-0 bg-slate-900"
      >
        {userLocation && <ChangeView center={userLocation} zoom={14} />}
        <TileLayer
          key={isLightMap ? "light" : "dark"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className={isLightMap ? "map-tiles-filter-light" : "map-tiles-filter-dark"}
        />
        
        {/* Render Exact OpenStreetMap Active Route Paths (Multiple ways) */}
        {selectedRoute && routeCoordinates.length > 0 && (
          <Polyline 
            positions={routeCoordinates} 
            pathOptions={{ color: getActiveRouteColor(), weight: 6, opacity: 0.8 }} 
          />
        )}

        {/* Render Exact Paradas (Waypoints) from OpenStreetMap */}
        {selectedRoute && routeStops.map((wp, i) => (
          <Marker 
            key={`stop-${i}`} 
            position={wp}
            icon={L.divIcon({
              className: 'bg-transparent',
              html: `<div class="bg-white border-4 border-black w-4 h-4 rounded-full shadow-lg" style="border-color: ${getActiveRouteColor()}"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>Parada de la {selectedRoute}</Popup>
          </Marker>
        ))}

        {userLocation && (
          <Marker position={userLocation}>
            <Popup>Estás aquí.</Popup>
          </Marker>
        )}

        {/* Render other users on the bus */}
        {Object.values(activeUsers).map((u, i) => (
          <Marker 
            key={i} 
            position={[u.lat, u.lng]}
            icon={L.divIcon({
              className: 'bg-transparent',
              html: `<div class="bg-blue-500 rounded-full w-4 h-4 border-2 border-white shadow-md"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>Alguien en la guagua ({u.route})</Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* "Estoy a bordo" FAB - z-[1000] to sit above Map */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        {isLoadingRoute && (
          <span className="bg-slate-800 text-slate-300 px-4 py-2 shadow-xl border border-slate-700 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Descargando Calles de OSM...
          </span>
        )}
        <button 
          onClick={handleToggleTracking}
          className={`px-6 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 transition-colors ${
            isSharingLocation 
            ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse border-2 border-white/20' 
            : 'bg-blue-600 hover:bg-blue-700 text-white border-2 border-white/10'
          }`}
        >
          <BusFront className="w-6 h-6" />
          {isSharingLocation ? 'TERMINAR VIAJE' : 'ESTOY A BORDO'}
        </button>
      </div>

      {/* Basic Dark Mode CSS for Tiles */}
      <style>{`
        .map-tiles-filter-dark {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
        .map-tiles-filter-light {
          filter: none;
        }
      `}</style>

      {/* Catalog Modal */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-slate-900 w-full max-w-lg sm:rounded-2xl h-[85vh] sm:h-[80vh] flex flex-col shadow-2xl relative border border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-col gap-3 sm:rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-blue-400" /> Catálogo de Rutas
                </h2>
                <button onClick={() => setIsCatalogOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Tabs for fast navigation */}
              <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 hide-scrollbar scroll-smooth">
                <button 
                  onClick={() => document.getElementById('cat-principales')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap hover:bg-red-500/20"
                >
                  Principales
                </button>
                <button 
                  onClick={() => document.getElementById('cat-alimentadoras')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap hover:bg-blue-500/20"
                >
                  Alimentadoras
                </button>
                <button 
                  onClick={() => document.getElementById('cat-ruteros')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap hover:bg-yellow-500/20"
                >
                  Ruteros
                </button>
                <button 
                  onClick={() => document.getElementById('cat-complementarias')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap hover:bg-amber-500/20"
                >
                  Complementarias
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth" id="catalog-scroll-area">
              
              {/* Principales */}
              <div id="cat-principales" className="scroll-mt-4">
                <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 sticky top-[-16px] bg-slate-900 py-2 z-10">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div> Principales (P)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROUTE_CATALOG.principales.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSearchInput(r.id);
                        setSelectedRoute(r.id);
                        setIsCatalogOpen(false);
                      }}
                      className="text-left p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white bg-red-500/20 px-2 py-0.5 rounded text-sm">{r.id}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">{r.name.replace(`${r.id} (`, '').replace(')', '')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alimentadoras */}
              <div id="cat-alimentadoras" className="scroll-mt-4">
                <h3 className="text-blue-400 font-bold mb-3 flex items-center gap-2 sticky top-[-16px] bg-slate-900 py-2 z-10">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div> Alimentadoras (A)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROUTE_CATALOG.alimentadoras.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSearchInput(r.id);
                        setSelectedRoute(r.id);
                        setIsCatalogOpen(false);
                      }}
                      className="text-left p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded text-sm">{r.id}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">{r.name.replace(`${r.id} (`, '').replace(')', '')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ruteros */}
              <div id="cat-ruteros" className="scroll-mt-4">
                <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2 sticky top-[-16px] bg-slate-900 py-2 z-10">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div> Ruteros
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROUTE_CATALOG.ruteros.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSearchInput(r.id);
                        setSelectedRoute(r.id);
                        setIsCatalogOpen(false);
                      }}
                      className="text-left p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-yellow-500/50 hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 bg-yellow-400 px-2 py-0.5 rounded text-sm">{r.id}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">{r.name.replace(`${r.id} `, '').replace(`Ruta ${r.id} `, '').replace('(', '').replace(')', '')}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Complementarias */}
              <div id="cat-complementarias" className="scroll-mt-4">
                <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 sticky top-[-16px] bg-slate-900 py-2 z-10">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div> Complementarias
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROUTE_CATALOG.complementarias.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSearchInput(r.id);
                        setSelectedRoute(r.id);
                        setIsCatalogOpen(false);
                      }}
                      className="text-left p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded text-sm">{r.id}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">{r.name.replace(`${r.id} (`, '').replace(')', '')}</p>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .hide-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

