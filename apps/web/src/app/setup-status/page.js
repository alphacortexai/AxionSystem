"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function SetupStatusPage() {
  const { user, company, selectedCompanyId, userRole, loading, logout } = useAuth();
  const router = useRouter();
  const [errorConversationCount, setErrorConversationCount] = useState(0);

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

  useEffect(() => {
    const countErrorConversations = async () => {
      if (!company?.id) return;

      try {
        const ticketsRef = collection(db, 'companies', company.id, 'tickets');
        const ticketsSnap = await getDocs(ticketsRef);

        let errorCount = 0;
        for (const ticketDoc of ticketsSnap.docs) {
          const messagesRef = collection(db, 'companies', company.id, 'tickets', ticketDoc.id, 'messages');
          const errorQuery = query(messagesRef, where('error', '==', true));
          const errorSnap = await getDocs(errorQuery);
          if (!errorSnap.empty) {
            errorCount++;
          }
        }

        setErrorConversationCount(errorCount);
      } catch (error) {
        console.error('Error counting error conversations:', error);
      }
    };

    countErrorConversations();
  }, [company?.id]);

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

  if (!user) return null;

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

  const isConfigured = company.twilioAccountSid && company.twilioAuthToken &&
                      company.twilioPhoneNumber && company.geminiApiKey;

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
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Setup Status</span>
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
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007aff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Dashboard
          </button>
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
        padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1rem' : '2rem',
        paddingBottom: typeof window !== 'undefined' && window.innerWidth <= 768 ? '5rem' : '2rem'
      }}>
        <div style={{
          maxWidth: '800px',
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
            <h2 style={{ marginTop: 0, color: '#333' }}>📊 Setup Status</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Monitor your WhatsApp integration configuration and message delivery status.
            </p>

            <div style={{
              marginBottom: '1rem',
              fontSize: '14px',
              color: '#666',
              wordBreak: 'break-all'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Company ID:</strong> {company.id}
              </div>
              <div>
                <strong>Webhook URL:</strong>
                <div style={{
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  border: '1px solid #e9ecef'
                }}>
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/whatsapp/${company.id}`}
                </div>
              </div>
              {company.hasTwilioErrors && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#ffeaea', borderRadius: '4px', border: '1px solid #f44336' }}>
                  <strong style={{ color: '#d32f2f' }}>⚠️ Active Delivery Issues</strong><br />
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    Some messages are failing to send. Check your Twilio account status and webhook configuration.
                  </span>
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.75rem' : '1rem',
              marginTop: '1rem'
            }}>
              <div style={{
                padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: `1px solid ${company.twilioAccountSid ? '#34c759' : '#ff9500'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
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
                    backgroundColor: company.twilioAccountSid ? '#34c759' : '#ff9500'
                  }} />
                  <div style={{
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.9rem' : '1rem',
                    fontWeight: '600',
                    color: '#1d1d1f'
                  }}>
                    Twilio Account
                  </div>
                </div>
                <div style={{
                  fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.8rem' : '0.875rem',
                  color: company.twilioAccountSid ? '#34c759' : '#ff9500',
                  fontWeight: '500'
                }}>
                  {company.twilioAccountSid ? '✓ Configured' : '⚠️ Not configured'}
                </div>
              </div>

              <div style={{
                padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: `1px solid ${company.geminiApiKey ? '#34c759' : '#ff9500'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
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
                    backgroundColor: company.geminiApiKey ? '#34c759' : '#ff9500'
                  }} />
                  <div style={{
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.9rem' : '1rem',
                    fontWeight: '600',
                    color: '#1d1d1f'
                  }}>
                    Gemini API
                  </div>
                </div>
                <div style={{
                  fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.8rem' : '0.875rem',
                  color: company.geminiApiKey ? '#34c759' : '#ff9500',
                  fontWeight: '500'
                }}>
                  {company.geminiApiKey ? '✓ Configured' : '⚠️ Not configured'}
                </div>
              </div>

              <div style={{
                padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: `1px solid ${company.twilioPhoneNumber ? '#34c759' : '#ff9500'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
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
                    backgroundColor: company.twilioPhoneNumber ? '#34c759' : '#ff9500'
                  }} />
                  <div style={{
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.9rem' : '1rem',
                    fontWeight: '600',
                    color: '#1d1d1f'
                  }}>
                    WhatsApp Number
                  </div>
                </div>
                <div style={{
                  fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.8rem' : '0.875rem',
                  color: company.twilioPhoneNumber ? '#34c759' : '#ff9500',
                  fontWeight: '500'
                }}>
                  {company.twilioPhoneNumber ? '✓ Configured' : '⚠️ Not configured'}
                </div>
              </div>

              <div style={{
                padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '1.25rem' : '1.5rem',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: `1px solid ${errorConversationCount === 0 ? '#34c759' : '#ff3b30'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
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
                    backgroundColor: errorConversationCount === 0 ? '#34c759' : '#ff3b30'
                  }} />
                  <div style={{
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.9rem' : '1rem',
                    fontWeight: '600',
                    color: '#1d1d1f'
                  }}>
                    Message Delivery
                  </div>
                </div>
                <div style={{
                  fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.8rem' : '0.875rem',
                  color: errorConversationCount === 0 ? '#34c759' : '#ff3b30',
                  fontWeight: '500'
                }}>
                  {errorConversationCount === 0
                    ? '✓ All messages delivered'
                    : `⚠️ ${errorConversationCount} conversation${errorConversationCount > 1 ? 's' : ''} with delivery errors`
                  }
                </div>
              </div>
            </div>

            {!isConfigured && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                color: '#856404'
              }}>
                ⚠️ Complete your setup in Settings to start receiving WhatsApp messages and AI responses.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}