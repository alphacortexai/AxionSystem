"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function WebhookTestPage() {
  const { user, company, selectedCompanyId, userRole, loading, logout } = useAuth();
  const router = useRouter();
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

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

  const handleTestWebhook = async () => {
    if (!testMessage.trim()) {
      alert('Please enter a test message');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      // Use API routes for all deployments
      const apiBase = "/api";
      const response = await fetch(`${apiBase}/test-webhook/${company.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage.trim(),
          from: 'test-user@example.com'
        }),
      });

      const result = await response.json();
      setTestResult(result);

    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({ error: 'Test failed', details: error.message });
    } finally {
      setIsTesting(false);
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
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Webhook Test</span>
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
            <h2 style={{ marginTop: 0, color: '#333' }}>🔗 Webhook Test</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Test your WhatsApp webhook configuration to ensure messages are being received and processed correctly.
            </p>

            <div style={{
              marginBottom: '1rem',
              fontSize: '14px',
              color: '#666',
              wordBreak: 'break-all'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Webhook URL:</strong>
              </div>
              <div style={{
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

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexDirection: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'column' : 'row'
            }}>
              <input
                type="text"
                placeholder="Enter test message..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  minWidth: 0,
                  fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '16px' : '14px'
                }}
              />
              <button
                onClick={handleTestWebhook}
                disabled={isTesting || !testMessage.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isTesting || !testMessage.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !testMessage.trim() ? 0.7 : 1,
                  width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100%' : 'auto',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {isTesting ? 'Testing...' : 'Test Webhook'}
              </button>
            </div>

            {testResult && (
              <div style={{
                padding: '1rem',
                backgroundColor: testResult.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${testResult.success ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '4px',
                fontSize: '14px',
                color: testResult.success ? '#155724' : '#721c24'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Result:</strong> {testResult.success ? '✅ Webhook working!' : '❌ Error'}
                </div>
                <div style={{
                  backgroundColor: 'white',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  overflow: 'auto',
                  border: '1px solid #e9ecef'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}