import React from 'react';
import { useAuth } from 'react-oidc-context';
import LoginScreen from './LoginScreen.jsx';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center font-sans text-gray-300">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium animate-pulse">Verificando sesión...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-400 p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Error de Autenticación</h2>
          <p className="text-sm opacity-80">{auth.error.message}</p>
          <button 
            onClick={() => void auth.signinRedirect()}
            className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return <>{children}</>;
  }

  // Not authenticated and not loading, show the custom login screen instead of auto-redirect
  return <LoginScreen />;
}
