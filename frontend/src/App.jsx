import React from 'react';
import FleetDashboard from './components/FleetDashboard.jsx';
import AuthGuard from './components/auth/AuthGuard.jsx';

export default function App() {
  return (
    <AuthGuard>
      <FleetDashboard />
    </AuthGuard>
  );
}