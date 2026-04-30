import { CheckCircle2, QrCode, User as UserIcon, Settings, Calendar, LogOut, ChevronRight, MapPin, X, Car } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { Link } from 'react-router-dom';

export default function SubscriptionPage() {
  const [transactionId, setTransactionId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'auth' | 'info' | 'subscription' | 'history'>('info');
  const { userProfile, authInitialized, setUserProfile } = useAppStore();
  const [historyTrips, setHistoryTrips] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState('');
  
  // Profile edit state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editPhone, setEditPhone] = useState(userProfile?.phone || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(userProfile?.avatar_url || '');
  const [editCarPlate, setEditCarPlate] = useState(userProfile?.car_plate || '');
  const [editCarType, setEditCarType] = useState(userProfile?.car_type || '');
  const [editCarColor, setEditCarColor] = useState(userProfile?.car_color || '');
  const [isDriverRole, setIsDriverRole] = useState(userProfile?.role === 'driver');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !userProfile) {
        return;
      }
      setUploadingAvatar(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userProfile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setEditAvatarUrl(data.publicUrl);
    } catch (error: any) {
      console.error(error);
      setMessage({ text: 'Error al subir la imagen.', type: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
       setEditPhone(userProfile.phone || '');
       setEditAvatarUrl(userProfile.avatar_url || '');
       setEditCarPlate(userProfile.car_plate || '');
       setEditCarType(userProfile.car_type || '');
       setEditCarColor(userProfile.car_color || '');
       setIsDriverRole(userProfile.role === 'driver');
       // Si hay perfil, cargar el historial. Solo es posible si corrieron el script de la base de datos
       const fetchHistory = async () => {
          const { data, error } = await supabase
            .from('trip_requests')
            .select('*')
            .or(`rider_id.eq.${userProfile.id},driver_id.eq.${userProfile.id}`)
            .order('created_at', { ascending: false });
            
          if (data && !error) {
             setHistoryTrips(data);
          }
       };
       fetchHistory();
       
       supabase.auth.getSession().then(({data:{session}}) => {
         if (session?.user?.email) setUserEmail(session.user.email);
       })
       
       if (activeTab === 'auth') setActiveTab('info');
    } else {
       setActiveTab('auth');
    }
  }, [userProfile]);

  const handleVerificationRequest = async () => {
    if (!userProfile) {
      setMessage({ text: 'Debes iniciar sesión para suscribirte.', type: 'error' });
      return;
    }
    if (!transactionId || !phoneNumber) {
      setMessage({ text: 'Completa tu número de teléfono y el ID de transacción.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('verification_requests')
      .insert([
        {
          user_id: userProfile.id,
          transaction_id: transactionId,
          phone_number: phoneNumber,
          status: 'pending'
        }
      ]);

    if (error) {
      console.error("Error creating verification_requests:", error);
      if (error.message?.includes('row-level security policy')) {
         setMessage({ text: 'Error: RLS habilitado en Supabase.', type: 'error' });
      } else {
         setMessage({ text: `Error: ${error.message || 'Inténtalo de nuevo.'}`, type: 'error' });
      }
    } else {
      setMessage({ text: 'Petición enviada. Te notificaremos cuando se apruebe.', type: 'success' });
      setTransactionId('');
      setPhoneNumber('');
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    
    // Validations
    const phone = editPhone.trim();
    const avatar = editAvatarUrl.trim();
    
    if (!phone || !avatar) {
       setMessage({ text: 'El número de teléfono y la foto de perfil son obligatorios.', type: 'error' });
       return;
    }

    if (isDriverRole && (!editCarPlate.trim() || !editCarType.trim() || !editCarColor.trim())) {
       setMessage({ text: 'Para ser chofer es obligatorio completar la chapa, tipo y color de auto.', type: 'error' });
       return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const updates = {
         phone: editPhone,
         avatar_url: editAvatarUrl,
         car_plate: editCarPlate,
         car_type: editCarType,
         car_color: editCarColor,
         role: userProfile.role === 'admin' ? 'admin' : (isDriverRole ? 'driver' : 'user')
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userProfile.id)
        .select()
        .single();
        
      if (error) throw error;
      setUserProfile(data);
      setIsEditingInfo(false);
      setMessage({ text: 'Datos actualizados.', type: 'success' });
    } catch(err: any) {
      console.error(err);
      setMessage({ text: err.message || 'Error al guardar.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
    } finally {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
      window.location.replace('/');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      {/* Header Profile */}
      <div className="bg-slate-800 p-6 pt-10 border-b border-slate-700 flex flex-col items-center">
         <div className="w-24 h-24 bg-blue-900 rounded-full flex items-center justify-center border-4 border-slate-800 shadow-xl mb-4 relative overflow-hidden">
            {userProfile?.avatar_url ? (
               <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <UserIcon className="w-12 h-12 text-blue-300" />
            )}
            {userProfile?.is_verified && (
               <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-1 border-2 border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-white" />
               </div>
            )}
         </div>
         <h1 className="text-2xl font-bold text-white mb-1">
            {userProfile ? (userEmail || 'Usuario') : 'Guest'}
         </h1>
         <p className="text-slate-400 text-sm">
            {userProfile ? (userProfile.role === 'admin' ? 'Administrador' : 'Usuario Muevete') : 'Inicia sesión o regístrate'}
         </p>
      </div>

      {/* Tabs Menu */}
      <div className="p-4 space-y-3">
         
         {!userProfile && (
            <button 
              onClick={() => setActiveTab('auth')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${activeTab === 'auth' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
               <div className="flex items-center gap-3"><UserIcon className="w-5 h-5"/> <span>Registro / Inicio de sesión</span></div>
               <ChevronRight className="w-5 h-5 opacity-50" />
            </button>
         )}

         {userProfile && (
           <>
             <button 
                onClick={() => setActiveTab('info')}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${activeTab === 'info' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
             >
                <div className="flex items-center gap-3"><Settings className="w-5 h-5"/> <span>Mis Datos</span></div>
                <ChevronRight className="w-5 h-5 opacity-50" />
             </button>
             
             <button 
                onClick={() => setActiveTab('subscription')}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${activeTab === 'subscription' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
             >
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5"/> <span>Suscripción Pro</span></div>
                <ChevronRight className="w-5 h-5 opacity-50" />
             </button>

             <button 
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${activeTab === 'history' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
             >
                <div className="flex items-center gap-3"><Calendar className="w-5 h-5"/> <span>Historial de Viajes</span></div>
                <ChevronRight className="w-5 h-5 opacity-50" />
             </button>

             {userProfile.role !== 'admin' && userProfile.role !== 'driver' && (
                <button 
                   onClick={() => { setActiveTab('info'); setIsEditingInfo(true); setIsDriverRole(true); }}
                   className="w-full flex items-center justify-between p-4 rounded-xl border transition-all bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-500 text-white hover:opacity-90 shadow-lg shadow-blue-900/20 mt-2"
                >
                   <div className="flex items-center gap-3"><Car className="w-5 h-5 text-blue-300"/> <span className="font-bold">¡Hazte Chofer!</span></div>
                   <ChevronRight className="w-5 h-5 opacity-50" />
                </button>
             )}
           </>
         )}
      </div>

      {/* Tab Contents */}
      <div className="px-4 pb-20 flex-1">
         
         {activeTab === 'auth' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
               <Auth />
            </div>
         )}

         {activeTab === 'info' && userProfile && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
               {message && activeTab === 'info' && (
                 <div className={`p-3 rounded mb-3 text-sm border ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border-green-800/50' : 'bg-red-900/50 text-red-300 border-red-800/50'}`}>
                    {message.text}
                 </div>
               )}

               <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-md">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h3 className="font-bold text-white">Información de Cuenta</h3>
                    {!isEditingInfo ? (
                       <button onClick={() => { setIsEditingInfo(true); setMessage(null); }} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg">Editar</button>
                    ) : (
                       <button onClick={() => { setIsEditingInfo(false); setMessage(null); }} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg">Cancelar</button>
                    )}
                 </div>

                 <div className="space-y-4">
                    {!isEditingInfo ? (
                       <>
                          <div>
                             <span className="block text-xs text-slate-500 mb-1">Correo Electrónico</span>
                             <div className="text-white bg-slate-900 border border-slate-700 py-2 px-3 rounded-lg truncate">{userEmail}</div>
                          </div>
                          <div>
                             <span className="block text-xs text-slate-500 mb-1">Teléfono</span>
                             <div className="text-white bg-slate-900 border border-slate-700 py-2 px-3 rounded-lg">{userProfile.phone || 'No especificado'}</div>
                          </div>
                          <div>
                             <span className="block text-xs text-slate-500 mb-1">Estado de verificación</span>
                             <div className="text-white bg-slate-900 border border-slate-700 py-2 px-3 rounded-lg flex items-center gap-2">
                                {userProfile.is_verified ? <><CheckCircle2 className="text-green-500 w-4 h-4"/> Verificado Pro</> : <><X className="text-red-500 w-4 h-4"/> Básico</>}
                             </div>
                          </div>
                          {userProfile.role === 'driver' && (
                             <>
                                <div>
                                   <span className="block text-xs text-slate-500 mb-1">Datos del Auto</span>
                                   <div className="text-white bg-slate-900 border border-slate-700 py-2 px-3 rounded-lg text-sm">
                                      <span className="text-slate-400">Chapa:</span> {userProfile.car_plate} <br/>
                                      <span className="text-slate-400">Tipo:</span> {userProfile.car_type} <br/>
                                      <span className="text-slate-400">Color:</span> {userProfile.car_color}
                                   </div>
                                </div>
                             </>
                          )}
                       </>
                    ) : (
                       <div className="space-y-4">
                          <div>
                             <label className="block text-xs text-slate-500 mb-1">Tu Teléfono Móvil</label>
                             <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                          </div>
                          <div>
                             <label className="block text-xs text-slate-500 mb-1">Foto de Perfil (Con Rostro)</label>
                             {editAvatarUrl && (
                               <div className="mb-2 w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700">
                                  <img src={editAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                               </div>
                             )}
                             <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleAvatarUpload} 
                                disabled={uploadingAvatar}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-slate-700 file:text-white" 
                             />
                             {uploadingAvatar && <p className="text-xs text-blue-400 mt-1">Subiendo imagen...</p>}
                          </div>
                          
                          {userProfile.role !== 'admin' && (
                             <div className="pt-3 border-t border-slate-700 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                   <input type="checkbox" checked={isDriverRole} onChange={(e) => setIsDriverRole(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                                   <span className="text-sm font-bold text-white">Quiero ser Chofer</span>
                                </label>
                                
                                {isDriverRole && (
                                   <div className="space-y-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                      <p className="text-xs text-yellow-500 font-bold mb-2">Es obligatorio completar estos campos con información real por motivos de seguridad.</p>
                                      <div>
                                         <label className="block text-xs text-slate-500 mb-1">Matrícula / Chapa</label>
                                         <input type="text" placeholder="Ej: P123456" value={editCarPlate} onChange={e => setEditCarPlate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none uppercase" />
                                      </div>
                                      <div>
                                         <label className="block text-xs text-slate-500 mb-1">Tipo de Auto</label>
                                         <input type="text" placeholder="Ej: Lada 2107, Peugeot, Gacela" value={editCarType} onChange={e => setEditCarType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                                      </div>
                                      <div>
                                         <label className="block text-xs text-slate-500 mb-1">Color</label>
                                         <input type="text" placeholder="Ej: Blanco" value={editCarColor} onChange={e => setEditCarColor(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                                      </div>
                                   </div>
                                )}
                             </div>
                          )}

                          <button onClick={handleSaveProfile} disabled={loading} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors">
                             {loading ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                       </div>
                    )}
                 </div>
                 
                 <div className="mt-8 flex flex-col gap-3">
                    {userProfile.role === 'admin' && (
                       <Link to="/admin" className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl flex items-center justify-center transition-colors">
                          Panel de Administración
                       </Link>
                    )}
                    <button onClick={handleLogout} className="w-full bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-800/50 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                       <LogOut className="w-5 h-5"/> Cerrar Sesión
                    </button>
                 </div>
               </div>
            </div>
         )}

         {activeTab === 'subscription' && userProfile && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
               <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-6 border border-blue-700/50 relative overflow-hidden shadow-xl mb-6">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                   <QrCode className="w-24 h-24" />
                 </div>
                 <h2 className="text-xl font-bold text-blue-100 mb-1">Muévete Pro</h2>
                 <div className="flex items-end gap-1 mb-4">
                   <span className="text-3xl font-black text-white">250</span>
                   <span className="text-blue-200 text-sm pb-1 font-medium">CUP / mes</span>
                 </div>
                 
                 <ul className="space-y-2 mb-6 relative z-10">
                   {['Pide a choferes particulares', 'Publica viajes interactivos', 'Sin anuncios', 'Alertas por SMS (Próximamente)'].map((feature, i) => (
                     <li key={i} className="flex items-start gap-2 text-sm text-blue-100">
                       <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                       <span>{feature}</span>
                     </li>
                   ))}
                 </ul>
               </div>

               <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm text-slate-300">
                 <h3 className="text-white font-bold mb-4">Pago vía Transfermóvil</h3>
                 <p className="mb-4">Transfiere <strong>250 CUP</strong> a <span className="font-mono text-blue-400 font-bold bg-slate-900 px-1 py-0.5 rounded">9200 1234 5678 9012</span> y envía tu comprobante.</p>
                 
                 <div className="space-y-3 mb-4">
                   <div>
                     <label className="block text-slate-400 mb-1 text-xs">Número de Teléfono</label>
                     <input 
                       type="text" 
                       placeholder="Ej: 5xxxxxxx"
                       value={phoneNumber}
                       onChange={(e) => setPhoneNumber(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-3 text-white focus:border-blue-500 outline-none"
                     />
                   </div>
                   <div>
                     <label className="block text-slate-400 mb-1 text-xs">ID de Transacción</label>
                     <input 
                       type="text" 
                       placeholder="Ej: XY123456"
                       value={transactionId}
                       onChange={(e) => setTransactionId(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-3 text-white focus:border-blue-500 outline-none"
                     />
                   </div>
                 </div>

                 {message && (
                   <div className={`p-3 rounded mb-3 ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800/50' : 'bg-red-900/50 text-red-300 border border-red-800/50'}`}>
                     {message.text}
                   </div>
                 )}

                 <button 
                   onClick={handleVerificationRequest}
                   disabled={loading}
                   className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                 >
                   {loading ? 'Procesando...' : 'Enviar Verificación'}
                 </button>
               </div>
            </div>
         )}

         {activeTab === 'history' && userProfile && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
               {historyTrips.length === 0 ? (
                  <div className="text-center py-10 bg-slate-800 rounded-2xl border border-slate-700">
                     <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                     <p className="text-slate-400">No hay viajes guardados en la base de datos.</p>
                     <p className="text-slate-500 text-xs mt-2 px-6">Trataste de recuperar los viajes, pero puede que la tabla 'trip_requests' no exista o esté vacía.</p>
                  </div>
               ) : (
                  historyTrips.map(trip => {
                     const isDriver = trip.driver_id === userProfile.id;
                     return (
                        <div key={trip.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden">
                           <div className={`absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg text-white ${isDriver ? 'bg-purple-600' : 'bg-blue-600'}`}>
                              {isDriver ? 'Chofer' : 'Pasajero'}
                           </div>
                           <p className="text-slate-400 text-xs mb-3">{new Date(trip.created_at).toLocaleDateString()} {new Date(trip.created_at).toLocaleTimeString()}</p>
                           <div className="flex items-center gap-2 mb-2">
                              <MapPin className="text-red-400 w-4 h-4 shrink-0" />
                              <span className="text-sm font-bold text-white flex-1 truncate">Viaje registrado</span>
                              <span className="text-green-400 font-bold">${trip.price}</span>
                           </div>
                           <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                              <span className={`text-xs px-2 py-1 rounded ${trip.status === 'completed' ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                                 {trip.status === 'completed' ? 'Completado' : trip.status}
                              </span>
                           </div>
                        </div>
                     );
                  })
               )}
            </div>
         )}
      </div>

    </div>
  );
}
