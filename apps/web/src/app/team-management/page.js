"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function TeamManagementPage() {
  const { user, company, respondents, selectedCompanyId, userRole, loading, logout, inviteRespondent, removeRespondent } = useAuth();
  const router = useRouter();
  const [newRespondentEmail, setNewRespondentEmail] = useState('');
  const [invitingRespondent, setInvitingRespondent] = useState(false);
  const [removingRespondent, setRemovingRespondent] = useState(null);
  const [lastInvitation, setLastInvitation] = useState(null);

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

  const handleInviteRespondent = async (e) => {
    e.preventDefault();
    if (!newRespondentEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    try {
      setInvitingRespondent(true);
      const invitationResult = await inviteRespondent(newRespondentEmail.trim());
      setNewRespondentEmail('');
      setLastInvitation(invitationResult);

      // Copy invitation URL to clipboard
      if (invitationResult.invitationUrl) {
        navigator.clipboard.writeText(invitationResult.invitationUrl);
        alert('Invitation created! The invitation link has been copied to your clipboard. Share it with the respondent.');
      } else {
        alert('Respondent invitation created successfully!');
      }
    } catch (error) {
      console.error('Error inviting respondent:', error);
      alert(error.message);
    } finally {
      setInvitingRespondent(false);
    }
  };

  const handleRemoveRespondent = async (respondentId) => {
    if (!confirm('Are you sure you want to remove this respondent? They will lose access to all conversations.')) {
      return;
    }

    try {
      setRemovingRespondent(respondentId);
      await removeRespondent(respondentId);
      alert('Respondent removed successfully');
    } catch (error) {
      console.error('Error removing respondent:', error);
      alert('Failed to remove respondent');
    } finally {
      setRemovingRespondent(null);
    }
  };

  // Check if user is admin in current company context
  const isAdmin = userRole === 'admin';

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

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div>Access Denied</div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Only administrators can manage team members.
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007aff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
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
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Team Management</span>
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
            <h2 style={{ marginTop: 0, color: '#333' }}>👥 Team Management</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Invite and manage respondents who can help handle your WhatsApp conversations.
            </p>

            {/* Invite New Respondent */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#333', marginBottom: '1rem' }}>Invite New Respondent</h3>
              <form onSubmit={handleInviteRespondent} style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexDirection: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'column' : 'row'
              }}>
                <input
                  type="email"
                  placeholder="respondent@gmail.com"
                  value={newRespondentEmail}
                  onChange={(e) => setNewRespondentEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '16px' : '16px',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={invitingRespondent || !newRespondentEmail.trim()}
                  style={{
                    padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.875rem 1.5rem' : '0.75rem 1.5rem',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: invitingRespondent || !newRespondentEmail.trim() ? 'not-allowed' : 'pointer',
                    opacity: invitingRespondent || !newRespondentEmail.trim() ? 0.7 : 1,
                    width: typeof window !== 'undefined' && window.innerWidth <= 768 ? '100%' : 'auto',
                    minWidth: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'auto' : '120px',
                    fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '16px' : '14px',
                    marginTop: typeof window !== 'undefined' && window.innerWidth <= 768 ? '0.5rem' : '0'
                  }}
                >
                  {invitingRespondent ? 'Inviting...' : 'Invite'}
                </button>
              </form>
              <small style={{ color: '#666' }}>
                Respondents must use Gmail addresses only. They'll receive an invitation link to join your team.
              </small>

              {/* Show last invitation */}
              {lastInvitation && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#e8f5e8',
                  border: '1px solid #4caf50',
                  borderRadius: '4px'
                }}>
                  <h4 style={{ marginTop: 0, color: '#4caf50' }}>✅ Invitation Created!</h4>
                  <p style={{ margin: '0.5rem 0', color: '#666' }}>
                    <strong>Email:</strong> {lastInvitation.email}
                  </p>
                  <p style={{ margin: '0.5rem 0', color: '#666' }}>
                    <strong>Invitation Link:</strong>
                  </p>
                  <div style={{
                    backgroundColor: '#f5f5f5',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem'
                  }}>
                    {lastInvitation.invitationUrl}
                  </div>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '0.5rem' }}>
                    Share this link with the respondent. The link has been copied to your clipboard.
                  </p>
                  <button
                    onClick={() => setLastInvitation(null)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Current Respondents */}
            <div>
              <h3 style={{ color: '#333', marginBottom: '1rem' }}>Current Team Members</h3>
              {respondents.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>
                  No respondents invited yet. Conversations will be handled by you (admin) until you add team members.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {respondents.map((respondent) => (
                    <div key={respondent.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      backgroundColor: '#fafafa'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#333' }}>
                          {respondent.email}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          Status: <span style={{
                            color: respondent.status === 'active' ? '#4caf50' :
                                   respondent.status === 'invited' ? '#ff9800' : '#f44336'
                          }}>
                            {respondent.status === 'active' ? 'Active' :
                             respondent.status === 'invited' ? 'Invited (pending acceptance)' : respondent.status}
                          </span>
                          {respondent.status === 'active' && (
                            <span style={{
                              marginLeft: '0.5rem',
                              color: respondent.isOnline ? '#4caf50' : '#ff9800',
                              fontSize: '0.8rem'
                            }}>
                              {respondent.isOnline ? '🟢 Online' : '🟡 Offline'}
                            </span>
                          )}
                        </div>
                        {respondent.invitedAt && (
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            Invited: {respondent.invitedAt.toDate ? respondent.invitedAt.toDate().toLocaleDateString() : new Date(respondent.invitedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveRespondent(respondent.id)}
                        disabled={removingRespondent === respondent.id}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: removingRespondent === respondent.id ? 'not-allowed' : 'pointer',
                          opacity: removingRespondent === respondent.id ? 0.7 : 1,
                          fontSize: '14px'
                        }}
                      >
                        {removingRespondent === respondent.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}