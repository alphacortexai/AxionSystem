"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export default function DashboardPage() {
  const { user, company, userCompanies, respondentCompanies, selectedCompanyId, userRole, loading, logout, selectCompanyContext } = useAuth();
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

  if (!user) {
    return null;
  }

  if (!company || !selectedCompanyId) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Redirecting to company selection...
      </div>
    );
  }

  const isAdmin = userRole === 'admin';

  const allCompanies = [...userCompanies, ...respondentCompanies];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.75rem 1rem' : '1rem 2rem',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: '0.5rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          maxWidth: '100%'
        }}>
          <h1 style={{ color: '#1976d2', margin: 0, fontSize: '1.5rem' }}>Axion</h1>
          <span style={{ color: '#666' }}>|</span>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Channel Dashboard</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          maxWidth: '100%',
          justifyContent: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'flex-start' : 'flex-end'
        }}>
          <span style={{ color: '#666', fontSize: '14px', wordBreak: 'break-all' }}>{user.email}</span>
          {company && (
            <span style={{
              backgroundColor: userRole === 'admin' ? '#4caf50' : '#2196f3',
              color: 'white',
              padding: '0.125rem 0.5rem',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              {company.name} • {userRole?.toUpperCase()}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Channel Selector */}
      <main style={{
        padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.5rem 1rem' : '2.5rem 2rem'
      }}>
        <div style={{
          maxWidth: '960px',
          margin: '0 auto'
        }}>
          <h2 style={{ marginBottom: '0.5rem', color: '#333' }}>Select a Channel</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.95rem' }}>
            Choose which messaging channel you want to manage. WhatsApp is live today; other channels are coming soon.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {/* WhatsApp */}
            <Link href="/dashboard/whatsapp" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  color: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '170px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>💬</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>WhatsApp</h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', opacity: 0.9 }}>
                    Go to your full WhatsApp dashboard, inbox, and setup.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  Live now →
                </span>
              </div>
            </Link>

            {/* Web Chats */}
            <Link href="/dashboard/web" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '170px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🖥️</div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Web Chats</h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    Website live chat and embedded widgets.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF' }}>
                  Coming soon
                </span>
              </div>
            </Link>

            {/* Instagram */}
            <Link href="/dashboard/instagram" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '170px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📸</div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Instagram</h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    DMs and story replies in one place.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF' }}>
                  Coming soon
                </span>
              </div>
            </Link>

            {/* Facebook */}
            <Link href="/dashboard/facebook" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '170px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📘</div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Facebook</h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    Messenger and page inbox integration.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF' }}>
                  Coming soon
                </span>
              </div>
            </Link>

            {/* TikTok */}
            <Link href="/dashboard/tiktok" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  color: '#111827',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '170px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🎵</div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>TikTok</h3>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    Comments and DMs from your videos.
                  </p>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF' }}>
                  Coming soon
                </span>
              </div>
            </Link>
          </div>

          {allCompanies.length > 1 && (
            <div style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6b7280' }}>
              Managing multiple brands? Use the company switcher in the top-right to change context.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
