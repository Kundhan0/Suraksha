import React, { useState, useEffect, useRef } from 'react';
import { chatWithAI, chatHistory } from '../services/analysisService';

const ChatBubble = ({ type, message, timestamp }) => {
  const [showContent, setShowContent] = useState(false);
  React.useEffect(() => { setShowContent(true); }, []);
  return (
    <div className={`chat-bubble ${type}`}>
      <div className="bubble-content" dangerouslySetInnerHTML={{__html: message}} />
      <div className="bubble-footer">
        <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
};

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState('suraksha_' + Date.now());
  const containerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await chatHistory(sessionId);
        if (res.messages) {
          setMessages(res.messages.map(m => ({ role: m.role, content: m.message, timestamp: m.timestamp })));
        }
      } catch(e) {}
    })();
  }, [sessionId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    try {
      const res = await chatWithAI(text, sessionId);
      setMessages(prev => [...prev, { role: 'ai', content: res.response, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'ai', content: '🛡️ **Welcome to Project Suraksha.\n\nI am your AI assistant for disaster risk assessment. Please ask about any village, hazard, or relocation plan.', timestamp: Date.now() }]);
    }
  }, []);

  return (
    <div className="chat-interface">
      <header className="chat-header">
        <h2>🛡️ Project Suraksha</h2>
        <p className="chat-subtitle">AI Disaster Risk Assistant</p>
      </header>
      <main className="chat-container" ref={containerRef}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} type={msg.role} message={msg.content} timestamp={msg.timestamp} />
        ))}
        {isLoading && <div className="chat-bubble ai"><div className="bubble-content typing">Thinking...</div></div>}
      </main>
      <footer className="chat-input-area">
        <input type="text" id="chat-input" placeholder="Ask about any village or hazard..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} disabled={isLoading} />
        <button onClick={sendMessage} disabled={isLoading}>Send</button>
      </footer>
    </div>
  );
}
