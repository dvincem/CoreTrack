import React, { useState, useRef, useEffect } from 'react';
import { apiFetch, API_URL } from '../lib/config';

/* ============================================================
   TIREHUB — PRESTIGE AI ASSISTANT (v2)
   Remade from scratch using UI/UX Pro Max Principles:
   - OLED Midnight Glass Architecture
   - Sophisticated Conversational Geometry
   - Kinetic Typography & Interactions
   ============================================================ */

// ── Icons (SVG Architecture) ────────────────────────────────

const ICON_BOT = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </svg>
);

const ICON_USER = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const ICON_SEND = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
  </svg>
);

// ── Message Renderer — preserves line breaks and spacing ───────────────────
function BotMessage({ text }) {
  // Split on real newlines, render each as its own block
  const lines = text.split('\n');
  return (
    <div className="ai-msg-content">
      {lines.map((line, i) => {
        // Empty line = visual spacer
        if (line.trim() === '') {
          return <div key={i} style={{ height: '0.45rem' }} />;
        }
        // Divider line
        if (/^─+$/.test(line.trim())) {
          return <div key={i} className="ai-divider" />;
        }
        // Bullet point lines — give extra bottom spacing
        if (line.trim().startsWith('•')) {
          return (
            <div key={i} className="ai-line ai-bullet">
              {line}
            </div>
          );
        }
        // Numbered list items
        if (/^\s+\d+\./.test(line) || /^\d+\./.test(line.trim())) {
          return <div key={i} className="ai-line ai-numbered">{line}</div>;
        }
        // Header/title lines (emoji at start)
        if (/^[📊📍📋🔍ℹ️💡📝👣🔗▲▼📈⚠️🔒]/.test(line.trim())) {
          return <div key={i} className="ai-line ai-label">{line}</div>;
        }
        // Step lines inside navigation
        if (/^\s+\d+\./.test(line)) {
          return <div key={i} className="ai-line ai-step">{line}</div>;
        }
        return <div key={i} className="ai-line">{line}</div>;
      })}
    </div>
  );
}

