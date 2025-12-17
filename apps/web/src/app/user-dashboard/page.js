"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function UserDashboardPage() {
  const { user, company, respondents, userCompanies, respondentCompanies, selectedCompanyId, userRole, loading, contextLoading, logout, selectCompanyContext } = useAuth();
  const router = useRouter();
  const [companyStats, setCompanyStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !contextLoading && !user) {
      router.push('/login');
      return;
    }

    // Redirect admins to main dashboard
    if (!loading && !contextLoading && user && userRole === 'admin') {
      router.push('/dashboard');
      return;
    }

    if (!loading && !contextLoading && user && userRole === 'respondent' && (!company || !selectedCompanyId)) {
      // Let respondents see their available companies
    }
  }, [user, loading, contextLoading, userRole, company, selectedCompanyId, router]);

  // Load stats for respondent companies
  useEffect(() => {
    const loadCompanyStats = async () => {
      if (!user || userRole !== 'respondent') return;

      const stats = {};

      for (const comp of respondentCompanies) {
        try {
          // Count assigned tickets for this respondent in this company
          const ticketsRef = collection(db, 'companies', comp.id, 'tickets');
          const assignedQuery = query(
            ticketsRef,
            where('assignedEmail', '==', user.email),
            where('status', 'in', ['open', 'pending'])
          );
          const assignedSnap = await getDocs(assignedQuery);

          // Count total tickets in company
          const totalQuery = query(ticketsRef, orderBy('updatedAt', 'desc'));
          const totalSnap = await getDocs(totalQuery);

          stats[comp.id] = {
            assignedTickets: assignedSnap.size,
            totalTickets: totalSnap.size,
            lastActivity: totalSnap.docs.length > 0 ?
              new Date(totalSnap.docs[0].data().updatedAt.seconds * 1000) : null
          };
        } catch (error) {
          console.error(`Error loading stats for company ${comp.id}:`, error);
          stats[comp.id] = {
            assignedTickets: 0,
            totalTickets: 0,
            lastActivity: null
          };
        }
      }

      setCompanyStats(stats);
      setLoadingStats(false);
    };

    if (respondentCompanies.length > 0) {
      loadCompanyStats();
    } else {
      setLoadingStats(false);
    }
  }, [user, userRole, respondentCompanies]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleCompanyClick = async (comp) => {
    try {
      await selectCompanyContext(comp.id, comp.userRole);
      router.push('/user-inbox');
    } catch (error) {
      console.error('Error selecting company:', error);
      alert('Error accessing company. Please try again.');
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

  if (userRole === 'admin') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Redirecting to admin dashboard...
      </div>
    );
  }

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
          <span style={{ color: '#666', fontSize: '0.9rem' }}>My Companies</span>
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
          <span style={{
            backgroundColor: '#2196f3',
            color: 'white',
            padding: '0.125rem 0.5rem',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            RESPONDENT
          </span>
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

      {/* Main Content */}
      <main style={{
        padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.5rem 1rem' : '2.5rem 2rem'
      }}>
        <div style={{
          maxWidth: '960px',
          margin: '0 auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.5rem 1rem' : '2rem',
            borderRadius: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.5rem' : '2rem',
            border: '1px solid #e5e5ea'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>👤 My Dashboard</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Welcome back! Here are the companies where you're helping with customer conversations.
            </p>

            {respondentCompanies.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#666'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>No Companies Yet</h3>
                <p>You haven't been invited to any companies yet. Check your email for invitations!</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1rem'
              }}>
                {respondentCompanies.map((comp) => {
                  const stats = companyStats[comp.id] || { assignedTickets: 0, totalTickets: 0, lastActivity: null };
                  const hasTickets = stats.assignedTickets > 0;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleCompanyClick(comp)}
                      style={{
                        backgroundColor: 'white',
                        border: hasTickets ? '2px solid #25D366' : '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: hasTickets ? '0 4px 12px rgba(37, 211, 102, 0.15)' : '0 2px 4px rgba(0,0,0,0.05)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = hasTickets ?
                          '0 8px 16px rgba(37, 211, 102, 0.2)' :
                          '0 4px 8px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = hasTickets ?
                          '0 4px 12px rgba(37, 211, 102, 0.15)' :
                          '0 2px 4px rgba(0,0,0,0.05)';
                      }}
                    >
                      {hasTickets && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          backgroundColor: '#25D366',
                          color: 'white',
                          borderRadius: '12px',
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {stats.assignedTickets} ticket{stats.assignedTickets !== 1 ? 's' : ''}
                        </div>
                      )}

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          backgroundColor: '#25D366',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          color: 'white'
                        }}>
                          💬
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{
                            margin: '0 0 0.25rem 0',
                            color: '#333',
                            fontSize: '1.1rem'
                          }}>
                            {comp.name}
                          </h3>
                          <p style={{
                            margin: 0,
                            color: '#666',
                            fontSize: '0.9rem'
                          }}>
                            WhatsApp Support
                          </p>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: hasTickets ? '#25D366' : '#ff9500'
                          }} />
                          <span style={{
                            fontSize: '0.85rem',
                            color: hasTickets ? '#25D366' : '#ff9500',
                            fontWeight: '500'
                          }}>
                            {hasTickets ? 'Active conversations' : 'No active tickets'}
                          </span>
                        </div>
                      </div>

                      {stats.lastActivity && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#888',
                          marginTop: '0.5rem'
                        }}>
                          Last activity: {stats.lastActivity.toLocaleDateString()}
                        </div>
                      )}

                      <div style={{
                        marginTop: '1rem',
                        fontSize: '0.85rem',
                        color: '#666'
                      }}>
                        Click to view your assigned conversations →
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {respondentCompanies.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e5e5ea'
            }}>
              <h3 style={{ marginTop: 0, color: '#333' }}>📋 How it works</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Assigned Tickets</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                    You'll only see conversations that have been specifically assigned to you by administrators.
                  </p>
                </div>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>WhatsApp Integration</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                    Respond directly through WhatsApp. All your replies are automatically synced.
                  </p>
                </div>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔄</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Real-time Updates</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                    New messages and assignments appear instantly. Stay responsive to your customers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}