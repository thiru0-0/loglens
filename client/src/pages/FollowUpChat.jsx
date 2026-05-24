import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Lightbulb, Send } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { useChat } from '../hooks/useChat';
import '../styles/chat.css';

const SUGGESTED_QUESTIONS = [
  'Which endpoints were most affected?',
  'What does a 503 error mean in this context?',
  'Give me curl commands to test recovery',
];

export default function FollowUpChat({ reportId, reportContext }) {
  const { messages, loading, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState(SUGGESTED_QUESTIONS);
  const messagesEndRef = useRef(null);

  // Parse dynamic suggestions from the last message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const match = lastMsg.content.match(/SUGGESTED_QUESTIONS:\s*(\[.*?\])/s);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSuggestions(parsed);
            }
          } catch (e) {
            console.error('Failed to parse suggested questions:', e);
          }
        }
      }
    }
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    sendMessage(reportId, input.trim(), reportContext);
    setInput('');
  }, [input, loading, reportId, reportContext, sendMessage]);

  const handleChipClick = useCallback((question) => {
    if (loading) return;
    setInput('');
    sendMessage(reportId, question, reportContext);
  }, [loading, reportId, reportContext, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="chat-section">
      <div className="chat-section-header">
        <h2>
          <MessageSquare size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Follow-Up Questions
        </h2>
        <p>Ask anything about the analysis results</p>
      </div>

      <div className="chat-container">
        {/* Messages */}
        {messages.length > 0 && (
          <div className="chat-messages">
            {messages.map((msg, i) => {
              const displayContent = msg.content.replace(/SUGGESTED_QUESTIONS:\s*\[.*?\]\s*/s, '').trim();
              return <ChatMessage key={i} role={msg.role} content={displayContent} />;
            })}
            {loading && (
              <div className="chat-message assistant">
                <div className="chat-bubble">
                  <div className="chat-typing">
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <div className="chat-empty-icon"><Lightbulb size={32} /></div>
            <p>Ask a follow-up question about your log analysis</p>
          </div>
        )}

        {/* Suggested Questions */}
        <div className="chat-suggestions">
          {suggestions.map((q, i) => (
            <button
              key={i}
              className="chat-chip"
              onClick={() => handleChipClick(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="chat-input-bar">
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            disabled={loading}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
