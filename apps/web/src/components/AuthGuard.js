"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

/**
 * Authentication guard component that ensures user is logged in
 * @param {React.Component} children - The page content to render if authenticated
 * @param {boolean} requireCompany - Whether to also require a selected company
 * @param {string} redirectTo - Where to redirect if not authenticated (default: '/login')
 */
export default function AuthGuard({
  children,
  requireCompany = false,
  redirectTo = '/login'
}) {
  const { user, company, selectedCompanyId, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(redirectTo);
        return;
      }

      if (requireCompany && (!company || !selectedCompanyId)) {
        router.push('/select-company');
        return;
      }
    }
  }, [user, company, selectedCompanyId, loading, requireCompany, redirectTo, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!user || (requireCompany && (!company || !selectedCompanyId))) {
    return null;
  }

  // User is authenticated and meets company requirements
  return children;
}

/**
 * Higher-order component for protecting pages with authentication
 * @param {React.Component} PageComponent - The page component to protect
 * @param {boolean} requireCompany - Whether to also require a selected company
 */
export function withAuth(PageComponent, requireCompany = false) {
  return function ProtectedPage(props) {
    return (
      <AuthGuard requireCompany={requireCompany}>
        <PageComponent {...props} />
      </AuthGuard>
    );
  };
}