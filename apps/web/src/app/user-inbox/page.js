"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";

export default function UserInboxPage() {
  const { user, company, selectedCompanyId, loading, contextLoading, userRole, updateRespondentStatus, logout } = useAuth();
  const isAdmin = userRole === 'admin';
  const isRespondent = userRole === 'respondent';
  const router = useRouter();

  // Core inbox state
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [historicalMessages, setHistoricalMessages] = useState({});
  const [agentMessage, setAgentMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newAssignments, setNewAssignments] = useState(new Set());
  const [isOnline, setIsOnline] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [showCumulativeHistory, setShowCumulativeHistory] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker && !event.target.closest('.emoji-picker')) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Add CSS animations for mobile experience
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .message-bubble {
        animation: slideIn 0.3s ease-out;
      }

      .recording-pulse {
        animation: pulse 1s infinite;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Handle media file selection and preview generation
  const handleMediaSelect = async (file) => {
    setSelectedMedia(file);

    if (file.type.startsWith('image/')) {
      // Generate image preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview({
          type: 'image',
          url: e.target.result,
          file: file
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      // For existing audio/video files
      const url = URL.createObjectURL(file);
      setMediaPreview({
        type: file.type.startsWith('audio/') ? 'audio' : 'video',
        url: url,
        file: file
      });
    } else {
      // For documents and other files
      setMediaPreview({
        type: 'document',
        file: file,
        url: null
      });
    }
  };

  // Clear media selection
  const clearMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Helper function to render message content with media support
  const MediaImage = ({ media, index }) => {
    const [imageUrl, setImageUrl] = useState(media.url);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      if (media.url.includes('firebasestorage.googleapis.com')) {
        try {
          const storage = getStorage();
          const urlParts = media.url.split('/o/')[1]?.split('?')[0];
          if (urlParts) {
            const decodedPath = decodeURIComponent(urlParts);
            const storageRef = ref(storage, decodedPath);
            getDownloadURL(storageRef).then((url) => {
              setImageUrl(url);
              setLoading(false);
            }).catch(() => {
              setImageUrl(media.url);
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        } catch (err) {
          setImageUrl(media.url);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, [media.url]);

    if (loading) {
      return (
        <div key={`media-${index}`} style={{ marginBottom: '0.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          📷 Loading image...
        </div>
      );
    }

    return (
      <div key={`media-${index}`} style={{ marginBottom: '0.5rem' }}>
        <img
          src={imageUrl}
          alt="Image attachment"
          crossOrigin="anonymous"
          style={{
            maxWidth: '250px',
            maxHeight: '250px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            cursor: 'pointer'
          }}
          onClick={() => window.open(imageUrl, '_blank')}
        />
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    if (msg.hasMedia && msg.media && msg.body) {
      const combinedContent = [];

      combinedContent.push(
        <span key="text" style={{
          color: "#333",
          lineHeight: "1.4",
          wordWrap: "break-word",
          marginRight: "0.5rem"
        }}>
          {msg.body}
        </span>
      );

      msg.media.forEach((media, index) => {
        const mediaType = media.contentType || '';
        const isImage = mediaType.startsWith('image/');

        if (isImage) {
          combinedContent.push(
            <img
              key={`media-${index}`}
              src={media.url}
              alt="Image attachment"
              style={{
                maxWidth: '150px',
                maxHeight: '150px',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                marginRight: '0.25rem',
                verticalAlign: 'middle',
                display: 'block'
              }}
              onClick={() => window.open(media.url, '_blank')}
            />
          );
        }
      });

      return combinedContent;
    }

    if (msg.hasMedia && msg.media && !msg.body) {
      const content = [];
      msg.media.forEach((media, index) => {
        const mediaType = media.contentType || '';
        const isImage = mediaType.startsWith('image/');
        const isAudio = mediaType.startsWith('audio/');
        const isVideo = mediaType.startsWith('video/');

        if (isImage) {
          content.push(
            <div key={`media-${index}`} style={{ marginBottom: '0rem' }}>
              <img
                src={media.url}
                alt="Image attachment"
                style={{
                  maxWidth: '250px',
                  maxHeight: '250px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  display: 'block'
                }}
                onClick={() => window.open(media.url, '_blank')}
              />
            </div>
          );
        } else if (isAudio) {
          content.push(
            <div key={`media-${index}`} style={{
              marginBottom: '0.5rem',
              padding: '0.5rem',
              backgroundColor: '#f0f8ff',
              border: '1px solid #1976d2',
              borderRadius: '8px',
              maxWidth: '250px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span>🎵</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Voice Note</span>
              </div>
              <audio controls style={{ width: '100%' }}>
                <source src={media.url} type={mediaType} />
                Voice note
              </audio>
            </div>
          );
        }
      });
      return content;
    }

    if (msg.body && (!msg.hasMedia || !msg.media)) {
      return (
        <div key="text" style={{
          color: "#333",
          lineHeight: "1.4",
          wordWrap: "break-word"
        }}>
          {msg.body}
        </div>
      );
    }

    return (
      <div key="fallback" style={{
        color: "#333",
        lineHeight: "1.4",
        wordWrap: "break-word"
      }}>
        {msg.body || JSON.stringify(msg.payload)}
      </div>
    );
  };

  // Loading timeout
  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
      setLoadingError('Loading timeout. Please check your internet connection and refresh the page.');
    }, 30000);

    return () => clearTimeout(timeout);
  }, [loading]);

  // Set initial online status for respondents
  useEffect(() => {
    if (userRole === 'respondent' && !loading && user?.email) {
      updateRespondentStatus(true, false).catch(error => {
        console.error('Failed to set initial online status:', error);
      });
      setIsOnline(true);

      // Set up periodic online status updates
      const interval = setInterval(() => {
        if (isOnline) {
          updateRespondentStatus(true, false).catch(error => {
            console.error('Failed to update periodic online status:', error);
          });
        }
      }, 90000);

      return () => clearInterval(interval);
    }
  }, [userRole, loading, user?.email, updateRespondentStatus]);

  // Update online status when it changes
  useEffect(() => {
    if (userRole === 'respondent' && !loading) {
      updateRespondentStatus(isOnline).catch(error => {
        console.error('Failed to update online status:', error);
      });
    }
  }, [isOnline, userRole, loading, updateRespondentStatus]);

  // Handle page visibility changes for auto online/offline status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (userRole === 'respondent') {
        setIsOnline(!document.hidden);
      }
    };

    const handleBeforeUnload = () => {
      if (userRole === 'respondent') {
        updateRespondentStatus(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userRole, updateRespondentStatus]);

  // Function to show browser notification
  const showAssignmentNotification = (ticket) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('New Ticket Assigned', {
        body: `You have been assigned a new ticket from ${ticket.customerId || 'Unknown'}`,
        icon: '/favicon.ico',
        tag: `ticket-${ticket.id}`
      });

      notification.onclick = () => {
        window.focus();
        setSelectedTicket(ticket);
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    }
  };

  useEffect(() => {
    if (!loading && !contextLoading && !user) {
      router.push('/login');
      return;
    }

    // Redirect admins to main inbox
    if (!loading && !contextLoading && user && userRole === 'admin') {
      router.push('/inbox');
      return;
    }

    // If user is logged in but no company context, redirect to user dashboard
    if (!loading && !contextLoading && user && userRole === 'respondent' && (!company || !selectedCompanyId)) {
      router.push('/user-dashboard');
    }
  }, [user, loading, contextLoading, company, selectedCompanyId, router, userRole]);

  const tenantId = company?.id;

  useEffect(() => {
    if (!tenantId || userRole !== 'respondent') return;

    const ticketsRef = collection(db, "companies", tenantId, "tickets");
    const q = query(ticketsRef,
      where("assignedEmail", "==", user.email),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const ticketsWithErrors = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const ticketData = { id: doc.id, ...doc.data() };

            try {
              const messagesRef = collection(db, "companies", tenantId, "tickets", doc.id, "messages");
              const errorQuery = query(messagesRef, where("error", "==", true), where("createdAt", ">", new Date(Date.now() - 24 * 60 * 60 * 1000)));
              const errorSnapshot = await getDocs(errorQuery);
              ticketData.hasRecentErrors = !errorSnapshot.empty;
            } catch (error) {
              ticketData.hasRecentErrors = false;
            }

            return ticketData;
          })
        );

        // Check for new assignments
        const previousTicketIds = new Set(tickets.map(t => t.id));
        const newTickets = ticketsWithErrors.filter(ticket =>
          !previousTicketIds.has(ticket.id) &&
          ticket.assignedEmail === user.email
        );

        // Show notifications for new assignments
        newTickets.forEach(ticket => {
          showAssignmentNotification(ticket);
          setNewAssignments(prev => new Set([...prev, ticket.id]));
        });

        setTickets(ticketsWithErrors);
        // Auto-select latest ticket if none selected or previous selection no longer exists
        if ((!selectedTicket || !ticketsWithErrors.find(t => t.id === selectedTicket.id)) && ticketsWithErrors.length > 0) {
          setSelectedTicket(ticketsWithErrors[0]);
        }
        setLoadingError(null);
      } catch (error) {
        console.error('Error loading conversations:', error);
        setLoadingError('Failed to load conversations. Please check your connection.');
      }
    });

    return () => unsubscribe();
  }, [tenantId, user?.email, userRole]);

  useEffect(() => {
    if (!selectedTicket || !tenantId) return;

    const messagesRef = collection(
      db,
      "companies",
      tenantId,
      "tickets",
      selectedTicket.id,
      "messages"
    );

    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const loadedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    });

    return () => unsubscribe();
  }, [selectedTicket, tenantId]);

  // Load customer history when ticket is selected
  useEffect(() => {
    if (!selectedTicket || !tenantId) {
      setCustomerHistory([]);
      setHistoricalMessages({});
      return;
    }

    const loadCustomerHistory = async () => {
      try {
        // Get all tickets for this customer (excluding current ticket)
        const customerTicketsRef = collection(db, "companies", tenantId, "tickets");
        const customerQuery = query(
          customerTicketsRef,
          where("customerId", "==", selectedTicket.customerId),
          where("status", "in", ["closed", "pending"]),
          where("assignedEmail", "==", user.email) // Only show tickets assigned to this user
        );

        const customerSnap = await getDocs(customerQuery);
        const historyTickets = customerSnap.docs
          .filter(doc => doc.id !== selectedTicket.id)
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .slice(0, 2); // Limit to last 2 tickets

        // Load messages for each historical ticket
        const historyWithMessages = {};
        const historyTicketsData = await Promise.all(
          historyTickets.map(async (ticket) => {
            try {
              const ticketMessagesRef = collection(db, "companies", tenantId, "tickets", ticket.id, "messages");
              const allMessagesQuery = query(ticketMessagesRef, orderBy("createdAt", "asc"));
              const allMessagesSnap = await getDocs(allMessagesQuery);

              const ticketMessages = allMessagesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              historyWithMessages[ticket.id] = ticketMessages;

              return {
                ...ticket,
                messageCount: ticketMessages.length,
                firstMessage: ticketMessages.length > 0 ? ticketMessages[0].body?.substring(0, 50) + "..." : "No messages"
              };
            } catch (error) {
              console.error(`Error loading messages for ticket ${ticket.id}:`, error);
              historyWithMessages[ticket.id] = [];
              return {
                ...ticket,
                messageCount: 0,
                firstMessage: "Error loading messages"
              };
            }
          })
        );

        setCustomerHistory(historyTicketsData);
        setHistoricalMessages(historyWithMessages);
        setShowHistorySection(false);
      } catch (error) {
        console.error('Error loading customer history:', error);
        setCustomerHistory([]);
        setHistoricalMessages({});
      }
    };

    loadCustomerHistory();
  }, [selectedTicket, tenantId, user?.email]);

  // Use API routes for all deployments
  const apiBase = "/api";

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  async function handleSendAgentMessage(e) {
    e?.preventDefault();
    if (!selectedTicket || (!agentMessage.trim() && !selectedMedia)) return;

    try {
      setIsSending(true);

      const requestData = {
        convId: selectedTicket.id,
        tenantId,
        userName: user?.displayName || user?.email?.split('@')[0] || 'Agent',
        userEmail: user?.email,
      };

      if (agentMessage.trim()) {
        requestData.body = agentMessage.trim();
      }

      if (selectedMedia) {
        if (selectedMedia.type.startsWith('image/') && selectedMedia.size <= 1024 * 1024) {
          const mediaUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(selectedMedia);
          });
          requestData.mediaUrl = mediaUrl;
          requestData.mediaType = selectedMedia.type;
        } else if (selectedMedia.type.startsWith('video/') && selectedMedia.size <= 5 * 1024 * 1024) {
          const mediaUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(selectedMedia);
          });
          requestData.mediaUrl = mediaUrl;
          requestData.mediaType = selectedMedia.type;
        } else {
          const isImage = selectedMedia.type.startsWith('image/');
          const isMedia = selectedMedia.type.startsWith('video/');

          if (isImage) {
            alert(`Image "${selectedMedia.name}" is too large. Please use images under 1MB.`);
          } else if (isMedia) {
            alert(`Video file "${selectedMedia.name}" is too large. Please use video files under 5MB.`);
          } else {
            alert(`File "${selectedMedia.name}" is not supported yet. Please use images, video, documents, or contact files.`);
          }
          setSelectedMedia(null);
          setMediaPreview(null);
          return;
        }
      }

      const resp = await fetch(`${apiBase}/agent/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Error sending agent message:", errText);
        alert(`Failed to send message: ${errText}`);
      } else {
        setAgentMessage("");
        setSelectedMedia(null);
        setMediaPreview(null);
      }
    } catch (err) {
      console.error("Error sending agent message:", err);
      alert("Failed to send message. Check console for details.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading || contextLoading || loadingTimeout) {
    if (loadingTimeout) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#f44336', marginBottom: '1rem' }}>⚠️ Loading Timeout</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            The inbox is taking too long to load. This might be due to network issues or authentication problems.
          </p>
          {loadingError && (
            <p style={{ color: '#f44336', marginBottom: '2rem', fontSize: '14px' }}>
              Error: {loadingError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🔄 Retry Loading
            </button>
            <button
              onClick={() => router.push('/user-dashboard')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ← Back to Dashboard
            </button>
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
        height: '100vh',
        fontSize: '18px'
      }}>
        <div style={{ marginBottom: '1rem' }}>Loading inbox...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Setting up conversations and notifications
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (userRole === 'admin') {
    useEffect(() => {
      router.push('/inbox');
    }, [router]);
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Redirecting to admin inbox...
      </div>
    );
  }

  if (!company || !selectedCompanyId) {
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

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      backgroundColor: "#f2f2f7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: "hidden"
    }}>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 998,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          width: isMobile ? "280px" : "320px",
          borderRight: "1px solid #e5e5ea",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          position: isMobile ? "fixed" : "relative",
          top: 0,
          left: isMobile ? (sidebarOpen ? 0 : "-280px") : 0,
          height: "100vh",
          zIndex: 999,
          transition: isMobile ? "left 0.3s ease" : "none",
          boxShadow: isMobile && sidebarOpen ? "2px 0 8px rgba(0,0,0,0.1)" : "none",
        }}
      >
        {/* Sidebar Header */}
        <div style={{
          padding: "1rem",
          borderBottom: "1px solid #e5e5ea",
          backgroundColor: "#f9f9f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => router.push('/user-dashboard')}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#007aff",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "0.25rem",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#e6f3ff";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
              title="Back to Dashboard"
            >
              ←
            </button>
            <div style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#1d1d1f",
              letterSpacing: "-0.025em"
            }}>
              My Tickets
            </div>
            <div style={{
              backgroundColor: "#007aff",
              color: "white",
              padding: "0.125rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: "500"
            }}>
              {tickets.length}
            </div>
          </div>
        </div>

        {/* Tickets List */}
        <div style={{ flex: 1, overflowY: "auto", marginTop: "0.5rem" }}>
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              style={{
                padding: isMobile ? "1rem" : "0.75rem",
                cursor: "pointer",
                backgroundColor: selectedTicket?.id === ticket.id ? "#e6e6e6" : "#ffffff",
                color: "#1d1d1f",
                borderRadius: "12px",
                margin: "0 10px 0.5rem 10px",
                border: ticket.hasRecentErrors ? "2px solid #ff3b30" : "1px solid #e5e5ea",
                boxShadow: selectedTicket?.id === ticket.id ? "0 1px 6px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all 0.2s ease"
              }}
              onClick={() => {
                setSelectedTicket(ticket);
                if (newAssignments.has(ticket.id)) {
                  setNewAssignments(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(ticket.id);
                    return newSet;
                  });
                }
              }}
            >
              <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {ticket.customerId || "Unknown"}
                <span style={{
                  fontSize: "0.7rem",
                  padding: "0.1rem 0.3rem",
                  borderRadius: "3px",
                  backgroundColor: ticket.status === "open" ? "#4caf50" :
                                   ticket.status === "pending" ? "#ff9800" : "#f44336",
                  color: "white"
                }}>
                  {ticket.status || "open"}
                </span>
                {ticket.hasRecentErrors && (
                  <span style={{ color: "#f44336", fontSize: "0.8rem" }}>⚠️</span>
                )}
                {newAssignments.has(ticket.id) && (
                  <span style={{ color: "#4caf50", fontSize: "0.8rem" }}>🔔</span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>
                {ticket.lastMessage && (
                  <div style={{ marginBottom: "0.25rem" }}>
                    "{ticket.lastMessage.length > 50 ? ticket.lastMessage.substring(0, 50) + "..." : ticket.lastMessage}"
                  </div>
                )}
                {ticket.updatedAt
                  ? new Date(ticket.updatedAt.seconds * 1000).toLocaleString()
                  : ""}
                {ticket.hasRecentErrors && (
                  <span style={{ color: "#f44336", marginLeft: "0.5rem" }}>
                    (Recent delivery error)
                  </span>
                )}
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div style={{
              padding: "3rem 2rem",
              textAlign: "center",
              color: "#666",
              maxWidth: "500px",
              margin: "0 auto"
            }}>
              <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>📭</div>
              <h3 style={{
                margin: "0 0 1rem 0",
                color: "#333",
                fontSize: "1.3rem",
                fontWeight: "600"
              }}>
                No Active Conversations
              </h3>
              <p style={{
                margin: "0 0 1.5rem 0",
                fontSize: "1rem",
                lineHeight: "1.5"
              }}>
                You currently have no tickets assigned to you. New conversations will appear here when assigned by your administrators.
              </p>

              <div style={{
                backgroundColor: "#f8f9fa",
                padding: "1.5rem",
                borderRadius: "8px",
                border: "1px solid #e9ecef"
              }}>
                <h4 style={{
                  margin: "0 0 0.5rem 0",
                  color: "#495057",
                  fontSize: "1rem"
                }}>
                  💡 What happens next?
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: "1.5rem",
                  textAlign: "left",
                  color: "#6c757d",
                  fontSize: "0.9rem"
                }}>
                  <li>Administrators assign conversations to team members</li>
                  <li>You'll receive notifications for new assignments</li>
                  <li>Check back regularly or your admin will notify you</li>
                  <li>You can also check your dashboard for company updates</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f2f2f7",
          position: "relative"
        }}
      >
        {/* Mobile Header */}
        {isMobile && (
          <div style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e5ea",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                backgroundColor: "transparent",
                border: "none",
                padding: "0.5rem",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>☰</span>
            </button>
            <div style={{
              fontSize: "1.125rem",
              fontWeight: "600",
              color: "#1d1d1f",
              flex: 1
            }}>
              {selectedTicket ? (selectedTicket.customerId?.split('@')[0] || 'Customer') : 'My Inbox'}
            </div>
            <button
              onClick={() => router.push('/user-dashboard')}
              style={{
                backgroundColor: "transparent",
                border: "1px solid #e5e5ea",
                padding: "0.4rem 0.6rem",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#007aff",
                fontSize: "0.9rem",
                gap: "0.3rem",
                whiteSpace: "nowrap"
              }}
              title="Back to dashboard"
            >
              <span style={{ fontSize: "1rem" }}>←</span>
                <span>Dashboard</span>
            </button>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                padding: "0.4rem 0.6rem",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                gap: "0.2rem"
              }}
              title="Logout"
            >
              🚪
            </button>
          </div>
        )}

        {/* Desktop Header */}
        {!isMobile && selectedTicket && (
          <div style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e5ea",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <div style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#1d1d1f",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flex: 1,
              minWidth: 0
            }}>
              {selectedTicket.customerId?.split('@')[0] || 'Customer'}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={() => router.push('/user-dashboard')}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  backgroundColor: "#ffffff",
                  color: "#007aff",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  whiteSpace: "nowrap"
                }}
                title="Back to dashboard"
              >
                ← Dashboard
              </button>
              {customerHistory.length > 0 && (
                <button
                  onClick={() => setShowHistorySection(!showHistorySection)}
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.5rem 0.9rem",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    backgroundColor: showHistorySection ? "#f44336" : "#4caf50",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    whiteSpace: "nowrap"
                  }}
                  title={showHistorySection ? "Hide previous conversations" : "Show previous conversations"}
                >
                  {showHistorySection ? "👁️ Hide History" : "📚 Show History"}
                </button>
              )}
              <button
                onClick={handleLogout}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid #f44336",
                  backgroundColor: "#ffeaea",
                  color: "#f44336",
                  cursor: "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  whiteSpace: "nowrap"
                }}
                title="Logout"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}

        {/* Admin Header for Empty State */}
        {!isMobile && tickets.length === 0 && isAdmin && (
          <div style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e5ea",
            padding: "1rem 2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              maxWidth: "100%"
            }}>
              <h1 style={{ color: '#1976d2', margin: 0, fontSize: '1.5rem' }}>Axion</h1>
              <span style={{ color: '#666' }}>|</span>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>My Inbox</span>
            </div>

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
                  backgroundColor: '#4caf50',
                  color: 'white',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {company.name} • ADMIN
                </span>
              )}
              <button
                onClick={() => router.push('/user-dashboard')}
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
                onClick={() => router.push('/settings')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⚙️ Settings
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
          </div>
        )}

        {/* Messages Area - Same as before but simplified */}
        <div style={{
          overflowY: showHistorySection ? "auto" : "visible",
          padding: isMobile ? "1rem 1rem" : "1.25rem 1.5rem",
          display: isMobile && !showHistorySection ? "flex" : "block",
          flexDirection: "column",
          gap: "0.5rem",
          height: isMobile && showHistorySection ? "100vh" : "auto"
        }}>

          {/* Customer History Section */}
          {customerHistory.length > 0 && showHistorySection && (
            <div style={{
              backgroundColor: "transparent",
              borderRadius: 0,
              padding: 0,
              marginBottom: "0.5rem",
              border: "none",
              width: "100%",
              maxHeight: "none",
              overflowY: "visible"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: "0.5rem",
                gap: "0.5rem",
                textAlign: "center"
              }}>
                <h3 style={{
                  margin: "0",
                  fontSize: "0.9rem",
                  color: "#666",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  justifyContent: "center"
                }}>
                  📚 Previous Conversations with {selectedTicket?.customerId || 'Unknown'}
                </h3>
              </div>

              {customerHistory.map((historyTicket) => {
                const isExpanded = expandedHistory.has(historyTicket.id);
                const ticketMessages = historicalMessages[historyTicket.id] || [];

                return (
                  <div
                    key={historyTicket.id}
                    style={{
                      marginBottom: "0.75rem"
                    }}
                  >
                    <div
                      style={{
                        padding: "0.5rem 0.25rem",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                      onClick={() => {
                        setExpandedHistory(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(historyTicket.id)) {
                            newSet.delete(historyTicket.id);
                          } else {
                            newSet.add(historyTicket.id);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.25rem"
                        }}>
                          <span style={{
                            fontSize: "0.8rem",
                            color: "#666",
                            fontWeight: "500"
                          }}>
                            Ticket #{historyTicket.id.slice(-8)} • {historyTicket.messageCount} messages
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{
                              fontSize: "0.7rem",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "10px",
                              backgroundColor: historyTicket.status === "closed" ? "#4caf50" : "#ff9800",
                              color: "white"
                            }}>
                              {historyTicket.status}
                            </span>
                            <span style={{
                              fontSize: "0.8rem",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s"
                            }}>
                              ▼
                            </span>
                          </div>
                        </div>
                        <div style={{
                          fontSize: "0.75rem",
                          color: "#888"
                        }}>
                          {historyTicket.updatedAt ? new Date(historyTicket.updatedAt.seconds * 1000).toLocaleString() : ""}
                        </div>
                        {!isExpanded && historyTicket.firstMessage && (
                          <div style={{
                            fontSize: "0.75rem",
                            color: "#555",
                            marginTop: "0.25rem",
                            fontStyle: "italic"
                          }}>
                            "{historyTicket.firstMessage}"
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div>
                        {ticketMessages.map((msg) => {
                          const isAgentMessage = msg.role === "agent";
                          const isSystemMessage = msg.from === "System";
                          const isAIMessage =
                            !isSystemMessage &&
                            (msg.role === 'assistant' ||
                             msg.role === 'ai' ||
                             (typeof msg.from === 'string' && msg.from.toLowerCase().includes('ai')));

                          return (
                            <div
                              key={msg.id}
                              style={{
                                display: "flex",
                                justifyContent: isAgentMessage ? "flex-end" : "flex-start",
                                padding: "0.35rem 0.5rem",
                                fontSize: "0.8rem"
                              }}
                            >
                              <div style={{
                                maxWidth: isMobile ? "80%" : "65%",
                                backgroundColor: isAgentMessage
                                  ? "#dcf8c6"
                                  : isSystemMessage
                                    ? "#ffeef0"
                                    : isAIMessage
                                      ? "#fff4e5"
                                      : "#ffffff",
                                color: "#111b21",
                                padding: "0.6rem 0.75rem",
                                borderRadius: isAgentMessage
                                  ? "16px 16px 4px 16px"
                                  : "16px 16px 16px 4px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                border: "1px solid rgba(0,0,0,0.06)",
                                wordBreak: "break-word"
                              }}>
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  marginBottom: "0.25rem"
                                }}>
                                  <strong style={{
                                    color: isSystemMessage
                                      ? "#c62828"
                                      : isAgentMessage
                                        ? "#075e54"
                                        : isAIMessage
                                          ? "#b26a00"
                                          : "#666",
                                    fontSize: "0.75rem"
                                  }}>
                                    {msg.from}
                                  </strong>
                                  <span style={{
                                    fontSize: "0.7rem",
                                    color: "#999"
                                  }}>
                                    {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleString() : ""}
                                  </span>
                                </div>
                                {renderMessageContent(msg)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            marginTop: "0.5rem",
            paddingRight: "0.5rem",
            paddingBottom: isMobile ? "6rem" : "1rem",
          }}
        >
          {selectedTicket ? (
            <div>
              {customerHistory.length > 0 && messages.length > 0 && (!isMobile || showHistorySection) && (
                <div style={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "0",
                  padding: "0.5rem 0",
                  margin: "0 0 0.75rem 0",
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "#333"
                }}>
                  <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                    🔄 New Conversation Started
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    {selectedTicket?.createdAt ? new Date(selectedTicket.createdAt.seconds * 1000).toLocaleString() : ''}
                    {selectedTicket?.customerId && (!isMobile || showHistorySection) && (
                      <span> • Previous conversations available above</span>
                    )}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isAgentMessage = msg.role === 'agent';
                const isSystemMessage = msg.from === "System";
                const isAIMessage =
                  !isSystemMessage &&
                  (msg.role === 'assistant' ||
                   msg.role === 'ai' ||
                   (typeof msg.from === 'string' && msg.from.toLowerCase().includes('ai')));
                const hasContent = msg.body || msg.hasMedia;

                // Determine message type for appropriate padding
                const hasImage = msg.hasMedia && msg.media?.some(m => m.contentType?.startsWith('image/'));
                const hasAudio = msg.hasMedia && msg.media?.some(m => m.contentType?.startsWith('audio/'));
                const hasVideo = msg.hasMedia && msg.media?.some(m => m.contentType?.startsWith('video/'));
                const hasDocument = msg.hasMedia && msg.media?.some(m => 
                  !m.contentType?.startsWith('image/') && 
                  !m.contentType?.startsWith('audio/') && 
                  !m.contentType?.startsWith('video/')
                );
                const isTextOnly = msg.body && !msg.hasMedia;

                // Set padding and border radius based on content type
                let bubblePadding;
                let bubbleBorderRadius;
                
                if (hasImage || hasVideo) {
                  // Minimal padding for images and videos
                  bubblePadding = isMobile ? "0.2rem" : "0.15rem";
                  // Reduced curve for media
                  bubbleBorderRadius = isAgentMessage ? "12px 12px 3px 12px" : "12px 12px 12px 3px";
                } else if (hasAudio) {
                  // Medium padding for voice notes
                  bubblePadding = isMobile ? "0.5rem" : "0.4rem";
                  bubbleBorderRadius = isAgentMessage ? "14px 14px 3px 14px" : "14px 14px 14px 3px";
                } else if (hasDocument) {
                  // Good padding for documents
                  bubblePadding = isMobile ? "0.75rem" : "0.65rem";
                  bubbleBorderRadius = isAgentMessage ? "14px 14px 3px 14px" : "14px 14px 14px 3px";
                } else {
                  // Standard padding for text
                  bubblePadding = isMobile ? "0.5rem 0.75rem" : "0.45rem 0.65rem";
                  bubbleBorderRadius = isAgentMessage ? "16px 16px 4px 16px" : "16px 16px 16px 4px";
                }

                if (!hasContent) return null;

                return (
                  <div key={msg.id} style={{
                    display: "flex",
                    marginBottom: "0.3rem",
                    justifyContent: isAgentMessage ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    gap: "0.25rem"
                  }}>
                    <div style={{
                      maxWidth: isMobile ? "280px" : "400px",
                      backgroundColor: isAgentMessage
                        ? "#dcf8c6"
                        : isSystemMessage
                          ? "#ffeef0"
                          : isAIMessage
                            ? "#fff4e5"
                            : "#ffffff",
                      color: "#111b21",
                      padding: bubblePadding,
                      borderRadius: bubbleBorderRadius,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                      position: "relative",
                      wordWrap: "break-word",
                      animation: "slideIn 0.3s ease-out",
                      border: isSystemMessage
                        ? "1px solid #ffccd1"
                        : isAIMessage
                          ? "1px solid #ffd8a8"
                          : "1px solid rgba(0,0,0,0.06)",
                      backdropFilter: "blur(10px)",
                      fontSize: isMobile ? "13px" : "14px",
                      lineHeight: isMobile ? "18px" : "20px",
                      marginLeft: !isAgentMessage ? (isMobile ? "5px" : "15px") : 0,
                      marginRight: isAgentMessage ? (isMobile ? "5px" : "15px") : 0
                    }}>
                      {isSystemMessage && (
                        <div style={{
                          fontSize: "0.8125rem",
                          fontWeight: "600",
                          color: "#c62828",
                          marginBottom: "0.25rem"
                        }}>
                          {msg.from}
                        </div>
                      )}

                      {renderMessageContent(msg)}

                      {msg.errorCode && (
                        <div style={{
                          fontSize: "0.75rem",
                          marginTop: "0.25rem",
                          color: "#ff3b30",
                          opacity: 0.8
                        }}>
                          Error: {msg.errorCode}
                        </div>
                      )}

                      {/* Delivery Status Indicator for Agent Messages */}
                      {isAgentMessage && msg.deliveryStatus && (
                        <div style={{
                          fontSize: "0.65rem",
                          marginTop: "0.25rem",
                          color: "#666",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          justifyContent: "flex-end"
                        }}>
                          {msg.deliveryStatus === 'delivered' && <span>✓✓</span>}
                          {msg.deliveryStatus === 'read' && <span style={{ color: "#34b7f1" }}>✓✓</span>}
                          {msg.deliveryStatus === 'sent' && <span>✓</span>}
                          {msg.deliveryStatus === 'failed' && <span style={{ color: "#ff3b30" }}>✗</span>}
                          {msg.deliveryStatus === 'undelivered' && <span style={{ color: "#ff9800" }}>!</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            tickets.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60vh",
                color: "#666",
                textAlign: "center",
                padding: "2rem"
              }}>
                <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>📭</div>
                <h3 style={{ margin: "0 0 1rem 0", color: "#333" }}>No Active Conversations</h3>
                <p style={{ margin: "0 0 1.5rem 0", fontSize: "1rem", lineHeight: "1.5" }}>
                  You currently have no tickets assigned to you. New conversations will appear here when assigned by your administrators.
                </p>
                <div style={{
                  backgroundColor: "#f8f9fa",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                  maxWidth: "400px"
                }}>
                  <h4 style={{
                    margin: "0 0 0.5rem 0",
                    color: "#495057",
                    fontSize: "1rem"
                  }}>
                    💡 What happens next?
                  </h4>
                  <ul style={{
                    margin: 0,
                    paddingLeft: "1.5rem",
                    textAlign: "left",
                    color: "#6c757d",
                    fontSize: "0.9rem"
                  }}>
                    <li>Administrators assign conversations to team members</li>
                    <li>You'll receive notifications for new assignments</li>
                    <li>Check back regularly or your admin will notify you</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60vh",
                color: "#666",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</div>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "#333" }}>Select a conversation</h3>
                <p>Choose a ticket from the sidebar to start chatting with customers.</p>
              </div>
            )
          )}
        </div>

        {/* Chat Input */}
        {selectedTicket && (
          <div style={{
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e5e5ea",
            padding: isMobile ? "1rem 0.5rem" : "1rem",
            position: isMobile ? "fixed" : "relative",
            bottom: 0,
            left: isMobile ? (sidebarOpen ? "280px" : 0) : 0,
            right: 0,
            width: isMobile ? (sidebarOpen ? "calc(100vw - 280px)" : "100vw") : "auto",
            transition: isMobile ? "left 0.3s ease" : "none",
            zIndex: 100
          }}>
            {mediaPreview && (
              <div style={{
                marginBottom: "1rem",
                padding: "1rem",
                backgroundColor: "#f2f2f7",
                borderRadius: "12px",
                border: "1px solid #e5e5ea",
                maxWidth: isMobile ? "280px" : "400px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}>
                {mediaPreview.type === 'image' && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={mediaPreview.url}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "200px",
                        borderRadius: "4px",
                        border: "1px solid #e9ecef"
                      }}
                    />
                    <div style={{
                      marginTop: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#6c757d",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span>🖼️ {mediaPreview.file.name}</span>
                      <button
                        onClick={clearMedia}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc3545",
                          cursor: "pointer",
                          fontSize: "1.2rem",
                          padding: "0"
                        }}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {mediaPreview.type === 'audio' && !mediaPreview.isRecording && (
                  <div>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem"
                    }}>
                      <span style={{ fontSize: "1.2rem" }}>🎵</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: "bold" }}>Audio File</span>
                    </div>
                    <audio
                      controls
                      style={{
                        width: "100%",
                        maxWidth: "250px",
                        borderRadius: "4px"
                      }}
                    >
                      <source src={mediaPreview.url} type={mediaPreview.file.type} />
                      Audio playback not supported
                    </audio>
                    <div style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                        {(mediaPreview.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <button
                        onClick={clearMedia}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc3545",
                          cursor: "pointer",
                          fontSize: "1.2rem"
                        }}
                        title="Remove audio"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {mediaPreview.type === 'video' && (
                  <div>
                    <video
                      controls
                      style={{
                        width: "100%",
                        maxWidth: "250px",
                        borderRadius: "4px",
                        border: "1px solid #e9ecef"
                      }}
                    >
                      <source src={mediaPreview.url} type={mediaPreview.file.type} />
                      Video playback not supported
                    </video>
                    <div style={{
                      marginTop: "0.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        🎥 {(mediaPreview.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <button
                        onClick={clearMedia}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc3545",
                          cursor: "pointer",
                          fontSize: "1.2rem"
                        }}
                        title="Remove video"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {mediaPreview.type === 'document' && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem"
                  }}>
                    <span style={{ fontSize: "2rem" }}>
                      {mediaPreview.file.name.toLowerCase().endsWith('.pdf') ? '📕' :
                       mediaPreview.file.name.toLowerCase().endsWith('.doc') || mediaPreview.file.name.toLowerCase().endsWith('.docx') ? '📄' :
                       mediaPreview.file.name.toLowerCase().endsWith('.vcf') ? '👤' : '📎'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "bold" }}>
                        {mediaPreview.file.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {(mediaPreview.file.size / 1024 / 1024).toFixed(2)} MB • {mediaPreview.file.type || 'Document'}
                      </div>
                    </div>
                    <button
                      onClick={clearMedia}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc3545",
                        cursor: "pointer",
                        fontSize: "1.2rem"
                      }}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={handleSendAgentMessage}
              style={{
                display: "flex",
                gap: isMobile ? "0.25rem" : "0.5rem",
                alignItems: "center",
                backgroundColor: "#ffffff",
                padding: isMobile ? "0.5rem" : "0.75rem",
                borderRadius: "24px",
                border: "1px solid #e5e5ea",
                marginTop: mediaPreview ? "0" : "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                flexWrap: isMobile ? "wrap" : "nowrap",
                maxWidth: "100%",
                boxSizing: "border-box"
              }}
            >
              <label style={{
                cursor: "pointer",
                fontSize: isMobile ? "1rem" : "1.25rem",
                padding: isMobile ? "0.25rem" : "0.5rem",
                borderRadius: "50%",
                width: isMobile ? "32px" : "36px",
                height: isMobile ? "32px" : "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s ease",
                flexShrink: 0
              }}
              title="Attach file"
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f2f2f7"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                📎
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt,.vcf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const isImage = file.type.startsWith('image/');
                      const isAudio = file.type.startsWith('audio/');
                      const isVideo = file.type.startsWith('video/');
                      const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text');
                      const isContact = file.name.toLowerCase().endsWith('.vcf');

                      let maxSize = 1024 * 1024;

                      if (isImage) {
                        maxSize = 1024 * 1024;
                      } else if (isVideo) {
                        maxSize = 5 * 1024 * 1024;
                      } else if (isDocument) {
                        maxSize = 10 * 1024 * 1024;
                      }

                      if (isAudio) {
                        alert("Audio files cannot be sent from the app. You can still receive and play audio messages.");
                        return;
                      }

                      if (file.size > maxSize) {
                        const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
                        alert(`File size must be less than ${sizeMB}MB for ${isImage ? 'images' : isVideo ? 'video files' : 'documents'}`);
                        return;
                      }

                      if (!isImage && !isVideo && !isDocument && !isContact) {
                        alert("Unsupported file type. Please use images, video, documents, or contact files.");
                        return;
                      }

                      handleMediaSelect(file);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  fontSize: isMobile ? "1rem" : "1.2rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: isMobile ? "0.125rem" : "0.25rem",
                  flexShrink: 0
                }}
              >
                😀
              </button>

              <input
                type="text"
                placeholder="Type your message..."
                value={agentMessage}
                onChange={(e) => setAgentMessage(e.target.value)}
                style={{
                  flex: 1,
                  padding: isMobile ? "0.5rem 0.75rem" : "0.75rem 1rem",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor: "#f2f2f7",
                  fontSize: isMobile ? "0.9rem" : "1rem",
                  outline: "none",
                  fontFamily: "inherit",
                  minWidth: 0,
                  boxSizing: "border-box"
                }}
              />

              <button
                type="submit"
                disabled={isSending || (!agentMessage.trim() && !selectedMedia)}
                style={{
                  width: isMobile ? "32px" : "36px",
                  height: isMobile ? "32px" : "36px",
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: (!agentMessage.trim() && !selectedMedia) ? "#8e8e93" : "#007aff",
                  color: "white",
                  cursor: (!agentMessage.trim() && !selectedMedia) ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMobile ? "0.9rem" : "1rem",
                  transition: "all 0.2s ease",
                  boxShadow: (!agentMessage.trim() && !selectedMedia) ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
                  opacity: isSending ? 0.7 : 1,
                  flexShrink: 0
                }}
              >
                {isSending ? "⏳" : "➤"}
              </button>
            </form>

            {showEmojiPicker && (
              <div style={{
                position: "absolute",
                bottom: "70px",
                right: "20px",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e5ea",
                borderRadius: "16px",
                padding: "1rem",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                zIndex: 1000,
                maxWidth: "300px"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.25rem" }}>
                  {["😀", "😂", "❤️", "👍", "👋", "🎉", "🔥", "⭐", "✅", "❌", "📱", "💬", "📎", "🎵", "📹", "📄", "👤", "📍", "⏰", "💡", "🎯", "🚀", "💪", "🙏"].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setAgentMessage(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "1.5rem",
                        cursor: "pointer",
                        padding: "0.25rem",
                        borderRadius: "4px"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#f2f2f7"}
                      onMouseOut={(e) => e.target.style.backgroundColor = "transparent"}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}