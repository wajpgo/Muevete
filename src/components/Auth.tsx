import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { userProfile, authInitialized } = useAppStore();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error, data } = isRegistering 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        if (isRegistering) {
          if (data?.session) {
             // Already logged in
             setMessage({ text: 'Registro exitoso.', type: 'success' });
          } else {
             setMessage({ text: 'Registro exitoso. Revisa tu correo.', type: 'success' });
          }
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error de conexión', type: 'error' });
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
    } catch(error) {
      console.error("Logout error:", error);
    } finally {
      // Limpiar TODO rastro de sesión localmente por si Supabase falla
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      setLoading(false);
      // Forzar recarga absoluta
      window.location.replace('/');
    }
  };

  if (!authInitialized) {
      return (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm text-slate-400 text-center">
              Cargando sesión...
          </div>
      );
  }

  if (userProfile) {
    const isLocalAdmin = userProfile.role === 'admin';
    return (
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm text-slate-300">
        <h3 className="text-lg font-bold text-white mb-2">Usuario Actual</h3>
        <p className="mb-4">Has iniciado sesión. Verifica tu estado en el panel principal.</p>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors"
        >
          Cerrar Sesión
        </button>
        {isLocalAdmin && (
          <Link
            to="/admin"
            className="w-full mt-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg flex items-center justify-center transition-colors"
          >
            Panel de Administración
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-sm text-slate-300">
      <h3 className="text-lg font-bold text-white mb-4">
        {isRegistering ? 'Crear una Cuenta' : 'Iniciar Sesión'}
      </h3>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-slate-400 mb-1">Correo Electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="tu@correo.com"
            required
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-10 text-white focus:outline-none focus:border-blue-500"
              placeholder="********"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-2 rounded ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg flex items-center justify-center transition-colors"
        >
          {loading ? 'Procesando...' : isRegistering ? 'Registrarse' : 'Ingresar'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setMessage(null);
          }}
          className="text-blue-400 hover:underline text-xs"
        >
          {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </div>
    </div>
  );
}
