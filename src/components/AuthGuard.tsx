import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { LoadingScreen } from '@/components/LoadingScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Add a small delay to prevent infinite redirect loops
      const timer = setTimeout(() => {
        login();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, login]);

  if (isLoading) {
    return (
      <LoadingScreen>
        Verifying your access...
      </LoadingScreen>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoadingScreen>
        Redirecting to login...
      </LoadingScreen>
    );
  }

  return <>{children}</>;
}