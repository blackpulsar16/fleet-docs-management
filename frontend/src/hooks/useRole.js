import { useAuth } from 'react-oidc-context';

export function useRole() {
    const auth = useAuth();
    
    // Check if Authentik token has 'flota-docs-editor' or 'Admin' in the 'groups' array.
    const groups = auth.user?.profile?.groups || [];
    
    const isEditor = groups.includes('flota-docs-editor') || groups.includes('Admin');
    const isViewer = groups.includes('flota-viewers') || isEditor;
    
    return { isEditor, isViewer, groups };
}
