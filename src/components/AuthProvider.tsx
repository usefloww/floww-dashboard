import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouteContext } from '@tanstack/react-router';
import { User } from '@/types/api';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser } = useAuthStore();
  const routeContext = useRouteContext({ from: '__root__' });

  useEffect(() => {
    // Set user from server-side auth check
    if (routeContext.user) {
      setUser(routeContext.user as User);
    }
  }, [routeContext.user, setUser]);

  return <>{children}</>;
}