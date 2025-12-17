"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

export default function HomePage() {
  const { user, loading, authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && !authError) {
        router.push('/dashboard');
      } else if (!user && !authError) {
        // Redirect to login if no user is authenticated
        router.push('/login');
      }
      // Only show error page if there's an actual auth error
    }
  }, [user, loading, authError, router]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoToLogin = () => {
    // Clear any stored auth state
    localStorage.clear();
    sessionStorage.clear();
    router.push('/login');
  };

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

  if (authError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f8f9fa',
        color: '#212529'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <h1 style={{
            color: '#dc3545',
            marginBottom: '16px',
            fontSize: '24px'
          }}>
            Authentication Error
          </h1>
          <p style={{
            marginBottom: '24px',
            color: '#6c757d',
            lineHeight: '1.5'
          }}>
            {authError.message}
          </p>
          <button
            onClick={handleRetry}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '12px',
              marginBottom: '16px'
            }}
          >
            Try Again
          </button>
          <button
            onClick={handleGoToLogin}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // This should never render - users are always redirected
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px'
    }}>
      Redirecting...
    </div>
  );
}
