import React from 'react';
import { Text, TextStyle } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from './responsive';

interface Token {
  type: 'keyword' | 'string' | 'comment' | 'number' | 'type' | 'text';
  value: string;
}

const KEYWORDS_BY_LANG: Record<string, RegExp> = {
  python: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|lambda|yield|async|await|pass|raise|in|is|not|and|or|global|nonlocal|assert|break|continue)\b/,
  javascript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|finally|throw|new|typeof|instanceof|void|delete|in|of|import|export|from|as|async|await|yield|class|extends|super|this|null|undefined|true|false)\b/,
  typescript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|finally|throw|new|typeof|instanceof|void|delete|in|of|import|export|from|as|async|await|yield|class|extends|super|this|null|undefined|true|false|type|interface|enum|implements|declare|abstract|readonly|private|protected|public|override)\b/,
  c: /\b(int|char|float|double|void|short|long|signed|unsigned|struct|union|enum|typedef|sizeof|if|else|for|while|do|switch|case|default|break|continue|return|goto|const|static|extern|auto|register|volatile)\b/,
  cpp: /\b(int|char|float|double|void|short|long|signed|unsigned|struct|union|enum|typedef|sizeof|if|else|for|while|do|switch|case|default|break|continue|return|goto|const|static|extern|auto|register|volatile|class|public|protected|private|template|typename|this|new|delete|friend|virtual|inline|explicit|operator|namespace|using|try|catch|throw|bool|true|false|nullptr)\b/,
  java: /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null)\b/,
  sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|ALL|DISTINCT|AS|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|CHECK|DEFAULT|UNIQUE|AUTO_INCREMENT|CASCADE|CONSTRAINT|DATABASE|USE|SHOW|DESCRIBE|COUNT|SUM|AVG|MIN|MAX)\b/i,
};

export const tokenizeCode = (code: string, language?: string): Token[] => {
  const lang = (language || '').toLowerCase().trim();
  const keywordRegex = KEYWORDS_BY_LANG[lang] || KEYWORDS_BY_LANG.c;

  const tokens: Token[] = [];
  const lines = code.split('\n');

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let pos = 0;

    while (pos < line.length) {
      // 1. Comments
      const rest = line.slice(pos);
      if (
        (lang === 'python' && rest.startsWith('#')) ||
        (lang === 'sql' && rest.startsWith('--')) ||
        rest.startsWith('//')
      ) {
        tokens.push({ type: 'comment', value: rest });
        pos = line.length;
        break;
      }

      // 2. Strings
      const strMatch = rest.match(/^("(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`)/);
      if (strMatch) {
        tokens.push({ type: 'string', value: strMatch[0] });
        pos += strMatch[0].length;
        continue;
      }

      // 3. Numbers
      const numMatch = rest.match(/^\b\d+(\.\d+)?\b/);
      if (numMatch) {
        tokens.push({ type: 'number', value: numMatch[0] });
        pos += numMatch[0].length;
        continue;
      }

      // 4. Identifiers / Keywords
      const wordMatch = rest.match(/^\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
      if (wordMatch) {
        const word = wordMatch[0];
        if (keywordRegex && keywordRegex.test(word)) {
          tokens.push({ type: 'keyword', value: word });
        } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
          tokens.push({ type: 'type', value: word });
        } else {
          tokens.push({ type: 'text', value: word });
        }
        pos += word.length;
        continue;
      }

      // 5. Normal characters / whitespace / symbols
      tokens.push({ type: 'text', value: line[pos] });
      pos++;
    }

    if (l < lines.length - 1) {
      tokens.push({ type: 'text', value: '\n' });
    }
  }

  return tokens;
};

const tokenStyles: Record<Token['type'], TextStyle> = {
  keyword: {
    color: '#b23a2e', // Grading pen red accent
    fontWeight: '700',
  },
  string: {
    color: '#1f4b43', // Deep exam teal
  },
  comment: {
    color: '#8a94a6',
    fontStyle: 'italic',
  },
  number: {
    color: '#b45309', // Amber / number accent
  },
  type: {
    color: '#4338ca', // Indigo type
    fontWeight: '600',
  },
  text: {
    color: '#1b2430',
  },
};

export const HighlightedCode: React.FC<{ code: string; language?: string; style?: TextStyle }> = ({
  code,
  language,
  style,
}) => {
  const tokens = tokenizeCode(code, language);

  return (
    <Text style={style}>
      {tokens.map((token, index) => (
        <Text key={index} style={tokenStyles[token.type]}>
          {token.value}
        </Text>
      ))}
    </Text>
  );
};
