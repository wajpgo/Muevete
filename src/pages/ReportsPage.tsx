import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, AlertTriangle, TrafficCone, ShieldAlert, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store/useAppStore';
import { COMMON_ROUTES } from '../lib/constants';

type Report = {
  id: string;
  route: string;
  type: string;
  message: string;
  created_at: string;
};

// Mock data
const MOCK_REPORTS: Report[] = [
  { id: '1', route: 'P7', type: 'demora', message: 'La P7 no pasa hace 1 hora por la Virgen del Camino.', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: '2', route: 'P1', type: 'llena', message: 'Guagua a reventar, ni intenten montarse en La Copa.', created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>(MOCK_REPORTS);
  const [newReport, setNewReport] = useState('');
  const [routeToReport, setRouteToReport] = useState('');
  const [filterRoute, setFilterRoute] = useState('Todas');
  const { selectedRoute } = useAppStore();

  useEffect(() => {
    if (selectedRoute) {
      setRouteToReport(selectedRoute);
      setFilterRoute(selectedRoute);
    }
  }, [selectedRoute]);

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(20);
      if (data && data.length > 0) setReports(data as Report[]);
    };
    fetchReports();

    const subscription = supabase
      .channel('public:reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, payload => {
        setReports(current => [payload.new as Report, ...current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReport.trim() || !routeToReport) return;

    let inferredType = 'demora';
    if (/llena|reventar/i.test(newReport)) inferredType = 'llena';
    if (/accidente|choque|rota/i.test(newReport)) inferredType = 'accidente';

    const reportData = {
      route: routeToReport,
      type: inferredType,
      message: newReport,
      created_at: new Date().toISOString()
    };

    setReports([{ ...reportData, id: Math.random().toString() } as Report, ...reports]);
    setNewReport('');
    await supabase.from('reports').insert([reportData]);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'llena': return <ShieldAlert className="text-red-400 w-5 h-5 shrink-0" />;
      case 'accidente': return <AlertTriangle className="text-yellow-400 w-5 h-5 shrink-0" />;
      default: return <TrafficCone className="text-orange-400 w-5 h-5 shrink-0" />;
    }
  };

  const filteredReports = filterRoute === 'Todas' ? reports : reports.filter(r => r.route === filterRoute);

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      <div className="p-4 bg-slate-800 border-b border-slate-700 top-0 sticky z-10 flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <AlertTriangle className="text-blue-400" /> Reportes en Vía
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select 
            value={filterRoute}
            onChange={(e) => setFilterRoute(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm py-2 px-3 rounded-xl flex-1 focus:outline-none focus:border-blue-500"
          >
            <option value="Todas">Todas las rutas</option>
            {COMMON_ROUTES.map(r => <option key={`filter-${r}`} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">No hay reportes para esta ruta.</div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  {getIcon(report.type)}
                  <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-blue-300 whitespace-nowrap">Ruta {report.route}</span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{report.message}</p>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select 
              value={routeToReport} 
              onChange={e => setRouteToReport(e.target.value)}
              className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-sm text-white w-24 shrink-0 focus:outline-none focus:border-blue-500 font-bold"
            >
              <option value="" disabled>Ruta...</option>
              {COMMON_ROUTES.map(r => <option key={`report-${r}`} value={r}>{r}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="Ej: La P7 no pasa..." 
              value={newReport}
              onChange={e => setNewReport(e.target.value)}
              className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-sm text-white flex-1 focus:outline-none focus:border-blue-500"
            />
            <button 
              type="submit" 
              disabled={!routeToReport || !newReport.trim()}
              className="bg-blue-600 hover:bg-blue-500 transition-colors text-white p-3 rounded-xl disabled:opacity-50 disabled:bg-slate-700 flex items-center justify-center shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
