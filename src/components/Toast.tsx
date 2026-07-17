import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error';
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(message.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast toast-${message.type}`}>
      {message.type === 'success' ? '✓' : '✗'} {message.text}
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} message={toast} onClose={onClose} />
      ))}
    </div>
  );
};
