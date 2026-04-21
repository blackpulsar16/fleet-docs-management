import { useAuth } from 'react-oidc-context';
import { useCallback } from 'react';

export function useApiClient() {
    const auth = useAuth();
    
    const fetchWithAuth = useCallback(async (url, options = {}) => {
        const headers = new Headers(options.headers || {});
        
        if (auth.user?.access_token) {
            headers.set('Authorization', `Bearer ${auth.user.access_token}`);
        }
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            console.error("Autenticación inválida (401). Verifica tu sesión.");
        }
        
        return response;
    }, [auth.user]);

    return { fetchWithAuth };
}
