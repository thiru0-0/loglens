import { useCallback } from 'react';

export default function DownloadButton({ content, filename, label, className = '' }) {
  const handleDownload = useCallback(() => {
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [content, filename]);

  return (
    <button
      className={`btn btn-secondary btn-md ${className}`}
      onClick={handleDownload}
      disabled={!content}
    >
      📥 {label || 'Download'}
    </button>
  );
}
