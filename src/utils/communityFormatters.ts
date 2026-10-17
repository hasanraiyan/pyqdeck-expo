export function formatHashtagsForMarkdown(text: string): string {
  if (!text) return '';
  const shielded: string[] = [];
  const placeholder = (match: string) => {
    shielded.push(match);
    return `\uE002${shielded.length - 1}\uE003`;
  };

  let prepared = text
    .replace(/```[\s\S]*?```/g, placeholder)
    .replace(/`[^`\n]+`/g, placeholder)
    .replace(/\$\$[\s\S]*?\$\$/g, placeholder)
    .replace(/\$[^\$\n]+\$/g, placeholder);

  prepared = prepared.replace(
    /(^|[\s(\[])#([A-Za-z0-9_-]+)/g,
    (_, prefix, tag) => `${prefix}[#${tag}](hashtag:${tag})`
  );

  return prepared.replace(/\uE002(\d+)\uE003/g, (_, i) => shielded[Number(i)]);
}

export function truncateMarkdownSafely(text: string, limit = 220): string {
  if (text.length <= limit) return text;

  let truncated = text.slice(0, limit);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > limit * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }

  // Close unclosed bold (**)
  const boldMatches = truncated.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    truncated += '**';
  }

  // Close unclosed italic (*)
  const strippedBold = truncated.replace(/\*\*/g, '');
  const italicMatches = strippedBold.match(/\*/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    truncated += '*';
  }

  // Close unclosed inline code (`)
  const codeMatches = truncated.match(/`/g);
  if (codeMatches && codeMatches.length % 2 !== 0) {
    truncated += '`';
  }

  // Close unclosed display math ($$) or inline math ($)
  const displayMathMatches = truncated.match(/\$\$/g);
  if (displayMathMatches && displayMathMatches.length % 2 !== 0) {
    truncated += '$$';
  } else {
    const strippedDisplay = truncated.replace(/\$\$/g, '');
    const inlineMathMatches = strippedDisplay.match(/\$/g);
    if (inlineMathMatches && inlineMathMatches.length % 2 !== 0) {
      truncated += '$';
    }
  }

  return truncated.trim();
}
