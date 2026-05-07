import React from 'react';
import { useAuth } from 'react-oidc-context';

export default function LoginScreen() {
  const auth = useAuth();

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
      {/* Card */}
      <div
        className="bg-white w-full max-w-[360px] border border-gray-200 shadow-sm"
        style={{ borderRadius: '6px' }}
      >
        {/* Top accent line */}
        <div className="h-0.5 w-full bg-blue-600 rounded-t" style={{ borderRadius: '6px 6px 0 0' }} />

        <div className="px-8 py-10">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5 mb-8">
            <div
              className="w-7 h-7 bg-blue-600 flex items-center justify-center flex-shrink-0"
              style={{ borderRadius: '4px' }}
            >
              {/* Simple truck/fleet icon in SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <path d="M16 8h4l3 3v5h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-700 tracking-tight">Gestión Flota</span>
          </div>

          {/* Heading */}
          <h1 className="text-gray-800 mb-1" style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Bienvenido
          </h1>
          <p className="text-gray-500 mb-8" style={{ fontSize: '13px' }}>
            Inicia sesión para continuar
          </p>

          {/* SSO Info */}
          <div
            className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-2.5 mb-6"
            style={{ borderRadius: '4px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-blue-700" style={{ fontSize: '12px', fontWeight: 500 }}>
              Autenticación SSO corporativa
            </span>
          </div>

          {/* Login button */}
          <button
            onClick={() => void auth.signinRedirect()}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center gap-2 transition-colors duration-150"
            style={{
              borderRadius: '4px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
