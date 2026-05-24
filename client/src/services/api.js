const API_BASE = 'http://localhost:3001';

export async function analyzeLog(logs, config = {}) {
  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs, config }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.error || 'Server error',
        message: errorData.message || `${response.status} ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return { error: 'Cannot connect to the analysis server. Please ensure the backend is running on port 3001.' };
    }
    return { error: err.message || 'An unexpected error occurred during analysis.' };
  }
}

export async function askFollowUp(reportId, question, context = null) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, question, context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `Server error: ${response.status} ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return { error: 'Cannot connect to the chat server. Please ensure the backend is running.' };
    }
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
