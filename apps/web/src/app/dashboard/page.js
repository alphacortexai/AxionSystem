"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export default function DashboardPage() {
  const { user, company, userCompanies, respondentCompanies, selectedCompanyId, userRole, loading, contextLoading, logout, selectCompanyContext } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Handle responsive detection safely (SSR-compatible)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMobileMenu && !event.target.closest('.mobile-menu-container')) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileMenu]);

  useEffect(() => {
    if (!loading && !contextLoading && !user) {
      router.push('/login');
      return;
    }

    // Redirect respondents to user dashboard
    if (!loading && !contextLoading && user && userRole === 'respondent') {
      router.push('/user-dashboard');
      return;
    }

    if (!loading && !contextLoading && user && userRole === 'admin' && (!company || !selectedCompanyId)) {
      router.push('/select-company');
    }
  }, [user, loading, contextLoading, userRole, company, selectedCompanyId, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading || contextLoading) {
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

  if (!contextLoading && (!company || !selectedCompanyId)) {
    useEffect(() => {
      router.push('/user-dashboard');
    }, [router]);
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
        padding: isMobile ? '0.75rem 1rem' : '1rem 2rem',
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

        {/* Desktop: Show user info inline */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            maxWidth: '100%'
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
        )}

        {/* Mobile: Show dropdown menu button */}
        {isMobile && (
          <div className="mobile-menu-container" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1.25rem'
              }}
            >
              ☰
            </button>

            {/* Mobile Dropdown Menu */}
            {showMobileMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                minWidth: '280px',
                zIndex: 1000,
                overflow: 'hidden'
              }}>
                {/* User Info Section */}
                <div style={{
                  padding: '1rem',
                  borderBottom: '1px solid #e0e0e0',
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#999',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Logged in as
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#333',
                    fontWeight: '500',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem'
                  }}>
                    {user.email}
                  </div>
                  {company && (
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: userRole === 'admin' ? '#4caf50' : '#2196f3',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {company.name} • {userRole?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#f44336',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🚪</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Channel Selector */}
      <main style={{
        padding: isMobile ? '1.5rem 1rem' : '2.5rem 2rem'
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
            <Link href="/inbox" style={{ textDecoration: 'none' }}>
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
                    Go directly to your WhatsApp inbox and conversations.
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
