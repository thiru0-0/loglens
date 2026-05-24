import { useState, useRef, useCallback } from 'react';

const ACCEPTED_TYPES = ['.log', '.txt', '.json', '.jsonl', '.csv'];

export default function FileUpload({ onFileContent }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const readFile = useCallback((file) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFileName(file.name);
      onFileContent(e.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, [onFileContent]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const zoneClass = [
    'file-upload-zone',
    dragOver && 'dragover',
    fileName && 'has-file',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div
        className={zoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {fileName ? (
          <div className="file-upload-filename">
            <span>✅</span>
            <span>{fileName}</span>
          </div>
        ) : (
          <>
            <div className="file-upload-icon">📁</div>
            <div className="file-upload-text">
              <strong>Click to upload</strong> or drag & drop
            </div>
            <div className="file-upload-hint">
              Supports {ACCEPTED_TYPES.join(', ')} — Max 10 MB
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      {error && (
        <div className="log-validation-error" style={{ marginTop: 8 }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
