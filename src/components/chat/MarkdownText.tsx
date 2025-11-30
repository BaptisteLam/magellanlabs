interface MarkdownTextProps {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className = '' }: MarkdownTextProps) {
  // Parse simple markdown: ### = bold, ** = bold, * = italic, ` = code
  const parseMarkdown = (content: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    while (remaining.length > 0) {
      // Bold with ###
      if (remaining.startsWith('###')) {
        const match = remaining.match(/^###\s*(.+?)(?:\n|$)/);
        if (match) {
          parts.push(
            <strong key={key++} className="font-bold">
              {match[1]}
            </strong>
          );
          remaining = remaining.slice(match[0].length);
          continue;
        }
      }

      // Bold with **text**
      if (remaining.startsWith('**')) {
        const match = remaining.match(/^\*\*(.+?)\*\*/);
        if (match) {
          parts.push(
            <strong key={key++} className="font-bold">
              {match[1]}
            </strong>
          );
          remaining = remaining.slice(match[0].length);
          continue;
        }
      }

      // Italic with *text*
      if (remaining.startsWith('*') && !remaining.startsWith('**')) {
        const match = remaining.match(/^\*(.+?)\*/);
        if (match) {
          parts.push(
            <em key={key++} className="italic">
              {match[1]}
            </em>
          );
          remaining = remaining.slice(match[0].length);
          continue;
        }
      }

      // Code with `text`
      if (remaining.startsWith('`')) {
        const match = remaining.match(/^`(.+?)`/);
        if (match) {
          parts.push(
            <code
              key={key++}
              className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
            >
              {match[1]}
            </code>
          );
          remaining = remaining.slice(match[0].length);
          continue;
        }
      }

      // Regular text
      const nextSpecialChar = remaining.search(/[*`#]/);
      if (nextSpecialChar === -1) {
        parts.push(remaining);
        break;
      } else {
        parts.push(remaining.slice(0, nextSpecialChar));
        remaining = remaining.slice(nextSpecialChar);
      }
    }

    return parts;
  };

  return (
    <span className={className}>
      {parseMarkdown(text)}
    </span>
  );
}
