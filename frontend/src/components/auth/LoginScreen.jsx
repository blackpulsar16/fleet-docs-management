import React from 'react';
import { useAuth } from 'react-oidc-context';
import { LogIn, ShieldCheck, Layers } from 'lucide-react';

export default function LoginScreen() {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">

      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-10 w-full max-w-sm text-center">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-gray-800 mb-1 tracking-tight">
          Gestión Flota
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          Plataforma de gestión de documentos
        </p>

        {/* SSO notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-6 py-2.5 px-4 bg-gray-50 rounded-lg border border-gray-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span>Autenticación Segura · SSO</span>
        </div>

        {/* Login button */}
        <button
          onClick={() => void auth.signinRedirect()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg px-6 py-3 text-sm font-medium transition-all duration-150 shadow-sm"
        >
          Iniciar Sesión
          <LogIn className="w-4 h-4" />
        </button>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400">
        © {new Date().getFullYear()} Gestión Flota
      </p>
    </div>
  );
}