export default function TireHubBot({ pageContext, businessDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Greetings. I've analyzed this view. How can I assist with your operations today?" }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Sync with system theme
  useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Smooth scroll sync
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await apiFetch(`${API_URL}/chat`, {
        method: 'POST',
        body: JSON.stringify({ 
          message: msg, 
          pageContext, 
          businessDate,
          role: 'owner', 
          history: messages 
        })
      });
      const data = await res.json();
      
      if (res.status === 503) {
        setMessages(prev => [...prev, { role: 'bot', text: "System Error: " + (data.details || data.error) }]);
      } else if (!res.ok) {
        setMessages(prev => [...prev, { role: 'bot', text: data.error || data.message || "Query failed to resolve." }]);
      } else {
        const reply = typeof data.reply === 'object' ? JSON.stringify(data.reply, null, 2) : data.reply;
        setMessages(prev => [...prev, { role: 'bot', text: reply || "Intelligence returned an empty response." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Connection failed. Ensure the shop server is running.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return (
    <button className="ai-trigger" onClick={() => setIsOpen(true)}>
      <div className="ai-trigger-ring" />
      <div className="ai-trigger-icon">{ICON_BOT}</div>
      <style>{`
        .ai-trigger {
          position: fixed; bottom: 2rem; right: 2rem;
          width: 50px; height: 50px; border-radius: 100px;
          background: #000; border: 1px solid var(--th-orange);
          cursor: pointer; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          color: var(--th-orange); overflow: hidden;
          box-shadow: 0 10px 30px rgba(249, 115, 22, 0.2);
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        [data-theme='light'] .ai-trigger {
          background: #fff;
          box-shadow: 0 10px 30px rgba(249, 115, 22, 0.15);
        }
        .ai-trigger:hover { transform: translateY(-5px) scale(1.05); box-shadow: 0 15px 40px rgba(249, 115, 22, 0.4); }
        .ai-trigger-ring {
          position: absolute; inset: 0; 
          border: 2px solid var(--th-orange); 
          border-radius: 100px; opacity: 0.3;
          animation: ai-pulse 2s infinite;
        }
        @keyframes ai-pulse { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(1.5); opacity: 0; } }
      `}</style>
    </button>
  );

  return (
    <div className="ai-window">
      {/* ── Header ── */}
      <div className="ai-header">
        <div className="ai-header-lead">
          <div className="ai-avatar-main">{ICON_BOT}</div>
          <div>
            <div className="ai-brand">CORETRACK<span>AI</span></div>
            <div className="ai-status">Offline Intelligence Active</div>
          </div>
        </div>
        <button className="ai-close-btn" onClick={() => setIsOpen(false)}>✕</button>
      </div>

      {/* ── Chat Canvas ── */}
      <div ref={scrollRef} className="ai-canvas">
        <div className="ai-context-pill">Analyzing: {pageContext?.view || 'Global System'}</div>
        
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg-group ${m.role}`}>
            <div className="ai-bubble">
              <div className="ai-msg-meta">
                {m.role === 'user' ? ICON_USER : ICON_BOT}
                {m.role === 'user' ? 'Administrator' : 'Llama 3.2'}
              </div>
              {m.role === 'bot'
                ? <BotMessage text={m.text} />
                : <div className="ai-msg-content">{m.text}</div>
              }
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="ai-msg-group bot">
            <div className="ai-bubble thinking">
              <div className="ai-loader">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="ai-footer">
        <div className="ai-input-container">
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Describe your inquiry..."
            autoFocus
          />
          <button className="ai-send-action" onClick={handleSend} disabled={isThinking || !input.trim()}>
            {ICON_SEND}
          </button>
        </div>
      </div>

      <style>{`
        .ai-window {
          position: fixed; bottom: 2rem; right: 2rem;
          width: 400px; height: 650px; z-index: 9999;
          background: rgba(2, 6, 23, 0.92);
          backdrop-filter: blur(25px) saturate(180%);
          border: 1px solid rgba(249, 115, 22, 0.3);
          border-radius: 28px;
          display: flex; flex-direction: column;
          box-shadow: 0 30px 100px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: ai-open 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }
        
        [data-theme='light'] .ai-window {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(249, 115, 22, 0.2);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        @keyframes ai-open { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .ai-header {
          padding: 1.5rem;
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: linear-gradient(to bottom, rgba(249,115,22,0.1), transparent);
        }
        [data-theme='light'] .ai-header { border-bottom: 1px solid rgba(0,0,0,0.05); }

        .ai-header-lead { display: flex; align-items: center; gap: 0.85rem; }
        .ai-avatar-main { width: 40px; height: 40px; border-radius: 12px; background: var(--th-orange); color: #000; display: flex; align-items: center; justify-content: center; }
        .ai-brand { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 1.1rem; color: #fff; letter-spacing: 0.02em; }
        [data-theme='light'] .ai-brand { color: #0f172a; }
        .ai-brand span { color: var(--th-orange); margin-left: 2px; }
        .ai-status { font-size: 0.65rem; color: #4ade80; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-top: 2px; }
        .ai-close-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 1.2rem; transition: 0.2s; }
        [data-theme='light'] .ai-close-btn { color: rgba(0,0,0,0.3); }
        .ai-close-btn:hover { color: #fff; transform: rotate(90deg); }
        [data-theme='light'] .ai-close-btn:hover { color: #000; }

        .ai-canvas {
          flex: 1; overflow-y: auto; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 2rem;
          scrollbar-width: none;
        }
        .ai-canvas::-webkit-scrollbar { display: none; }
        .ai-context-pill { align-self: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.65rem; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; }
        [data-theme='light'] .ai-context-pill { background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); color: rgba(0,0,0,0.5); }

        .ai-msg-group { display: flex; width: 100%; }
        .ai-msg-group.user { justify-content: flex-end; }
        .ai-msg-group.bot { justify-content: flex-start; }

        .ai-bubble {
          max-width: 85%;
          padding: 1rem 1.25rem;
          border-radius: 20px;
          position: relative;
          transition: 0.3s;
        }

        .user .ai-bubble {
          background: linear-gradient(135deg, var(--th-orange), #ea580c);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(249,115,22,0.3);
        }
        .bot .ai-bubble {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f8fafc;
          border-bottom-left-radius: 4px;
        }
        [data-theme='light'] .bot .ai-bubble {
          background: #f1f5f9;
          border: 1px solid rgba(0,0,0,0.05);
          color: #1e293b;
        }

        .ai-msg-content { font-size: 0.9rem; line-height: 1.6; font-weight: 400; }
        .ai-line { display: block; margin-bottom: 0.15rem; font-size: 0.88rem; line-height: 1.55; }
        .ai-bullet { padding-left: 0.25rem; margin-bottom: 0.35rem; }
        .ai-numbered { padding-left: 0.5rem; margin-bottom: 0.3rem; }
        .ai-label { font-weight: 600; margin-bottom: 0.2rem; }
        .ai-step { padding-left: 1rem; margin-bottom: 0.25rem; color: rgba(255,255,255,0.85); }
        [data-theme='light'] .ai-step { color: #334155; }
        .ai-divider { border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 0.5rem 0; }
        [data-theme='light'] .ai-divider { border-top: 1px solid rgba(0,0,0,0.08); }
        
        .ai-msg-meta { 
          display: flex; align-items: center; justify-content: flex-end; gap: 6px; 
          font-size: 0.55rem; font-weight: 800; text-transform: uppercase; opacity: 0.4;
          letter-spacing: 0.05em;
          margin-bottom: 0.4rem;
        }
        [data-theme='light'] .bot .ai-msg-meta { color: #64748b; }
        .user .ai-msg-meta { color: rgba(255,255,255,0.9); opacity: 0.8; }

        .ai-footer { padding: 1.25rem; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); }
        [data-theme='light'] .ai-footer { background: #f8fafc; border-top: 1px solid rgba(0,0,0,0.05); }
        
        .ai-input-container {
          background: #0f172a; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; display: flex; align-items: center; gap: 0.5rem;
          padding: 6px 6px 6px 1.25rem; transition: 0.3s;
        }
        [data-theme='light'] .ai-input-container { background: #fff; border: 1px solid #e2e8f0; }
        
        .ai-input-container:focus-within { border-color: var(--th-orange); box-shadow: 0 0 0 4px rgba(249,115,22,0.15); }
        .ai-input-container input { flex: 1; background: none; border: none; outline: none; color: #fff; font-size: 0.9rem; height: 40px; }
        [data-theme='light'] .ai-input-container input { color: #0f172a; }
        [data-theme='light'] .ai-input-container input::placeholder { color: #94a3b8; }
        
        .ai-send-action {
          width: 40px; height: 40px; border-radius: 16px;
          background: var(--th-orange); color: #000; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: 0.2s;
        }
        .ai-send-action:disabled { opacity: 0.3; filter: grayscale(1); }
        .ai-send-action:hover:not(:disabled) { transform: scale(1.05) translateY(-2px); background: #fff; }
        [data-theme='light'] .ai-send-action:hover:not(:disabled) { background: #000; color: #fff; }

        .ai-loader { display: flex; gap: 6px; padding: 4px 0; }
        .ai-loader span { width: 6px; height: 6px; border-radius: 50%; background: var(--th-orange); animation: ai-bounce 1.4s infinite ease-in-out; }
        .ai-loader span:nth-child(2) { animation-delay: 0.2s; }
        .ai-loader span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes ai-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.3; } 40% { transform: translateY(-8px); opacity: 1; } }

        @media (max-width: 500px) {
          .ai-window { width: calc(100vw - 2rem); height: 80vh; bottom: 1rem; right: 1rem; border-radius: 24px; }
        }
      `}</style>
    </div>
  );
}
