"use client";

import { useState, useEffect } from 'react';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

/**
 * MediaImage - Handles Firebase Storage URLs and regular URLs
 */
export function MediaImage({ url, contentType, alt = "Image attachment", maxWidth = 250, maxHeight = 250 }) {
  const [imageUrl, setImageUrl] = useState(url);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        const storage = getStorage();
        const urlParts = url.split('/o/')[1]?.split('?')[0];
        if (urlParts) {
          const decodedPath = decodeURIComponent(urlParts);
          const storageRef = ref(storage, decodedPath);
          getDownloadURL(storageRef)
            .then((downloadUrl) => {
              setImageUrl(downloadUrl);
              setLoading(false);
            })
            .catch(() => {
              setImageUrl(url);
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      } catch {
        setImageUrl(url);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [url]);

  if (loading) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>📷</span>
        <span>Loading image...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        color: '#991b1b',
      }}>
        🖼️ Image could not be loaded
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      style={{
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        cursor: 'pointer',
      }}
      onClick={() => window.open(imageUrl, '_blank')}
      onError={() => setError(true)}
    />
  );
}

/**
 * MediaAudio - Audio player component
 */
export function MediaAudio({ url, contentType }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{
        padding: '0.75rem',
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        color: '#991b1b',
        fontSize: '0.875rem',
      }}>
        🎵 Audio failed to load
      </div>
    );
  }

  return (
    <div style={{
      padding: '0.5rem',
      backgroundColor: '#f0f8ff',
      border: '1px solid #1976d2',
      borderRadius: '8px',
      maxWidth: '250px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        <span>🎵</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Voice Note</span>
      </div>
      <audio
        controls
        style={{ width: '100%' }}
        onError={() => setError(true)}
      >
        <source src={url} type={contentType} />
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

/**
 * MediaVideo - Video player component
 */
export function MediaVideo({ url, contentType }) {
  return (
    <video
      controls
      style={{
        maxWidth: '250px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
      }}
    >
      <source src={url} type={contentType} />
      🎥 Video message (playback not supported)
    </video>
  );
}

/**
 * MediaDocument - Document/file attachment component
 */
export function MediaDocument({ url, contentType, fileName }) {
  const getFileIcon = () => {
    if (contentType?.includes('pdf')) return '📕';
    if (contentType?.includes('word') || contentType?.includes('document')) return '📄';
    if (contentType?.includes('vcf')) return '👤';
    return '📎';
  };

  const getFileType = () => {
    if (contentType?.includes('vcf')) return 'Contact Card';
    return contentType?.split('/')[1]?.toUpperCase() || 'File';
  };

  const isContact = contentType?.includes('vcf') || url?.includes('.vcf');

  return (
    <div style={{
      padding: '0.75rem',
      backgroundColor: isContact ? '#e8f5e8' : '#fff3cd',
      border: `1px solid ${isContact ? '#4caf50' : '#ffc107'}`,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      maxWidth: '250px',
    }}>
      <span style={{ fontSize: '1.2rem' }}>{getFileIcon()}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
          {getFileType()}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.75rem',
            color: isContact ? '#4caf50' : '#856404',
            textDecoration: 'none',
          }}
        >
          Download file
        </a>
      </div>
    </div>
  );
}

/**
 * MediaError - Error state for media that couldn't be loaded
 */
export function MediaError({ contentType, errorMessage }) {
  return (
    <div style={{
      padding: '0.75rem',
      backgroundColor: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '8px',
    }}>
      <div style={{ fontSize: '0.875rem', color: '#856404' }}>
        📎 Media attachment ({contentType})
      </div>
      <div style={{ fontSize: '0.75rem', color: '#856404', marginTop: '0.25rem' }}>
        {errorMessage || 'Media could not be loaded'}
      </div>
    </div>
  );
}

/**
 * Main MediaRenderer - Renders appropriate component based on content type
 */
export default function MediaRenderer({ media, index }) {
  if (!media) return null;

  const { url, contentType, error: mediaError, warning } = media;

  if (mediaError) {
    return (
      <MediaError
        key={`media-${index}`}
        contentType={contentType}
        errorMessage={mediaError === 'Company Twilio credentials missing'
          ? 'Media could not be displayed - Twilio credentials not configured'
          : warning || 'Media could not be loaded'
        }
      />
    );
  }

  const isImage = contentType?.startsWith('image/');
  const isAudio = contentType?.startsWith('audio/');
  const isVideo = contentType?.startsWith('video/');

  if (isImage) {
    return <MediaImage key={`media-${index}`} url={url} contentType={contentType} />;
  }

  if (isAudio) {
    return <MediaAudio key={`media-${index}`} url={url} contentType={contentType} />;
  }

  if (isVideo) {
    return <MediaVideo key={`media-${index}`} url={url} contentType={contentType} />;
  }

  return <MediaDocument key={`media-${index}`} url={url} contentType={contentType} />;
}
