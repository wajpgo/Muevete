import { Outlet, Link, useLocation } from 'react-router-dom';
import { Map, MessageSquareWarning, Navigation, UserCircle, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { isOffline, setIsOffline, setUserProfile, setAuthInitialized } = useAppStore();
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global Auth check
    const loadProfile = async (sessionUser: any) => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle();
        if (!error && data) {
          setUserProfile(data);
        } else if (sessionUser.email === 'wajpgo@gmail.com') {
          setUserProfile({ id: sessionUser.id, is_verified: true, role: 'admin' });
        } else {
          // Fallback just in case profile trigger failed
          setUserProfile({ id: sessionUser.id, is_verified: false, role: 'user' });
        }
      } catch (err) {
        console.error(err);
        setUserProfile({ id: sessionUser.id, is_verified: false, role: 'user' });
      } finally {
        setAuthInitialized(true);
      }
    };

    // First load
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setUserProfile(null);
        setAuthInitialized(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Only load if it's a new sign in or explicit refresh
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') {
            loadProfile(session.user);
        } else if (_event === 'INITIAL_SESSION') {
            loadProfile(session.user);
        }
      } else {
        setUserProfile(null);
        setAuthInitialized(true);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription.unsubscribe();
    };
  }, [setIsOffline, setUserProfile, setAuthInitialized]);

  const navItems = [
    { path: '/', icon: <Map className="w-6 h-6" />, label: 'Mapa' },
    { path: '/reportes', icon: <MessageSquareWarning className="w-6 h-6" />, label: 'Reportes' },
    { path: '/viajes', icon: <Navigation className="w-6 h-6" />, label: 'Viajes' },
    { path: '/suscripcion', icon: <UserCircle className="w-6 h-6" />, label: 'Perfil' },
  ];

  const isAdmin = location.pathname.includes('/admin') || window.location.hash.includes('/admin');

  return (
    <div className={`flex flex-col h-[100dvh] w-full ${isAdmin ? 'w-full' : 'max-w-md mx-auto'} bg-slate-900 text-slate-100 overflow-hidden relative shadow-2xl`}>
      {isOffline && (
        <div className="bg-red-600 text-white text-xs px-2 py-1 text-center font-semibold flex items-center justify-center gap-2 z-50">
          <WifiOff className="w-4 h-4" />
          <span>Sin conexión - Modo Offline</span>
        </div>
      )}
      
      <main className="flex-1 overflow-auto relative">
        <Outlet />
      </main>

      {!isAdmin && (
        <nav className="bg-slate-800 border-t border-slate-700 pb-safe z-50">
          <ul className="flex justify-around items-center p-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path} className="flex-1">
                  <Link
                    to={item.path}
                    className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                      isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.icon}
                    <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
