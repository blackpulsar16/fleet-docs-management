import React from 'react';
import { useAuth } from 'react-oidc-context';
import LoginScreen from './LoginScreen.jsx';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          backgroundColor: '#f4f5f7',
          backgroundImage: `radial-gradient(circle, #c8cbd0 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
        }}
      >
        <div className="flex flex-col items-center gap-4 bg-white px-8 py-6 border border-gray-200 shadow-sm" style={{ borderRadius: '6px' }}>
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-gray-700 tracking-tight animate-pulse">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          backgroundColor: '#f4f5f7',
          backgroundImage: `radial-gradient(circle, #c8cbd0 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
        }}
      >
        <div className="bg-white border border-gray-200 shadow-sm p-8 max-w-md w-full relative" style={{ borderRadius: '6px' }}>
          <div className="h-0.5 w-full bg-rose-500 absolute top-0 left-0" style={{ borderRadius: '6px 6px 0 0' }} />
          <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
             <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2 tracking-tight">Error de Autenticación</h2>
          <p className="text-[13px] text-gray-500 mb-6">{auth.error.message}</p>
          <button 
            onClick={() => void auth.signinRedirect()}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-colors duration-150 flex items-center justify-center gap-2"
            style={{ borderRadius: '4px', padding: '9px 16px', fontSize: '13px', fontWeight: 600 }}
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
