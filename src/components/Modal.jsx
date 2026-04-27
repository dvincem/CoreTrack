import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Shared Modal Component
 * Optimized for PC (centered) and Mobile (bottom sheet or full screen).
 * 
 * Props:
 *   isOpen      {boolean}  Required. Controls visibility.
 *   onClose     {Function} Required. Called when user tries to close.
 *   title       {string}   Optional title in header.
 *   children    {node}     Content to render.
 *   maxWidth    {string}   CSS max-width for PC view (default 500px).
 *   zIndex      {number}   Z-index (default 1000).
 *   headerActions {node}   Optional extra buttons in header.
 *   noPadding   {boolean}  If true, body has no padding.
 *   footer      {node}     Optional footer area for buttons.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
  zIndex = 1000,
  headerActions,
  noPadding = false,
  footer,
}) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="th-modal-overlay" style={{ zIndex }} onClick={onClose}>
      <div 
        className="th-modal-container animate-slide-up-mobile" 
        style={{ maxWidth }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="th-modal-header">
          <div className="th-modal-header-lead">
            {title && <h3 className="th-modal-title">{title}</h3>}
          </div>
          <div className="th-modal-header-actions">
            {headerActions}
            <button className="th-modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={`th-modal-body ${noPadding ? 'no-padding' : ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="th-modal-footer">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        .th-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .th-modal-container {
          background: var(--th-bg-card);
          border: 1px solid var(--th-border-strong);
          border-radius: 16px;
          width: 100%;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
        }

        .th-modal-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--th-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--th-bg-card-alt);
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }

        .th-modal-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1.2rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--th-text-heading);
          margin: 0;
        }

        .th-modal-header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .th-modal-close-btn {
          background: none;
          border: none;
          color: var(--th-text-faint);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .th-modal-close-btn:hover { color: var(--th-rose); }

        .th-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          scrollbar-width: thin;
        }
        .th-modal-body.no-padding { padding: 0; }

        .th-modal-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--th-border);
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          background: var(--th-bg-card-alt);
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        /* Mobile Optimization */
        @media (max-width: 640px) {
          .th-modal-overlay {
            padding: 1rem;
            align-items: center; /* Centered instead of bottom sheet */
          }
          .th-modal-container {
            border-radius: 16px;
            border-bottom: 1px solid var(--th-border-strong);
            max-height: 90vh;
            margin: auto;
          }
          .th-modal-header {
            border-radius: 16px 16px 0 0;
            padding: 0.85rem 1rem;
          }
          .th-modal-body { padding: 1rem; }
          .th-modal-footer { border-radius: 0 0 16px 16px; padding: 0.85rem 1rem; }

          .animate-slide-up-mobile {
            animation: fadeInScale 0.3s cubic-bezier(0.23, 1, 0.32, 1);
          }
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
