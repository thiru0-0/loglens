import { useState, useCallback } from 'react';
import { analyzeLog } from '../services/api';

export function useAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const submitLogs = useCallback(async (logs, config = {}) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await analyzeLog(logs, config);

    if (response.error) {
      setError(response.error);
      setLoading(false);
      return { error: response.error };
    }

    setResult(response);
    setLoading(false);
    return response;
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { loading, error, result, submitLogs, reset };
}
