import { useState, useCallback } from 'react';
import { askFollowUp } from '../services/api';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (reportId, question, context = null) => {
    if (!question.trim()) return;

    // Add user message immediately
    const userMsg = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const response = await askFollowUp(reportId, question.trim(), context);

    if (response.error) {
      const errorMsg = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${response.error}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } else {
      const assistantMsg = {
        role: 'assistant',
        content: response.answer || response.message || 'No response received.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    }

    setLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, sendMessage, clearMessages };
}
