import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  email: string;
  role: string;
  is_verified: boolean;
  created_at: string;
};

type VerificationRequest = {
  id: string;
  user_id: string;
  transaction_id: string;
  phone_number: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: { email: string };
};

type Trip = {
  id: string;
  driver_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  seats: number;
  price: number;
  status: 'active' | 'closed' | 'cancelled';
  profiles?: { email: string };
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'verifications' | 'trips'>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    setLoading(true);
    
    // Fetch users (profiles)
    const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (usersData) setUsers(usersData);

    // Fetch verifications
    const { data: verifData } = await supabase.from('verification_requests').select('*, profiles(email)').order('created_at', { ascending: false });
    if (verifData) setVerifications(verifData as unknown as VerificationRequest[]);

    // Fetch Trips
    const { data: tripsData } = await supabase.from('trips').select('*, profiles(email)').order('created_at', { ascending: false });
    if (tripsData) setTrips(tripsData as unknown as Trip[]);

    setLoading(false);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveVerification = async (req: VerificationRequest) => {
    // 1. Aprobar la solicitud
    const { error: err1 } = await supabase.from('verification_requests').update({ status: 'approved' }).eq('id', req.id);
    if (err1) {
       console.error("Error updating req:", err1);
       alert("Error al actualizar la petición.");
       return;
    }
    
    // 2. Verificar perfil
    const { error: err2, data } = await supabase.from('profiles').update({ is_verified: true }).eq('id', req.user_id).select();
    if (err2) {
       console.error("Error updating profile:", err2);
       alert("Error RLS al actualizar perfil: Deshabilita RLS en la tabla perfiles.");
    } else if (!data || data.length === 0) {
       alert("Atención: El perfil no fue actualizado (Posible bloqueo por RLS en tabla profiles).");
    } else {
       alert("Usuario verificado exitosamente.");
    }
    fetchAdminData();
  };

  const handleRejectVerification = async (req: VerificationRequest) => {
    await supabase.from('verification_requests').update({ status: 'rejected' }).eq('id', req.id);
    fetchAdminData();
  };

  const handleCancelTrip = async (tripId: string) => {
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', tripId);
    fetchAdminData();
  };
  
  const handleDeleteTrip = async (tripId: string) => {
    await supabase.from('trips').delete().eq('id', tripId);
    fetchAdminData();
  };

  return (
    <div className="flex-1 bg-slate-950 p-8 overflow-y-auto hidden md:block text-slate-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <a href="#/suscripcion" className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg">
            Volver
          </a>
          <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
        </div>
        
        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Usuarios ({users.length})
          </button>
          <button 
            onClick={() => setActiveTab('verifications')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'verifications' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Verificaciones ({verifications.filter(v => v.status === 'pending').length} ptes)
          </button>
          <button 
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'trips' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            Viajes Publicados ({trips.length})
          </button>
          <button onClick={fetchAdminData} className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">
            Actualizar Datos
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Cargando datos...</div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {activeTab === 'users' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800">
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Rol</th>
                    <th className="p-4 font-semibold">Verificado</th>
                    <th className="p-4 font-semibold">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4 text-white font-medium">{u.email}</td>
                      <td className="p-4 capitalize">{u.role}</td>
                      <td className="p-4">
                        {u.is_verified ? <span className="text-green-400 flex items-center gap-1"><ShieldCheck size={16}/> Sí</span> : <span className="text-slate-500">No</span>}
                      </td>
                      <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No hay usuarios</td></tr>}
                </tbody>
              </table>
            )}

            {activeTab === 'verifications' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800">
                    <th className="p-4 font-semibold">Usuario</th>
                    <th className="p-4 font-semibold">Teléfono</th>
                    <th className="p-4 font-semibold">Transacción ID</th>
                    <th className="p-4 font-semibold">Estado</th>
                    <th className="p-4 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map(v => (
                    <tr key={v.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4 text-white font-medium">{v.profiles?.email || 'Desconocido'}</td>
                      <td className="p-4 font-mono">{v.phone_number}</td>
                      <td className="p-4 font-mono text-blue-400">{v.transaction_id}</td>
                      <td className="p-4 capitalize">
                        {v.status === 'pending' ? <span className="text-yellow-400 flex items-center gap-1"><Clock size={16}/> Ptd</span> : v.status === 'approved' ? <span className="text-green-400">Aprobado</span> : <span className="text-red-400">Rechazado</span>}
                      </td>
                      <td className="p-4">
                        {v.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveVerification(v)} className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white rounded-lg transition-colors" title="Aprobar">
                              <Check size={18} />
                            </button>
                            <button onClick={() => handleRejectVerification(v)} className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors" title="Rechazar">
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {verifications.length === 0 && <tr><td colSpan={5} className="p-4 text-center">No hay peticiones de verificación</td></tr>}
                </tbody>
              </table>
            )}

            {activeTab === 'trips' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800">
                    <th className="p-4 font-semibold">Chofer</th>
                    <th className="p-4 font-semibold">Origen → Destino</th>
                    <th className="p-4 font-semibold">Salida</th>
                    <th className="p-4 font-semibold">Precio</th>
                    <th className="p-4 font-semibold">Estado</th>
                    <th className="p-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map(t => (
                    <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4 text-white">{t.profiles?.email || 'Desconocido'}</td>
                      <td className="p-4 font-medium">{t.origin} <span className="text-slate-500">→</span> {t.destination}</td>
                      <td className="p-4">{new Date(t.departure_time).toLocaleString()}</td>
                      <td className="p-4">${t.price}</td>
                      <td className="p-4 capitalize">
                        {t.status === 'active' ? <span className="text-green-400">Activo</span> : <span className="text-red-400">{t.status}</span>}
                      </td>
                      <td className="p-4 flex justify-end gap-2">
                        {t.status === 'active' && (
                          <button onClick={() => handleCancelTrip(t.id)} className="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white rounded-lg text-sm transition-colors">
                            Cerrar
                          </button>
                        )}
                        <button onClick={() => handleDeleteTrip(t.id)} className="p-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors" title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trips.length === 0 && <tr><td colSpan={6} className="p-4 text-center">No hay viajes publicados</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      
      <div className="md:hidden p-8 text-center text-red-400 font-bold mt-10">
        El panel de administración sólo es accesible en vista de ordenador.
      </div>
    </div>
  );
}
