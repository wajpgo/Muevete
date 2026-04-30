/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import TripsPage from './pages/TripsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MapPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="viajes" element={<TripsPage />} />
          <Route path="suscripcion" element={<SubscriptionPage />} />
          <Route path="admin" element={<AdminPanel />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
