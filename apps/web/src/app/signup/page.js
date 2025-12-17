"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function SignupPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // New users from public signup go to onboarding
      router.push('/onboarding');
    }
  }, [user, loading, router]);

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
      // After successful signup, user will be redirected to onboarding
    } catch (error) {
      console.error('Signup failed:', error);
      alert('Signup failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          Creating your account...
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Setting up your Axion workspace
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{
          color: '#1976d2',
          marginBottom: '1rem',
          fontSize: '2.5rem'
        }}>
          Axion
        </h1>
        <h2 style={{
          color: '#333',
          marginBottom: '1rem',
          fontSize: '1.5rem',
          fontWeight: '600'
        }}>
          Create Admin Account
        </h2>
        <p style={{
          color: '#666',
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          Sign up to create and manage your company's AI-powered WhatsApp assistants. For team invitations, please use the link provided by your administrator.
        </p>

        <button
          onClick={handleGoogleSignUp}
          style={{
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: '0 auto',
            transition: 'background-color 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#3367d6'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#4285f4'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{
            margin: '0 0 0.5rem 0',
            color: '#28a745',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}>
            ✨ Full Admin Access
          </h3>
          <p style={{
            margin: '0',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.4'
          }}>
            Create and manage companies, configure integrations, invite team members, and access all Axion features.
          </p>
        </div>

        <p style={{
          marginTop: '2rem',
          fontSize: '14px',
          color: '#888'
        }}>
          Already have an account? <a href="/login" style={{ color: '#1976d2', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}