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
  deleteDoc,
  getDoc,
  getDocs,
  where,
  limit,
} from "firebase/firestore";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";

export default function InboxPage() {
  const { user, company, loading, userRole, userCompanies, respondentCompanies, selectedCompanyId, selectCompanyContext, updateRespondentStatus, updateAdminStatus } = useAuth();
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
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [newAssignments, setNewAssignments] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [debugMode, setDebugMode] = useState(false); // Temporary debug mode
  const [loadingError, setLoadingError] = useState(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(new Set()); // Track which historical tickets are expanded
  const [showCumulativeHistory, setShowCumulativeHistory] = useState(false); // Toggle for cumulative view
  const [showHistorySection, setShowHistorySection] = useState(false); // Toggle for showing history section (hidden by default)
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);


  // Mobile responsiveness (must be declared before any early returns)
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
    setRecordedAudio(null); // Clear any recorded audio
    setMediaRecorder(null);
    setIsRecording(false);

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
  // Component to handle media rendering with Firebase Storage URLs
  const MediaImage = ({ media, index }) => {
    console.log('🎨 MediaImage component rendered for media:', media, 'index:', index);
    const [imageUrl, setImageUrl] = useState(media.url);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      console.log('Processing media URL:', media.url);
      // If it's a Firebase Storage URL, try to get the download URL
      if (media.url.includes('firebasestorage.googleapis.com')) {
        try {
          console.log('Detected Firebase Storage URL, attempting to get download URL');
          const storage = getStorage();
          // Extract the path from the Firebase Storage URL
          const urlParts = media.url.split('/o/')[1]?.split('?')[0];
          console.log('URL parts:', urlParts);
          if (urlParts) {
            const decodedPath = decodeURIComponent(urlParts);
            console.log('Decoded path:', decodedPath);
            const storageRef = ref(storage, decodedPath);
            console.log('Storage ref created:', storageRef);
            getDownloadURL(storageRef).then((url) => {
              console.log('Got download URL:', url);
              setImageUrl(url);
              setLoading(false);
            }).catch((err) => {
              console.error('Failed to get download URL:', err);
              console.error('Error details:', err.message, err.code);
              // Fallback to original URL if Firebase SDK fails
              console.log('Falling back to original URL');
              setImageUrl(media.url);
              setLoading(false);
            });
          } else {
            console.log('No URL parts found, using original URL');
            setLoading(false);
          }
        } catch (err) {
          console.error('Error with Firebase Storage setup:', err);
          // Fallback to original URL
          setImageUrl(media.url);
          setLoading(false);
        }
      } else {
        console.log('Not a Firebase Storage URL, using as-is');
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

    if (error) {
      return (
        <div key={`media-${index}`} style={{ marginBottom: '0.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          🖼️ Image attachment (could not load)
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
          onError={(e) => {
            console.error('Failed to load image:', imageUrl);
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div style={{ display: 'none', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginTop: '0.5rem' }}>
          🖼️ Image attachment (could not load)
        </div>
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    console.log('📝 renderMessageContent called for message:', msg.id, 'hasMedia:', msg.hasMedia, 'media:', msg.media);

    // Special case: voice note that has been stored but is still converting on the backend.
    // These messages have a voiceNotePath, hasMedia true, but media is null/empty
    // until the Cloud Function + retry job attach the final OGG URL.
    if (msg.voiceNotePath && (!msg.media || (Array.isArray(msg.media) && msg.media.length === 0))) {
      return (
        <div key="voice-note-pending" />
      );
    }

    // If message has both media and text, combine them inline
    if (msg.hasMedia && msg.media && msg.body) {
      const combinedContent = [];

      // Add text first
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

      // Add media inline
      msg.media.forEach((media, index) => {
        const mediaType = media.contentType || '';
        const isImage = mediaType.startsWith('image/');
        const isAudio = mediaType.startsWith('audio/');

        if (isImage) {
          console.log('🎴 Rendering inline image media:', media);
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
                marginRight: '0.5rem',
                verticalAlign: 'middle'
              }}
              onClick={() => window.open(media.url, '_blank')}
              onLoad={() => console.log('✅ Image loaded successfully:', media.url)}
              onError={(e) => {
                console.error('❌ Image failed to load:', media.url, e);
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline';
              }}
            />
          );
          combinedContent.push(
            <span key={`error-${index}`} style={{
              display: 'none',
              color: '#666',
              fontSize: '0.8rem',
              marginRight: '0.5rem'
            }}>
              🖼️ [Image]
            </span>
          );
        } else if (isAudio) {
          combinedContent.push(
            <span key={`audio-${index}`} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#f0f8ff',
              border: '1px solid #1976d2',
              borderRadius: '4px',
              padding: '0.25rem 0.5rem',
              marginRight: '0.5rem',
              fontSize: '0.8rem'
            }}>
              <span>🎵</span>
              <audio controls style={{ height: '20px', width: '120px' }}>
                <source src={media.url} type={mediaType} />
                Voice note
              </audio>
            </span>
          );
        }
      });

      return combinedContent;
    }

    // For media-only messages
    if (msg.hasMedia && msg.media && !msg.body) {
      const content = [];
      msg.media.forEach((media, index) => {
        const mediaType = media.contentType || '';
        const isImage = mediaType.startsWith('image/');
        const isAudio = mediaType.startsWith('audio/');
        const isVideo = mediaType.startsWith('video/');
        const isDocument = mediaType.includes('pdf') || mediaType.includes('document') || mediaType.includes('text');
        const isContact = mediaType.includes('vcf') || media.url.includes('.vcf');

        if (isImage) {
          console.log('🎴 Rendering image media:', media);
          content.push(
            <div key={`media-${index}`} style={{ marginBottom: '0.5rem' }}>
              <img
                src={media.url}
                alt="Image attachment"
                style={{
                  maxWidth: '250px',
                  maxHeight: '250px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(media.url, '_blank')}
                onLoad={() => console.log('✅ Image loaded successfully:', media.url)}
                onError={(e) => {
                  console.error('❌ Image failed to load:', media.url, e);
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginTop: '0.5rem' }}>
                🖼️ Image failed to load: {media.url}
              </div>
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
              <audio
                controls
                style={{ width: '100%' }}
                onError={(e) => {
                  console.error('❌ Audio failed to load:', media.url, e);
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
                onLoadStart={() => console.log('🎵 Audio started loading:', media.url)}
                onCanPlay={() => console.log('✅ Audio can play:', media.url)}
              >
                <source src={media.url} type={mediaType} />
                Your browser does not support audio playback.
              </audio>
              <div style={{ display: 'none', padding: '0.5rem', backgroundColor: '#ffeaea', borderRadius: '4px', marginTop: '0.5rem', fontSize: '0.8rem', color: '#d32f2f' }}>
                🎵 Audio failed to load
              </div>
            </div>
          );
        } else if (isVideo) {
          content.push(
            <div key={`media-${index}`} style={{ marginBottom: '0.5rem' }}>
              <video controls style={{ maxWidth: '250px', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                <source src={media.url} type={mediaType} />
                🎥 Video message (playback not supported)
              </video>
            </div>
          );
        } else if (isContact) {
          content.push(
            <div key={`media-${index}`} style={{
              marginBottom: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#e8f5e8',
              border: '1px solid #4caf50',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>👤</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Contact Card</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  <a href={media.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4caf50', textDecoration: 'none' }}>
                    Download VCF file
                  </a>
                </div>
              </div>
            </div>
          );
        } else if (media.error) {
          // Handle media download errors
          content.push(
            <div key={`media-${index}`} style={{
              marginBottom: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#856404' }}>
                📎 Media attachment ({media.contentType})
              </div>
              <div style={{ fontSize: '0.75rem', color: '#856404', marginTop: '0.25rem' }}>
                {media.error === 'Company Twilio credentials missing' ?
                  'Media could not be displayed - Twilio credentials not configured for this company' :
                  media.warning || 'Media could not be loaded'
                }
              </div>
            </div>
          );
        } else {
          // Document or other file
          const fileIcon = mediaType.includes('pdf') ? '📕' :
                          mediaType.includes('word') || mediaType.includes('document') ? '📄' :
                          '📎';

          content.push(
            <div key={`media-${index}`} style={{
              marginBottom: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              maxWidth: '250px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>{fileIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                  {mediaType.split('/')[1]?.toUpperCase() || 'File'} Document
                </div>
                <div style={{ fontSize: '0.75rem' }}>
                  <a href={media.url} target="_blank" rel="noopener noreferrer" style={{ color: '#856404', textDecoration: 'none' }}>
                    Download file
                  </a>
                </div>
              </div>
            </div>
          );
        }
      });
      return content;
    }

    // For text-only messages
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

    // Fallback for old messages without proper structure
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

  // Loading timeout - show error if page doesn't load within 30 seconds
  useEffect(() => {
    if (!loading) return; // Don't set timeout if not loading

    console.log('Starting loading timeout timer...');

    const timeout = setTimeout(() => {
      console.error('Inbox loading timeout - page stuck in loading state');
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      console.log('Auth loading state:', loading);
      console.log('Company:', company ? 'Loaded' : 'Not loaded');
      console.log('User:', user ? user.email : 'Not logged in');

      setLoadingTimeout(true);
      setLoadingError('Loading timeout. Please check your internet connection and refresh the page.');
    }, 30000); // 30 seconds

    return () => {
      console.log('Clearing loading timeout');
      clearTimeout(timeout);
    };
  }, [loading, company, user]);

  // Set initial online status for respondents
  useEffect(() => {
    if (isRespondent && !loading && user?.email) {
      console.log(`🟢 [${new Date().toISOString()}] Setting respondent ${user.email} as online initially`);
      // Track if they were previously offline to know when they come online
      const wasOffline = !isOnline;
      // Don't await - fire and forget to prevent blocking
      updateRespondentStatus(true, wasOffline).catch(error => {
        console.error('Failed to set initial online status:', error);
      });
      setIsOnline(true);

      // Set up periodic online status updates every 1.5 minutes (90 seconds)
      const interval = setInterval(() => {
        if (isOnline) {
          updateRespondentStatus(true, false).catch(error => {
            console.error('Failed to update periodic online status:', error);
          });
        }
      }, 90000); // 90 seconds (1.5 minutes)

      return () => clearInterval(interval);
    }
  }, [isRespondent, loading, user?.email]); // Removed updateRespondentStatus from deps to prevent loops

  // Update online status when it changes
  useEffect(() => {
    if (isRespondent && !loading) {
      // Don't await - fire and forget to prevent blocking
      updateRespondentStatus(isOnline).catch(error => {
        console.error('Failed to update online status:', error);
      });
    }
  }, [isOnline, isRespondent, loading]); // Removed updateRespondentStatus from deps

  // Handle page visibility changes for auto online/offline status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isRespondent) {
        setIsOnline(!document.hidden);
      }
    };

    const handleBeforeUnload = () => {
      if (isRespondent) {
        updateRespondentStatus(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRespondent, updateRespondentStatus]);

  // Function to show browser notification
  const showAssignmentNotification = (ticket) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('New Ticket Assigned', {
        body: `You have been assigned a new ticket from ${ticket.customerId || 'Unknown'}`,
        icon: '/favicon.ico',
        tag: `ticket-${ticket.id}` // Prevents duplicate notifications
      });

      notification.onclick = () => {
        window.focus();
        setSelectedTicket(ticket);
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // If user is logged in but no company context, redirect to appropriate place
    if (!loading && user && (!company || !selectedCompanyId)) {
      const allCompanies = [...userCompanies, ...respondentCompanies];
      if (allCompanies.length === 0) {
        router.push('/onboarding');
      } else if (allCompanies.length > 1) {
        router.push('/select-company');
      } else if (allCompanies.length === 1) {
        // Auto-select single company
        const selectedCompany = allCompanies[0];
        selectCompanyContext(selectedCompany.id, selectedCompany.userRole)
          .then(() => {
            console.log('Auto-selected company in inbox');
          })
          .catch(error => {
            console.error('Failed to auto-select company:', error);
            router.push('/select-company');
          });
      }
    }
  }, [user, loading, company, selectedCompanyId, userCompanies, respondentCompanies, router, selectCompanyContext]);

  const tenantId = company?.id;

  console.log('Inbox render - Company:', company ? 'Loaded' : 'Not loaded');
  console.log('Inbox render - Tenant ID:', tenantId);

  useEffect(() => {
    if (!tenantId) {
      console.log('Inbox: No tenant ID, skipping conversation loading');
      return;
    }

    const ticketsRef = collection(db, "companies", tenantId, "tickets");
    let q = query(ticketsRef, orderBy("updatedAt", "desc"));

    console.log('Loading conversations for:', {
      tenantId,
      userRole,
      userEmail: user?.email,
      isAdmin,
      isRespondent
    });

    // For respondents, only show tickets assigned to them (unless in debug mode)
    if (isRespondent && user?.email && !debugMode) {
      console.log('Filtering tickets for respondent:', user.email);
      try {
        q = query(ticketsRef,
          where("assignedEmail", "==", user.email),
          orderBy("updatedAt", "desc")
        );
        console.log('Query created for respondent email:', user.email);
      } catch (error) {
        console.error('Error creating query for respondent:', error);
        // Fallback: show all tickets for debugging
        q = query(ticketsRef, orderBy("updatedAt", "desc"));
        console.log('Fallback: showing all tickets due to query error');
      }
    } else if (isRespondent && !debugMode) {
      console.log('Respondent but no email found:', user);
      // Fallback for respondents without email
      q = query(ticketsRef, orderBy("updatedAt", "desc"));
    }
    // In debug mode or for admins, show all conversations

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const ticketsWithErrors = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const ticketData = { id: doc.id, ...doc.data() };

            try {
              // Check if this ticket has any error messages
              const messagesRef = collection(db, "companies", tenantId, "tickets", doc.id, "messages");
              const errorQuery = query(messagesRef, where("error", "==", true), limit(1));
              const errorSnapshot = await getDocs(errorQuery);

              ticketData.hasErrors = !errorSnapshot.empty;
            } catch (error) {
              console.error(`Error checking messages for ticket ${doc.id}:`, error);
              ticketData.hasErrors = false;
            }

            return ticketData;
          })
        );

        // Check for new assignments and show notifications
        const previousTicketIds = new Set(tickets.map(t => t.id));
        const newTickets = ticketsWithErrors.filter(ticket =>
          !previousTicketIds.has(ticket.id) &&
          (isAdmin || (isRespondent && ticket.assignedEmail === user.email))
        );

        // Show notifications for new assignments
        newTickets.forEach(ticket => {
          console.log('New ticket detected:', {
            id: ticket.id,
            assignedTo: ticket.assignedTo,
            assignedEmail: ticket.assignedEmail,
            isRespondent,
            userEmail: user?.email
          });

          if (isRespondent && ticket.assignedEmail === user.email) {
            console.log('Showing notification for respondent assignment');
            showAssignmentNotification(ticket);
            setNewAssignments(prev => new Set([...prev, ticket.id]));
          }
        });

        console.log(`Loaded ${ticketsWithErrors.length} tickets:`,
          ticketsWithErrors.map(t => ({
            id: t.id,
            customerId: t.customerId,
            assignedTo: t.assignedTo,
            assignedEmail: t.assignedEmail,
            status: t.status
          }))
        );

        setTickets(ticketsWithErrors);
        // Auto-select latest ticket if none selected or previous selection no longer exists
        if ((!selectedTicket || !ticketsWithErrors.find(t => t.id === selectedTicket.id)) && ticketsWithErrors.length > 0) {
          setSelectedTicket(ticketsWithErrors[0]); // already ordered by updatedAt desc
        }
        setLoadingError(null); // Clear any previous errors on successful load
      } catch (error) {
        console.error('Error loading conversations:', error);
        setLoadingError('Failed to load conversations. Please check your connection.');
      }
    });

    return () => unsubscribe();
  }, [tenantId, isRespondent, user?.email, debugMode]);

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
        const loadedMessages = snapshot.docs.map((doc) => {
          const msgData = { id: doc.id, ...doc.data() };
          console.log('🔴 Real-time message loaded:', msgData.id, 'hasMedia:', msgData.hasMedia, 'media:', msgData.media);
          return msgData;
        });
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
          where("status", "in", ["closed", "pending"]), // Show closed and pending tickets
          orderBy("updatedAt", "desc")
        );

        const customerSnap = await getDocs(customerQuery);
        const historyTickets = customerSnap.docs
          .filter(doc => doc.id !== selectedTicket.id) // Exclude current ticket
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .slice(0, 3); // Limit to last 3 tickets to avoid overwhelming

        // Load ALL messages for each historical ticket
        const historyWithMessages = {};
        const historyTicketsData = await Promise.all(
          historyTickets.map(async (ticket) => {
            try {
              const ticketMessagesRef = collection(db, "companies", tenantId, "tickets", ticket.id, "messages");
              const allMessagesQuery = query(ticketMessagesRef, orderBy("createdAt", "asc"));
              const allMessagesSnap = await getDocs(allMessagesQuery);

              const ticketMessages = allMessagesSnap.docs.map(doc => {
                const msgData = { id: doc.id, ...doc.data() };
                console.log('📚 Historical message loaded:', msgData.id, 'hasMedia:', msgData.hasMedia, 'media:', msgData.media);
                return msgData;
              });

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
        // Hide history section by default whenever a new ticket is loaded
        setShowHistorySection(false);
      } catch (error) {
        console.error('Error loading customer history:', error);
        setCustomerHistory([]);
        setHistoricalMessages({});
      }
    };

    loadCustomerHistory();
  }, [selectedTicket, tenantId]);

  // Use API routes for all deployments
  const apiBase = "/api";

  console.log("API Base URL:", apiBase);
  console.log("NEXT_PUBLIC_API_BASE_URL:", process.env.NEXT_PUBLIC_API_BASE_URL);

  async function handleToggleAI() {
    if (!selectedTicket) return;
    try {
      setIsTogglingAI(true);
                  const current = selectedTicket?.aiEnabled !== false; // missing => true
      const enable = !current;

      const resp = await fetch(`${apiBase}/agent/toggle-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          convId: selectedTicket.id, // convId is actually ticketId in the new system
          enable,
          tenantId, // Pass tenant ID to API
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error("Error toggling AI:", txt);
        alert("Failed to toggle AI. Check API logs for details.");
      } else {
        setSelectedTicket({ ...selectedTicket, aiEnabled: enable });
      }
    } catch (err) {
      console.error("Error toggling AI:", err);
      alert("Failed to toggle AI for this ticket.");
    } finally {
      setIsTogglingAI(false);
    }
  }

  async function handleSendAgentMessage(e) {
    e?.preventDefault();
    if (!selectedTicket || (!agentMessage.trim() && !selectedMedia)) return;

    // Validate ticket still exists and user has access
    try {
      const ticketRef = doc(db, "companies", tenantId, "tickets", selectedTicket.id);
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) {
        console.error("❌ Ticket no longer exists:", selectedTicket.id);
        alert("This conversation no longer exists. Please refresh the page.");
        setSelectedTicket(null);
        return;
      }

      const currentTicketData = ticketSnap.data();
      console.log("✅ Ticket validation passed:", {
        id: selectedTicket.id,
        exists: true,
        assignedTo: currentTicketData.assignedTo,
        assignedEmail: currentTicketData.assignedEmail,
        customerId: currentTicketData.customerId,
        status: currentTicketData.status
      });

      // For respondents, check if they're still assigned
      if (isRespondent && currentTicketData.assignedEmail !== user?.email) {
        console.error("❌ Respondent no longer assigned to this ticket");
        alert("You are no longer assigned to this conversation. Please refresh the page.");
        setSelectedTicket(null);
        return;
      }

      // Check if ticket is in a valid state for sending messages
      if (currentTicketData.status === 'closed') {
        console.error("❌ Cannot send message to closed ticket");
        alert("This conversation is closed and cannot receive new messages.");
        return;
      }

    } catch (validationError) {
      console.error("❌ Error validating ticket:", validationError);
      alert("Error validating conversation. Please try again.");
      return;
    }

    try {
      setIsSending(true);
      console.log("Sending to API:", `${apiBase}/agent/send-message`);
      console.log("Selected ticket details:", {
        id: selectedTicket.id,
        customerId: selectedTicket.customerId,
        assignedTo: selectedTicket.assignedTo,
        assignedEmail: selectedTicket.assignedEmail
      });

      const requestData = {
        convId: selectedTicket.id, // convId is actually ticketId in the new system
        tenantId, // Pass tenant ID to API
        userName: user?.displayName || user?.email?.split('@')[0] || 'Agent',
        userEmail: user?.email,
      };

      // Add text content if provided
      if (agentMessage.trim()) {
        requestData.body = agentMessage.trim();
      }

      // Add media if selected
      if (selectedMedia) {
        console.log("🎵 Preparing to send media:", {
          type: selectedMedia.type,
          size: selectedMedia.size,
          name: selectedMedia.name,
        });
        try {
          // For images smaller than 1MB, convert to data URL (inline send to API)
          if (selectedMedia.type.startsWith('image/') && selectedMedia.size <= 1024 * 1024) {
            const mediaUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsDataURL(selectedMedia);
            });
            requestData.mediaUrl = mediaUrl;
            requestData.mediaType = selectedMedia.type;
            console.log("📎 Image converted to data URL for sending");
          }
      // For video files, send as normal media
      else if (selectedMedia.type.startsWith('video/') && selectedMedia.size <= 5 * 1024 * 1024) {
            const mediaUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsDataURL(selectedMedia);
            });
            requestData.mediaUrl = mediaUrl;
            requestData.mediaType = selectedMedia.type;
            console.log("📎 Media file converted to data URL for sending");
          }
          else {
            // For larger files or unsupported types, show appropriate message
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
            // Ensure any stale media state is cleared
            return;
          }
        } catch (error) {
          console.error("❌ Error processing media file:", error);
          alert("Error processing media file. Please try again.");
          setSelectedMedia(null);
          setMediaPreview(null);
          setRecordedAudio(null);
          return;
        }
      }

      // Log final request data before sending (includes voiceNotePath if voice note was uploaded)
      console.log("📤 Final request data being sent:", {
        convId: requestData.convId,
        body: requestData.body || '(empty)',
        tenantId: requestData.tenantId,
        voiceNotePath: requestData.voiceNotePath || '(none)',
        mediaUrl: requestData.mediaUrl ? '(present)' : '(none)',
        mediaType: requestData.mediaType || '(none)',
      });

      const resp = await fetch(`${apiBase}/agent/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      console.log("Response status:", resp.status);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("❌ Error sending agent message:", errText);
        console.error("❌ Response status:", resp.status);
        console.error("❌ Full response headers:", Object.fromEntries(resp.headers.entries()));
        console.error("❌ Request details:", {
          url: `${apiBase}/agent/send-message`,
          convId: selectedTicket.id,
          tenantId,
          agentMessage: agentMessage.trim()
        });
        console.error("❌ Selected ticket:", selectedTicket);

        // Try to parse the error as JSON to see the structure
        try {
          const errorJson = JSON.parse(errText);
          console.error("❌ Parsed error:", errorJson);
        } catch (parseError) {
          console.error("❌ Could not parse error as JSON:", parseError);
        }

        alert(`Failed to send message: ${errText}`);
      } else {
        console.log("✅ Agent message sent successfully");
        setAgentMessage("");
        // Clear media after successful send
        setSelectedMedia(null);
        setMediaPreview(null);
        // Clear any stale recording state (if any)
      }
    } catch (err) {
      console.error("Error sending agent message:", err);
      alert("Failed to send message. Check console for details.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteTicket() {
    if (!selectedTicket) return;

    if (!confirm(`Are you sure you want to delete this ticket with ${selectedTicket.customerId || 'Unknown'}? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);

      // Delete all messages in the ticket
      const messagesRef = collection(db, "companies", tenantId, "tickets", selectedTicket.id, "messages");
      const messagesSnap = await getDocs(messagesRef);

      const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete the ticket document
      const ticketRef = doc(db, "companies", tenantId, "tickets", selectedTicket.id);
      await deleteDoc(ticketRef);

      setSelectedTicket(null);
      setMessages([]);
      alert("Ticket deleted successfully.");

    } catch (err) {
      console.error("Error deleting ticket:", err);
      alert("Failed to delete ticket. Check console for details.");
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setSidebarOpen(true); // Always open on desktop
      } else {
        setSidebarOpen(false); // Closed by default on mobile
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading || !company) {
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
              onClick={() => window.location.href = '/dashboard'}
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
            <div style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "#1d1d1f",
              letterSpacing: "-0.025em"
            }}>
              Tickets
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
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {isRespondent && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => {
                      const newOnlineStatus = !isOnline;
                      const wasPreviouslyOffline = !isOnline && newOnlineStatus;
                      setIsOnline(newOnlineStatus);
                      updateRespondentStatus(newOnlineStatus, wasPreviouslyOffline);
                    }}
                    style={{
                      backgroundColor: isOnline ? "#34c759" : "#ff3b30",
                      color: "white",
                      border: "none",
                      padding: "0.375rem 0.875rem",
                      borderRadius: "18px",
                      fontSize: "0.8125rem",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      minWidth: "70px",
                      justifyContent: "center"
                    }}
                    title={isOnline ? "Click to go offline" : "Click to go online"}
                  >
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      opacity: 0.8
                    }} />
                    {isOnline ? "Online" : "Offline"}
                  </button>
                </div>
              </div>
            )}
            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => {
                      const newStatus = !company?.adminOnline;
                      updateAdminStatus(newStatus);
                    }}
                    style={{
                      backgroundColor: company?.adminOnline ? "#34c759" : "#ff3b30",
                      color: "white",
                      border: "none",
                      padding: "0.375rem 0.875rem",
                      borderRadius: "18px",
                      fontSize: "0.8125rem",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      minWidth: "70px",
                      justifyContent: "center"
                    }}
                    title={company?.adminOnline ? "Click to go offline - tickets will be assigned to offline respondents" : "Click to go online - tickets will be assigned to you when respondents are offline"}
                  >
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      opacity: 0.8
                    }} />
                    {company?.adminOnline ? "Online" : "Offline"}
                  </button>
                </div>
              </div>
            )}

            {/* Notification Button */}
            {'Notification' in window && Notification.permission === 'default' && (
              <button
                onClick={() => Notification.requestPermission()}
                style={{
                  backgroundColor: "#007aff",
                  color: "white",
                  border: "none",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "18px",
                  fontSize: "0.8125rem",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}
                title="Enable notifications for new assignments"
              >
                🔔
              </button>
            )}

            {/* New Assignments Badge */}
            {newAssignments.size > 0 && (
              <div style={{
                backgroundColor: "#ff3b30",
                color: "white",
                padding: "0.125rem 0.5rem",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: "600",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                {newAssignments.size}
              </div>
            )}
          </div>
        </div>
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
                border: ticket.hasErrors ? "2px solid #ff3b30" : "1px solid #e5e5ea",
                boxShadow: selectedTicket?.id === ticket.id ? "0 1px 6px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all 0.2s ease"
              }}
              onClick={() => {
                setSelectedTicket(ticket);
                // Clear new assignment indicator
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
                {ticket.hasErrors && (
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
                {ticket.hasErrors && (
                  <span style={{ color: "#f44336", marginLeft: "0.5rem" }}>
                    (Delivery Error)
                  </span>
                )}
                {isAdmin && ticket.assignedTo && (
                  <div style={{ fontSize: "0.7rem", color: "#888", marginTop: "0.25rem" }}>
                    Assigned to: {ticket.assignedTo}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedTicket && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: isMobile ? "0.75rem" : "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid #eee",
              backgroundColor: "#fafafa",
              borderRadius: "8px"
            }}
          >
            {selectedTicket && (isAdmin || (isRespondent && selectedTicket.assignedEmail === user?.email)) && (
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ fontSize: "0.85rem" }}>
                    <strong>Status:</strong>
                  </div>
                  <select
                    value={selectedTicket?.status || "open"}
                    onChange={async (e) => {
                      try {
                        const newStatus = e.target.value;
                        const ticketRef = doc(db, "companies", tenantId, "tickets", selectedTicket.id);
                        const updateData = {
                          status: newStatus,
                          updatedAt: new Date()
                        };

                        // If closing ticket, add who closed it
                        if (newStatus === "closed") {
                          updateData.closedBy = user?.email;
                          updateData.closedByName = user?.displayName || user?.email?.split('@')[0] || 'Unknown';
                          updateData.closedAt = new Date();
                        }

                        await updateDoc(ticketRef, updateData);
                        setSelectedTicket({ ...selectedTicket, ...updateData });
                      } catch (error) {
                        console.error("Error updating ticket status:", error);
                        alert("Failed to update ticket status");
                      }
                    }}
                    style={{
                      padding: "0.25rem",
                      fontSize: "0.75rem",
                      borderRadius: "3px",
                      border: "1px solid #ccc",
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Closed</option>
                  </select>
                  {selectedTicket?.status === "closed" && selectedTicket?.closedBy && (
                    <span style={{ fontSize: "0.7rem", color: "#666" }}>
                      Closed by {selectedTicket.closedByName || selectedTicket.closedBy}
                    </span>
                  )}
                </div>

                <div style={{
                  display: "flex",
                  gap: isMobile ? "0.5rem" : "0.75rem",
                  alignItems: "center",
                  flexDirection: isMobile ? "column" : "row"
                }}>
                  <button
                    onClick={handleToggleAI}
                    disabled={isTogglingAI}
                    style={{
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.8rem",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      backgroundColor:
                        selectedTicket?.aiEnabled === false ? "#e0f7fa" : "#ffe0e0",
                      cursor: isTogglingAI ? "default" : "pointer",
                      fontWeight: 600,
                      minWidth: "120px"
                    }}
                  >
                    {isTogglingAI
                      ? "Updating..."
                    : selectedTicket?.aiEnabled === false
                    ? "Turn AI On"
                    : "Turn AI Off"}
                  </button>

                  {isAdmin && (
                    <button
                      onClick={handleDeleteTicket}
                      disabled={isDeleting}
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.8rem",
                        borderRadius: "6px",
                        border: "1px solid #f44336",
                        backgroundColor: "#ffeaea",
                        color: "#f44336",
                        cursor: isDeleting ? "default" : "pointer",
                        fontWeight: 600,
                        minWidth: "140px"
                      }}
                    >
                      {isDeleting ? "Deleting..." : "🗑️ Delete Ticket"}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
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
              {selectedTicket ? `Chat with ${selectedTicket.customerId?.split('@')[0] || 'Customer'}` : 'Inbox'}
            </div>
            {selectedTicket && (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
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
                  onClick={() => setShowHistorySection(!showHistorySection)}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid #e5e5ea",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: showHistorySection ? "#007aff" : "#8e8e93",
                    fontSize: "0.9rem",
                    gap: "0.3rem",
                    whiteSpace: "nowrap"
                  }}
                  title={showHistorySection ? "Hide history" : "Show history"}
                >
                  <span style={{ fontSize: "1rem" }}>📚</span>
                  <span>{showHistorySection ? "Hide" : "History"}</span>
                </button>
              </>
            )}
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
              Chat with {selectedTicket.customerId?.split('@')[0] || 'Customer'}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={() => router.push('/dashboard')}
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
            </div>
          </div>
        )}

        {/* Messages Area */}
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

              {showCumulativeHistory ? (
                // Chronological View - All messages in order
                <div>
                  <div style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.8rem",
                    color: "#666",
                    fontWeight: "500"
                  }}>
                    📅 Complete Chronological History ({customerHistory.reduce((sum, ticket) => sum + ticket.messageCount, 0)} messages)
                  </div>
                  <div>
                    {[...customerHistory]
                      .sort((a, b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0)) // oldest first
                      .map((historyTicket, ticketIndex) =>
                        historicalMessages[historyTicket.id]?.map((msg, msgIndex) => {
                          const isAgentMessage = msg.role === 'agent';
                          const isSystemMessage = msg.from === "System";
                          const isAIMessage =
                            !isSystemMessage &&
                            (msg.role === 'assistant' ||
                             msg.role === 'ai' ||
                             (typeof msg.from === 'string' && msg.from.toLowerCase().includes('ai')));

                          return (
                            <div
                              key={`${historyTicket.id}-${msg.id}`}
                              style={{
                                padding: "0.35rem 0.5rem",
                                fontSize: "0.8rem",
                                display: "flex",
                                justifyContent: isAgentMessage ? "flex-end" : "flex-start"
                              }}
                            >
                              <div style={{
                                maxWidth: "75%",
                                backgroundColor: isAgentMessage
                                  ? "#dcf8c6" // WhatsApp outgoing
                                  : isSystemMessage
                                    ? "#ffeef0" // very light pink-red for system
                                    : isAIMessage
                                      ? "#fff4e5" // very light orange-cream for AI
                                      : "#ffffff",
                                color: "#111b21",
                                padding: "0.6rem 0.75rem",
                                borderRadius: isAgentMessage
                                  ? "16px 16px 4px 16px"
                                  : "16px 16px 16px 4px",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                border: "1px solid rgba(0,0,0,0.06)",
                                width: "fit-content",
                                wordBreak: "break-word"
                              }}>
                            {msgIndex === 0 && (
                              <div style={{
                                fontSize: "0.7rem",
                                color: "#999",
                                marginBottom: "0.25rem",
                                paddingBottom: "0.25rem",
                                borderBottom: "1px solid #e0e0e0",
                                fontWeight: "500"
                              }}>
                                📄 Ticket #{historyTicket.id.slice(-8)} ({historyTicket.status})
                                {historyTicket.status === "closed" && historyTicket.closedByName && (
                                  <span style={{ marginLeft: "0.5rem", color: "#4caf50" }}>
                                    ✅ Closed by {historyTicket.closedByName}
                                  </span>
                                )}
                              </div>
                            )}
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
                        })
                      )}
                  </div>
                </div>
              ) : (
                // Individual Ticket View
                [...customerHistory]
                  .sort((a, b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0)) // oldest first
                  .map((historyTicket) => {
                  const isExpanded = expandedHistory.has(historyTicket.id);
                  const ticketMessages = historicalMessages[historyTicket.id] || [];

                  return (
                    <div
                      key={historyTicket.id}
                      style={{
                        marginBottom: "0.75rem"
                      }}
                    >
                      {/* Ticket Header */}
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
                            {historyTicket.assignedTo && (
                              <span style={{ marginLeft: "0.5rem" }}>
                                • Assigned to: {historyTicket.assignedTo}
                              </span>
                            )}
                            {historyTicket.status === "closed" && historyTicket.closedByName && (
                              <div style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: "#666" }}>
                                ✅ Closed by {historyTicket.closedByName}
                              </div>
                            )}
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

                      {/* Expandable Messages */}
                      {isExpanded && (
                        <div>
                          {ticketMessages.map((msg, index) => {
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
                                  maxWidth: "75%",
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
                })
              )}

              <div style={{
                fontSize: "0.75rem",
                color: "#888",
                marginTop: "0.5rem",
                textAlign: "center"
              }}>
                💡 Customer has {customerHistory.length} previous interaction{customerHistory.length !== 1 ? 's' : ''} •
                {showCumulativeHistory
                  ? " Showing complete chronological history"
                  : " Click tickets to expand individual conversations • Toggle for chronological view"
                }
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            marginTop: "0.5rem",
            paddingRight: "0.5rem",
            paddingBottom: isMobile ? "6rem" : "1rem", // Add bottom margin for mobile chat input
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
                console.log('🎯 Rendering message:', msg.id, 'hasMedia:', msg.hasMedia, 'media:', msg.media, 'body:', msg.body);
                const isAgentMessage = msg.role === 'agent';
              const isSystemMessage = msg.from === "System";
              const isAIMessage =
                !isSystemMessage &&
                (msg.role === 'assistant' ||
                 msg.role === 'ai' ||
                 (typeof msg.from === 'string' && msg.from.toLowerCase().includes('ai')));
                const hasContent = msg.body || msg.hasMedia;

                if (!hasContent) return null;

                return (
                <div key={msg.id} style={{
                    display: "flex",
                    marginBottom: "0.75rem",
                    justifyContent: isAgentMessage ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    gap: "0.25rem"
                  }}>
                    {/* Message Bubble */}
                    <div style={{
                      maxWidth: "75%",
                      backgroundColor: isAgentMessage
                        ? "#dcf8c6" // WhatsApp outgoing
                        : isSystemMessage
                          ? "#ffeef0" // very light pink-red for system
                          : isAIMessage
                            ? "#fff4e5" // very light orange-cream for AI
                            : "#ffffff",
                      color: "#111b21",
                      padding: isMobile ? "0.875rem" : "0.75rem",
                      borderRadius: isAgentMessage ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
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
                      fontSize: isMobile ? "0.9375rem" : "1rem",
                      lineHeight: "1.4",
                      marginLeft: !isAgentMessage ? (isMobile ? "5px" : "15px") : 0,
                      marginRight: isAgentMessage ? (isMobile ? "5px" : "15px") : 0
                    }}>
                      {/* Sender name for system messages */}
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

                      {/* Media content */}
                      {renderMessageContent(msg)}

                      {/* Error indicator */}
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
                </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <p>Select a ticket</p>
          )}
        </div>

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
            {/* Media preview */}
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
                      <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
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
                      <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>
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
              {/* File input */}
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
                      // Validation based on file type
                      const isImage = file.type.startsWith('image/');
                      const isAudio = file.type.startsWith('audio/');
                      const isVideo = file.type.startsWith('video/');
                      const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text');
                      const isContact = file.name.toLowerCase().endsWith('.vcf');

                      let maxSize = 1024 * 1024; // 1MB default

                      if (isImage) {
                        maxSize = 1024 * 1024; // 1MB for images (data URL limit)
                      } else if (isVideo) {
                        maxSize = 5 * 1024 * 1024; // 5MB for video
                      } else if (isDocument) {
                        maxSize = 10 * 1024 * 1024; // 10MB for documents
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

                      // Only allow supported types for now (audio explicitly excluded)
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

              {/* Emoji button */}
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

              {/* Text input */}
            <input
              type="text"
                placeholder="iMessage"
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
                  minWidth: 0, // Allow flex shrinking
                  boxSizing: "border-box"
                }}
              />

              {/* Send button */}
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

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="emoji-picker" style={{
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
                      onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
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
