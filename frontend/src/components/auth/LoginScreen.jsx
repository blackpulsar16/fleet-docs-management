import React from 'react';
import { useAuth } from 'react-oidc-context';
import { LogIn, ShieldCheck, Layers } from 'lucide-react';

export default function LoginScreen() {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="z-10 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-10 rounded-3xl shadow-2xl w-full max-w-md text-center transform transition-all hover:scale-[1.01] duration-300">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-500/10 rounded-2xl ring-1 ring-indigo-500/30">
            <Layers className="w-12 h-12 text-indigo-400" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
          Documentos Flota
        </h1>
        <p className="text-slate-400 mb-10 text-sm">
          Plataforma de gestión de documentos y analítica
        </p>

        <div className="bg-slate-800/50 rounded-xl p-5 mb-8 border border-slate-700/50 flex items-center justify-center gap-3 text-slate-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">Autenticación Segura (SSO)</span>
        </div>

        <button
          onClick={() => void auth.signinRedirect()}
          className="w-full relative group overflow-hidden bg-indigo-600 text-white rounded-xl px-6 py-4 font-semibold text-lg hover:bg-indigo-500 transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] flex items-center justify-center gap-2"
        >
          <span className="relative z-10 flex items-center gap-2">
            Iniciar Sesión
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
        </button>
      </div>

      {/* <div className="mt-8 text-slate-500 text-sm z-10 font-medium">
        © {new Date().getFullYear()} Fleet System. Todos los derechos reservados.
      </div> */}

      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
