import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string; // e.g., "Sí, salir sin guardar"
  saveLabel?: string;    // e.g., "Guardar"
  cancelLabel?: string;  // e.g., "Cancelar"
  onConfirm: () => void;
  onSave?: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'primary';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Aceptar',
  saveLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onSave,
  onCancel,
  variant = 'primary'
}) => {
  if (!isOpen) return null;

  const getActionButtonBg = () => {
    switch (variant) {
      case 'danger':
        return '#ef4444'; // Solid Red from image
      case 'warning':
        return '#f59e0b'; // Solid Amber
      case 'primary':
      default:
        return '#0066ff'; // Vibrant Blue
    }
  };

  const getActionButtonHoverBg = () => {
    switch (variant) {
      case 'danger':
        return '#dc2626';
      case 'warning':
        return '#d97706';
      case 'primary':
      default:
        return '#0052cc';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        animation: 'fadeIn 0.15s ease-out',
        padding: '20px'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#111827', // Deep dark slate background from the image
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
          padding: '24px',
          animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent click propagation
      >
        {/* Title */}
        <h3
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#ffffff', // White bold text
            letterSpacing: '-0.02em'
          }}
        >
          {title}
        </h3>

        {/* Message Body */}
        <p
          style={{
            margin: 0,
            fontSize: '0.95rem',
            lineHeight: '1.5',
            color: '#9ca3af' // Muted grey text from image
          }}
        >
          {message}
        </p>

        {/* Action Buttons Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px'
          }}
        >
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: '#ffffff', // Transparent/ghost white text from image
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {cancelLabel}
          </button>

          {/* Confirm/Discard Button (Secondary action if Save is present) */}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: onSave ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
              background: onSave ? 'rgba(255, 255, 255, 0.05)' : getActionButtonBg(),
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.15s ease, transform 0.1s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = onSave ? 'rgba(255, 255, 255, 0.1)' : getActionButtonHoverBg();
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = onSave ? 'rgba(255, 255, 255, 0.05)' : getActionButtonBg();
            }}
          >
            {confirmLabel}
          </button>

          {/* Optional Save Button */}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: '#0066ff', // Vibrant blue for primary save action
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0052cc'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0066ff'}
            >
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
