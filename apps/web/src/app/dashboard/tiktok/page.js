"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';

export default function TikTokChannelDashboardPage() {
  const { user, company, selectedCompanyId, userRole, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && (!company || !selectedCompanyId)) {
      router.push('/select-company');
    }
  }, [user, loading, company, selectedCompanyId, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <header style={{
        backgroundColor: 'white',
        padding: '1rem 2rem',
        borderBottom: '1px solid #e5e5e5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, color: '#111827', fontSize: '1.3rem' }}>TikTok</h1>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Channel Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{user.email}</span>
          {company && (
            <span style={{
              backgroundColor: userRole === 'admin' ? '#4caf50' : '#2196f3',
              color: 'white',
              padding: '0.125rem 0.5rem',
              borderRadius: '10px',
              fontSize: '0.7rem',
              fontWeight: 600
            }}>
              {company.name}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: '#f44336',
              borderRadius: '4px',
              border: 'none',
              color: 'white',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: '2rem 2rem 3rem' }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎵</div>
          <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.4rem', color: '#111827' }}>
            TikTok Dashboard
          </h2>
          <p style={{ margin: 0, marginBottom: '0.75rem', fontSize: '0.95rem', color: '#4b5563' }}>
            Track comments, DMs, and engagement from your TikTok content.
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.9rem',
            borderRadius: '999px',
            backgroundColor: '#f3f4f6',
            fontSize: '0.85rem',
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '999px',
              backgroundColor: '#9CA3AF'
            }} />
            <span>Coming soon</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
            Once the integration is live, this dashboard will show unified TikTok customer conversations alongside your other channels.
          </p>
        </div>
      </main>
    </div>
  );
}

