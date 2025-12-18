"use client";

import { useState, useEffect, useRef } from 'react';

export default function DropdownMenu({ 
  trigger, 
  items, 
  align = 'right',
  width = '200px' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {typeof trigger === 'function' ? trigger(isOpen) : trigger}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          [align]: 0,
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          minWidth: width,
          zIndex: 1000,
          marginTop: '4px',
          overflow: 'hidden',
        }}>
          {items.map((item, index) => {
            if (item.divider) {
              return (
                <div 
                  key={`divider-${index}`} 
                  style={{ 
                    borderTop: '1px solid #f0f0f0', 
                    margin: '4px 0' 
                  }} 
                />
              );
            }

            if (item.hidden) return null;

            return (
              <button
                key={item.label || index}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: item.danger ? '#ef4444' : item.disabled ? '#9ca3af' : '#374151',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.target.style.backgroundColor = item.danger ? '#fef2f2' : '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
