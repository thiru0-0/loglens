/**
 * Renders basic markdown-like text transformations for chat messages.
 * Supports: **bold**, `code`, unordered lists (- item), paragraphs.
 */
function renderContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={key++}>{listItems}</ul>);
      listItems = [];
    }
  };

  const formatInline = (line) => {
    const parts = [];
    // Process bold (**text**) and code (`text`)
    const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<code key={match.index}>{match[3]}</code>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts.length > 0 ? parts : line;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      listItems.push(<li key={key++}>{formatInline(trimmed.slice(2))}</li>);
    } else {
      flushList();
      if (trimmed === '') {
        continue;
      } else {
        elements.push(<p key={key++}>{formatInline(trimmed)}</p>);
      }
    }
  }
  flushList();

  return elements;
}

export default function ChatMessage({ role, content }) {
  return (
    <div className={`chat-message ${role}`}>
      <div className="chat-bubble">
        <div className="chat-role-label">
          {role === 'user' ? 'You' : 'LogLens AI'}
        </div>
        {renderContent(content)}
      </div>
    </div>
  );
}
