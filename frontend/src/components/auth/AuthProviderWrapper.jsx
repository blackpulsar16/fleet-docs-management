import React from 'react';
import { AuthProvider } from 'react-oidc-context';

const oidcConfig = {
  authority: import.meta.env.VITE_AUTHENTIK_AUTHORITY,
  client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,
  scope: 'openid profile email', 
  onSigninCallback: (_user) => {
    // Remove code and state from URL after successful login
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  }
};

export default function AuthProviderWrapper({ children }) {
  // Configured check for missing env vars
  if (!import.meta.env.VITE_AUTHENTIK_AUTHORITY || !import.meta.env.VITE_AUTHENTIK_CLIENT_ID) {
    console.warn("Authentik environment variables are missing. Please check your .env file.");
  }

  return (
    <AuthProvider {...oidcConfig}>
      {children}
    </AuthProvider>
  );
}
