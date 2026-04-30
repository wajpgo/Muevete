import { Car, MapPin, User, Star, ShieldCheck, Phone, CheckCircle, Navigation, MessageCircle, X, Lock } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';

type Role = 'rider' | 'driver';

type TripRequest = {
  id: string;
  rider_id?: string;
  rider_name: string;
  originCoords: [number, number];
  destCoords: [number, number];
  price: string;
  status: 'pending' | 'accepted' | 'completed';
  routeInfo?: { distance: number, duration: number, coords: [number, number][] };
  driverId?: string;
  driverName?: string;
  driverCarPlate?: string;
  driverCarType?: string;
  driverCarColor?: string;
  driverAvatarUrl?: string;
};

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ mode, onSelect }: { mode: 'origin' | 'destination' | null, onSelect: (coords: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      if (mode) {
        onSelect([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

export default function TripsPage() {
  const [role, setRole] = useState<Role>('rider');
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination' | null>(null);
  const [routeInfo, setRouteInfo] = useState<{distance: number, duration: number, coords: [number, number][]} | null>(null);

  const [offerPrice, setOfferPrice] = useState('500');
  const [isRequesting, setIsRequesting] = useState(false);
  const [activeTrips, setActiveTrips] = useState<TripRequest[]>([]);
  const { userLocation, isDriverAvailable, setIsDriverAvailable, isLightMap, userProfile, authInitialized } = useAppStore();
  const [chatDriver, setChatDriver] = useState<any | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<{from: string, text: string}[]>([
    { from: 'driver', text: '¡Hola! Estoy cerca, ¿te recojo?' }
  ]);
  const [activeDrivers, setActiveDrivers] = useState<Record<string, any>>({});
  const navigate = useNavigate();

  const isVerified = userProfile?.is_verified ?? false;

  // Realtime active drivers and location
  useEffect(() => {
    let watchId: number;
    const driversChannel = supabase.channel('active_drivers');
    
    if (role === 'rider') {
      driversChannel.on('broadcast', { event: 'driver_location' }, (payload) => {
        setActiveDrivers(prev => ({...prev, [payload.payload.id]: payload.payload}));
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
           driversChannel.send({ type: 'broadcast', event: 'rider_looking', payload: {} });
        }
      });
    } else if (role === 'driver' && isDriverAvailable && userProfile) {
      driversChannel.on('broadcast', { event: 'rider_looking' }, () => {
         const loc = useAppStore.getState().userLocation;
         if (loc) {
            driversChannel.send({
               type: 'broadcast',
               event: 'driver_location',
               payload: { id: userProfile.id, name: 'Chofer ' + userProfile.id.substring(0, 4), lat: loc[0], lng: loc[1] }
            });
         }
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          watchId = navigator.geolocation.watchPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            driversChannel.send({
               type: 'broadcast',
               event: 'driver_location',
               payload: {
                  id: userProfile.id,
                  name: 'Chofer ' + userProfile.id.substring(0, 4),
                  lat,
                  lng
               }
            });
            useAppStore.getState().setUserLocation([lat, lng]);
          }, console.error, { enableHighAccuracy: true });
        }
      });
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(driversChannel);
    };
  }, [role, isDriverAvailable, userProfile]);

  // Realtime trip requests & DB sync
  useEffect(() => {
    // 1. Initial Load of Active Trips from DB
    const fetchActiveTrips = async () => {
       try {
          const { data, error } = await supabase
            .from('trip_requests')
            .select('*')
            .in('status', ['pending', 'accepted']);
          
          if (data && !error) {
             const trips: TripRequest[] = data.map(t => ({
                id: t.id,
                rider_id: t.rider_id,
                rider_name: t.rider_name,
                originCoords: t.origin_coords as [number, number],
                destCoords: t.dest_coords as [number, number],
                price: t.price.toString(),
                status: t.status as any,
                routeInfo: t.route_info as any,
                driverId: t.driver_id,
                driverName: t.driver_id ? 'Chofer Verificado' : undefined 
             }));
             setActiveTrips(trips);
          }
       } catch (err) {
          console.error(err);
       }
    };
    fetchActiveTrips();

    // 2. Realtime Broadcasts for quick UI updates
    const requestsChannel = supabase.channel('trip_requests');
    
    requestsChannel.on('broadcast', { event: 'new_request' }, (payload) => {
       setActiveTrips(prev => {
         if (prev.find(t => t.id === payload.payload.id)) return prev;
         return [payload.payload, ...prev];
       });
    }).on('broadcast', { event: 'request_accepted' }, (payload) => {
      setActiveTrips(prev => prev.map(t => 
         t.id === payload.payload.id ? { 
            ...t, 
            status: 'accepted', 
            driverId: payload.payload.driverId, 
            driverName: payload.payload.driverName,
            driverCarPlate: payload.payload.driverCarPlate,
            driverCarType: payload.payload.driverCarType,
            driverCarColor: payload.payload.driverCarColor,
            driverAvatarUrl: payload.payload.driverAvatarUrl
         } : t
      ));
    }).on('broadcast', { event: 'request_completed' }, (payload) => {
      setActiveTrips(prev => prev.filter(t => t.id !== payload.payload.id));
    }).subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, []);

  // Route calculation
  useEffect(() => {
    if (originCoords && destCoords) {
      const fetchRoute = async () => {
        try {
           const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`);
           const data = await res.json();
           if (data.code === 'Ok') {
             const route = data.routes[0];
             setRouteInfo({
               distance: route.distance, // meters
               duration: route.duration, // seconds
               coords: route.geometry.coordinates.map((c: any) => [c[1], c[0]])
             });
           }
        } catch(e) {
           console.error(e);
        }
      };
      fetchRoute();
    } else {
      setRouteInfo(null);
    }
  }, [originCoords, destCoords]);


  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originCoords || !destCoords || !userProfile) return;
    setIsRequesting(true);

    let finalTripInfo: TripRequest | null = null;
    let fallbackId = Math.random().toString(36).substring(7); // if DB disconnected, just use fallback

    try {
      const { data, error } = await supabase.from('trip_requests').insert([{
         rider_id: userProfile.id,
         rider_name: userProfile.role === 'admin' ? 'Admin Pasajero' : 'Pasajero ' + userProfile.id.substring(0, 4),
         origin_coords: originCoords,
         dest_coords: destCoords,
         route_info: routeInfo,
         price: parseFloat(offerPrice),
         status: 'pending'
      }]).select().single();

      if (data && !error) {
         finalTripInfo = {
           id: data.id,
           rider_id: userProfile.id,
           rider_name: data.rider_name,
           originCoords: data.origin_coords as [number, number],
           destCoords: data.dest_coords as [number, number],
           price: data.price.toString(),
           status: 'pending',
           routeInfo: data.route_info as any,
         };
      }
    } catch(err) {
      console.error("DB Save Error:", err);
    }

    if (!finalTripInfo) {
      // Fallback
      finalTripInfo = {
        id: fallbackId,
        rider_id: userProfile.id,
        rider_name: 'Yo (Pasajero)',
        originCoords,
        destCoords,
        price: offerPrice,
        status: 'pending',
        routeInfo: routeInfo || undefined
      };
    }

    supabase.channel('trip_requests').send({
      type: 'broadcast',
      event: 'new_request',
      payload: finalTripInfo
    });

    setActiveTrips(prev => [finalTripInfo!, ...prev]);
    setIsRequesting(false);
    setOriginCoords(null);
    setDestCoords(null);
    setRouteInfo(null);
  };

  const acceptTrip = async (id: string) => {
    const trip = activeTrips.find(t => t.id === id);
    if (!trip || !userProfile) return;
    
    try {
       await supabase.from('trip_requests').update({
         status: 'accepted',
         driver_id: userProfile.id
       }).eq('id', id);
    } catch(err) {
       console.error("Failed to update trip:", err);
    }

    supabase.channel('trip_requests').send({
      type: 'broadcast',
      event: 'request_accepted',
      payload: { 
         id, 
         driverId: userProfile.id, 
         driverName: 'Chofer ' + userProfile.id.substring(0, 4),
         driverCarPlate: userProfile.car_plate,
         driverCarType: userProfile.car_type,
         driverCarColor: userProfile.car_color,
         driverAvatarUrl: userProfile.avatar_url
      }
    });
    
    setActiveTrips(activeTrips.map(t => 
      t.id === id ? { 
         ...t, 
         status: 'accepted', 
         driverId: userProfile.id, 
         driverName: 'Chofer ' + userProfile.id.substring(0, 4),
         driverCarPlate: userProfile.car_plate,
         driverCarType: userProfile.car_type,
         driverCarColor: userProfile.car_color,
         driverAvatarUrl: userProfile.avatar_url
      } : t
    ));
    alert("¡Viaje aceptado! Dirígete al origen.");
  };

  const completeTrip = async (id: string) => {
    try {
       await supabase.from('trip_requests').update({ status: 'completed' }).eq('id', id);
    } catch(err) {
       console.error("Failed to complete trip:", err);
    }

    supabase.channel('trip_requests').send({
      type: 'broadcast',
      event: 'request_completed',
      payload: { id }
    });
    setActiveTrips(activeTrips.filter(t => t.id !== id));
    alert("Viaje finalizado.");
  };

  if (!authInitialized) {
    return (
      <div className="flex flex-col h-full bg-slate-900 justify-center items-center text-slate-400">
        Verificando cuenta...
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col h-full bg-slate-900 justify-center items-center text-center p-4">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Inicia sesión</h2>
          <p className="text-slate-400 mb-8 max-w-xs">
            Debes iniciar sesión para usar la sección de viajes.
          </p>
          <button 
            onClick={() => navigate('/suscripcion')}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
          >
            Ir a inicio de sesión
          </button>
      </div>
    );
  }

  if (userProfile && !userProfile.is_verified) {
    return (
      <div className="flex flex-col h-full bg-slate-900 p-4">
        <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-md transform -mx-4 -mt-4 mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-1 text-white">
            <Car className="text-blue-400" /> Viajes Particulares
          </h1>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Acceso Restringido</h2>
          
          <p className="text-slate-400 mb-8">
            La sección de viajes requiere una suscripción activa a Muévete Pro para garantizar la seguridad de la comunidad.
          </p>

          <button 
            onClick={() => navigate('/suscripcion')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
          >
            Obtener Muévete Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 pb-20 overflow-y-auto relative">
      {/* Header */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 sticky top-0 z-[1000] shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-3 text-white">
          <Car className="text-blue-400" /> Viajes Particulares
        </h1>
        
        {/* Role Switcher */}
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
          <button 
            onClick={() => { setRole('rider'); setSelectionMode(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${role === 'rider' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Pasajero
          </button>
          <button 
            onClick={() => { setRole('driver'); setSelectionMode(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${role === 'driver' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Chofer
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative min-h-[500px]">
          {/* Map Area */}
          <div className="w-full h-[50vh] sm:h-[400px] relative shrink-0">
            <MapContainer 
              center={userLocation || [23.1136, -82.3666]} 
              zoom={13} 
              zoomControl={false}
              className="w-full h-full z-0"
            >
              {userLocation && <ChangeView center={userLocation} zoom={13} />}
              <TileLayer
                key={isLightMap ? "light" : "dark"}
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className={isLightMap ? "map-tiles-filter-light" : "map-tiles-filter-dark"}
              />
              
              <MapClickHandler mode={selectionMode} onSelect={(coords) => {
                if (selectionMode === 'origin') {
                  setOriginCoords(coords);
                  setSelectionMode(null);
                } else if (selectionMode === 'destination') {
                  setDestCoords(coords);
                  setSelectionMode(null);
                }
              }} />
              
              {/* User Pin */}
              {userLocation && (
                <Marker position={userLocation} icon={L.divIcon({
                  className: 'bg-transparent',
                  html: `<div class="bg-blue-600 rounded-full w-4 h-4 border-2 border-white shadow-md"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup>Tú estás aquí</Popup>
                </Marker>
              )}
              
              {/* Origin Pin */}
              {originCoords && (
                <Marker position={originCoords} icon={L.divIcon({
                  className: 'bg-transparent',
                  html: `<div class="bg-blue-500 rounded-full w-4 h-4 border-2 border-white shadow-md"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup>Punto de Recogida</Popup>
                </Marker>
              )}
              
              {/* Dest Pin */}
              {destCoords && (
                <Marker position={destCoords} icon={L.divIcon({
                  className: 'bg-transparent',
                  html: `<div class="bg-red-500 rounded-none w-4 h-4 border-2 border-white shadow-md"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup>Destino</Popup>
                </Marker>
              )}
              
              {/* Route Polyline (Rider creation mode) */}
              {routeInfo && role === 'rider' && (
                <Polyline positions={routeInfo.coords} pathOptions={{color: '#3b82f6', weight: 5, opacity: 0.8}} />
              )}

              {/* Render Accepted Trip Polylines (For Driver) */}
              {role === 'driver' && activeTrips.filter(t => t.status === 'accepted' && t.driverId === userProfile?.id).map((trip) => (
                 trip.routeInfo ? <Polyline key={trip.id} positions={trip.routeInfo.coords} pathOptions={{color: '#10b981', weight: 5, opacity: 0.8}} /> : null
              ))}
              
              {/* Trip Pins For Drivers */}
              {role === 'driver' && activeTrips.filter(t => t.status === 'pending').map(trip => (
                <Marker key={trip.id} position={trip.originCoords} icon={L.divIcon({
                  className: 'bg-transparent',
                  html: `<div class="bg-yellow-500 rounded-full w-4 h-4 border-2 border-white shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-pulse"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup>
                    <div className="text-center font-sans">
                      <p className="font-bold mb-1 text-slate-800">Pasajero: {trip.rider_name}</p>
                      <p className="text-green-600 font-black text-lg">${trip.price} <span className="text-xs">CUP</span></p>
                      {trip.routeInfo && (
                        <p className="text-xs text-slate-500 mt-1">{(trip.routeInfo.distance / 1000).toFixed(1)} km</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Driver Pins */}
              {role === 'rider' && Object.values(activeDrivers).map((driver) => (
                <Marker 
                  key={driver.id}
                  position={[driver.lat, driver.lng]}
                  eventHandlers={{ click: () => setChatDriver(driver) }}
                  icon={L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="bg-green-500 rounded-full w-4 h-4 border-2 border-white shadow-md flex items-center justify-center"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  })}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-bold mb-1">{driver.name}</p>
                      <p className="text-xs text-yellow-500 mb-2 font-bold">★ Chofer Verificado</p>
                      <span className="text-xs text-slate-500 animate-pulse">Abriendo chat...</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

            </MapContainer>

            {selectionMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-xl z-[1000] border border-blue-400 text-sm whitespace-nowrap animate-pulse">
                Toca el mapa para seleccionar {selectionMode === 'origin' ? 'el Punto de Recogida' : 'el Destino'}
                <button onClick={() => setSelectionMode(null)} className="ml-3 text-blue-200 hover:text-white">✕</button>
              </div>
            )}
          </div>

          <div className="p-4 flex-1">
            {role === 'rider' ? (
              <>
                {/* RIDER MODE */}
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg mt-[-30px] relative z-10">
                  <h2 className="text-lg font-bold text-white mb-4">¿A dónde vas?</h2>
                  
                  {!selectionMode && (originCoords || destCoords) && routeInfo ? (
                    <div className="mb-4 p-3 bg-blue-900/30 rounded-xl border border-blue-500/30 flex justify-between items-center">
                      <div className="text-sm text-slate-300">
                        <span className="block mb-1">Distancia: <strong className="text-white">{(routeInfo.distance / 1000).toFixed(1)} km</strong></span>
                        <span>Tiempo est: <strong className="text-white">{Math.ceil(routeInfo.duration / 60)} min</strong></span>
                      </div>
                      <div className="text-blue-400 bg-blue-900/50 p-2 rounded-lg border border-blue-500/30">
                        <MapPin className="w-6 h-6" />
                      </div>
                    </div>
                  ) : null}

                  <form onSubmit={handleRequestRide} className="space-y-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500"></div>
                      <button
                        type="button"
                        onClick={() => setSelectionMode('origin')}
                        className={`w-full text-left bg-slate-900 text-slate-300 border ${selectionMode === 'origin' ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-slate-700'} rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none transition-all`}
                      >
                        {originCoords ? '✔ Punto de recogida seleccionado' : 'Toca el mapa para origen'}
                      </button>
                      <div className="absolute left-[1.1rem] top-[calc(50%+6px)] bottom-[-calc(50%+6px)] w-0.5 border-l-2 border-dashed border-slate-700 z-0"></div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-none bg-red-500 z-10"></div>
                      <button
                        type="button"
                        onClick={() => setSelectionMode('destination')}
                        className={`w-full text-left bg-slate-900 text-slate-300 border ${selectionMode === 'destination' ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-slate-700'} rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none transition-all`}
                      >
                        {destCoords ? '✔ Destino seleccionado' : 'Toca el mapa para destino'}
                      </button>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Ofertar (CUP)</label>
                        <input 
                          type="number" 
                          value={offerPrice}
                          onChange={(e) => setOfferPrice(e.target.value)}
                          className="w-full bg-slate-900 text-white border border-slate-700 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-blue-500 font-bold"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isRequesting || !originCoords || !destCoords}
                        className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 px-4 flex items-center justify-center transition-colors disabled:opacity-50 mt-5"
                      >
                        {isRequesting ? 'Transmitiendo...' : 'Pedir Viaje'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* My Active Trips as Rider */}
                {activeTrips.filter(t => t.rider_id === userProfile.id || t.rider_name === 'Yo (Pasajero)').length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Mis Solicitudes</h3>
                    {activeTrips.filter(t => t.rider_id === userProfile.id || t.rider_name === 'Yo (Pasajero)').map(trip => (
                      <div key={trip.id} className="bg-slate-800 p-4 rounded-2xl border border-blue-500 relative overflow-hidden">
                        {trip.status === 'pending' && <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg z-10">Buscando chofer...</div>}
                        {trip.status === 'accepted' && <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">¡Chofer en camino!</div>}
                        
                        <div className="flex flex-col gap-2 mt-4 relative">
                          <div className="flex items-center gap-2 relative z-10">
                            <span className="text-sm font-bold text-white">Ruta en mapa:</span>
                            <span className="text-sm text-slate-300 bg-slate-900 px-2 py-1 rounded">Origen</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-sm text-slate-300 bg-slate-900 px-2 py-1 rounded">Destino</span>
                          </div>
                          <div className="text-green-400 font-bold text-xl mt-2">${trip.price} <span className="text-xs">CUP</span></div>
                        </div>

                        {trip.status === 'accepted' && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                             <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mb-4">
                               <p className="text-xs text-yellow-500 font-bold flex items-start gap-2">
                                  <ShieldCheck className="w-5 h-5 shrink-0" />
                                  <span>Para tu seguridad, NO subas al vehículo si la matrícula o las características del chofer no coinciden.</span>
                               </p>
                             </div>
                             
                             <div className="flex items-start justify-between">
                               <div className="flex items-center gap-3">
                                 {trip.driverAvatarUrl ? (
                                    <img src={trip.driverAvatarUrl} alt={trip.driverName} className="w-12 h-12 rounded-full object-cover border-2 border-slate-600" />
                                 ) : (
                                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                                      <User className="text-slate-400 w-6 h-6" />
                                    </div>
                                 )}
                                 <div>
                                   <p className="text-white text-sm font-bold">{trip.driverName || 'Chofer'}</p>
                                   <p className="text-xs text-slate-300">
                                      <span className="text-white font-bold">{trip.driverCarPlate || 'Sin Chapa'}</span> • {trip.driverCarColor} {trip.driverCarType}
                                   </p>
                                   <span className="text-xs text-yellow-400 flex items-center mt-1"><Star className="w-3 h-3 fill-yellow-400 inline mr-1"/>Verificado</span>
                                 </div>
                               </div>
                               <button onClick={() => setChatDriver({ name: trip.driverName })} className="bg-slate-700 p-3 rounded-full text-blue-400 hover:bg-slate-600 transition-colors">
                                 <MessageCircle className="w-5 h-5" />
                               </button>
                             </div>
                          </div>
                        )}
                        
                        {trip.status === 'pending' && (
                           <button 
                             onClick={() => completeTrip(trip.id)}
                             className="mt-4 w-full text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg py-2"
                           >
                             Cancelar Solicitud
                           </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>

            ) : (

              <>
                {/* DRIVER MODE */}
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col shadow-lg mb-6 gap-4 mt-[-30px] relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full transition-colors ${isDriverAvailable ? 'bg-green-500' : 'bg-slate-600'}`}>
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`font-bold transition-colors ${isDriverAvailable ? 'text-green-400' : 'text-slate-400'}`}>
                          {isDriverAvailable ? "Modo Chofer Activo" : "Fuera de línea"}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isDriverAvailable ? "Ubicación GPS encendida" : "No estás recibiendo solicitudes"}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isDriverAvailable}
                        onChange={(e) => setIsDriverAvailable(e.target.checked)}
                      />
                      <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                  
                  {isDriverAvailable && (
                    <div className="bg-green-900/30 text-green-300 text-xs px-3 py-2 rounded-lg border border-green-800/50 flex animate-pulse items-center">
                      <Navigation className="w-4 h-4 mr-2" />
                      Tu ubicación está siendo compartida en vivo con los pasajeros.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Solicitudes Recientes</h3>
                  
                  {!isDriverAvailable ? (
                    <div className="text-center py-10 bg-slate-800/50 rounded-xl border border-slate-700/50">
                      <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">Conéctate para ver solicitudes cercans.</p>
                    </div>
                  ) : activeTrips.length === 0 ? (
                    <div className="text-center py-10">
                      <Navigation className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-bounce" />
                      <p className="text-slate-400">Buscando pasajeros cerca de ti...</p>
                    </div>
                  ) : (
                    activeTrips.map(trip => (
                      <div key={trip.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-md flex flex-col relative overflow-hidden">
                        {trip.status === 'accepted' && <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">Viaje Activo</div>}
                        
                        <div className="flex justify-between items-start mb-4 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-300 font-bold text-xs uppercase border border-blue-500/30">
                              {trip.rider_name.substring(0,2)}
                            </div>
                            <span className="text-white font-bold">{trip.rider_name}</span>
                          </div>
                          <span className="text-green-400 font-black text-xl">${trip.price} <span className="text-xs text-green-600">CUP</span></span>
                        </div>

                        {trip.routeInfo && (
                           <div className="mb-4 bg-slate-900 rounded-xl p-3 border border-slate-700 text-sm text-slate-300 flex justify-between">
                              <div className="flex flex-col">
                                 <span className="text-xs text-slate-500">Distancia</span>
                                 <span className="font-bold text-white">{(trip.routeInfo.distance / 1000).toFixed(1)} km</span>
                              </div>
                              <div className="flex flex-col text-right">
                                 <span className="text-xs text-slate-500">Est.</span>
                                 <span className="font-bold text-white">{Math.ceil(trip.routeInfo.duration / 60)} min</span>
                              </div>
                           </div>
                        )}

                        {trip.status === 'pending' ? (
                          <button 
                            onClick={() => acceptTrip(trip.id)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
                          >
                            Aceptar Viaje
                          </button>
                        ) : trip.status === 'accepted' && trip.driverId === userProfile?.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => setChatDriver({name: trip.rider_name})} className="flex-1 bg-slate-700 hover:bg-slate-600 transition-colors text-white py-3 rounded-xl flex items-center justify-center gap-2">
                              <MessageCircle className="w-4 h-4"/> Chat
                            </button>
                            <button 
                              onClick={() => completeTrip(trip.id)}
                              className="flex-[2] bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-5 h-5"/> Terminar Viaje
                            </button>
                          </div>
                        ) : trip.status === 'accepted' ? (
                           <p className="text-center text-slate-500 text-sm mt-3">Viaje tomado por otro chofer.</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
      </div>

      {/* CHAT MODAL */}
      {chatDriver && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center">
          <div className="bg-slate-800 w-full max-w-md sm:rounded-2xl h-[80vh] sm:h-[600px] flex flex-col shadow-2xl relative border border-slate-700">
            {/* Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center sm:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-900/50 text-blue-400 flex items-center justify-center rounded-full font-bold">
                  {chatDriver.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{chatDriver.name}</p>
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Conectado
                  </p>
                </div>
              </div>
              <button onClick={() => setChatDriver(null)} className="text-slate-400 hover:text-white p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${msg.from === 'me' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-slate-900 border-t border-slate-700 sm:rounded-b-2xl">
              <form 
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatMessage.trim()) return;
                  setMessages([...messages, { from: 'me', text: chatMessage }]);
                  setChatMessage('');
                  
                  // Simulate reply
                  setTimeout(() => {
                    setMessages(prev => [...prev, { from: 'driver', text: '¡Entendido!' }]);
                  }, 1500);
                }}
              >
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-500">
                  <Navigation className="w-4 h-4 transform rotate-90" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Dynamic Map Dark Mode styles */}
      <style>{`
         .map-tiles-filter-dark {
            filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
         }
         .map-tiles-filter-light {
            filter: none;
         }
      `}</style>
    </div>
  );
}
