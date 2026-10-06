'use client';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  const isError = type === 'error';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 100,
        backgroundColor: isError ? 'var(--c-primary)' : 'var(--c-navy)',
        color: '#FFFFFF',
        padding: '14px 22px',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-elevated)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontSize: '0.9rem',
        fontWeight: '500',
        border: `1px solid ${isError ? 'var(--c-peach)' : 'var(--c-sand)'}`,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <span>{isError ? '⚠️' : '✅'}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#FFFFFF',
          opacity: 0.8,
          cursor: 'pointer',
          fontSize: '1rem',
          marginLeft: '8px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
