export interface StepperItem {
  stepNumber: string;
  title?: string;
  content: string;
}

/**
 * Regex matching an explicitly enclosed step block starting with :::step and ending with :::
 * (or bounded by the next :::step, heading, or divider).
 */
export const STEP_BLOCK_REGEX =
  /(?:^|\r?\n):::step(?![a-zA-Z0-9_-])[ \t]*([^\r\n]*)\r?\n([\s\S]*?)(?:\r?\n:::(?!\w)|\r?\n(?=#{1,6}\s|---|:::step\b|$))/gi;

/**
 * Parses a header line like ":::step 1: Lexical Analysis" or "1: Lexical Analysis" or "Phase 1: Pre-processing"
 */
export function parseStepHeader(headerLine: string, fallbackIndex = 1): { stepNumber: string; title?: string } {
  const raw = headerLine.replace(/^:::step(?![a-zA-Z0-9_-])\s*/i, '').trim();
  if (!raw) {
    return { stepNumber: String(fallbackIndex) };
  }

  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1) {
    const left = raw.substring(0, colonIdx).trim();
    const right = raw.substring(colonIdx + 1).trim();
    return {
      stepNumber: left || String(fallbackIndex),
      title: right || undefined,
    };
  }

  const matchNum = raw.match(/^([0-9]+|[a-zA-Z]\b|Step\s+[0-9]+)\s*(.*)$/i);
  if (matchNum && matchNum[1]) {
    return {
      stepNumber: matchNum[1].replace(/^Step\s+/i, '').trim(),
      title: matchNum[2]?.trim() || undefined,
    };
  }

  return {
    stepNumber: String(fallbackIndex),
    title: raw,
  };
}

/**
 * Parses the body of a single :::step block.
 */
export function parseSingleStep(rawText: string, fallbackIndex = 1): StepperItem | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  const match = trimmed.match(/^:::step(?![a-zA-Z0-9_-])[ \t]*([^\r\n]*)\r?\n([\s\S]*?)(?:\r?\n:::\s*)?$/i);
  if (!match) return null;

  const headerStr = match[1] || '';
  const content = (match[2] || '').trim();
  const { stepNumber, title } = parseStepHeader(headerStr, fallbackIndex);

  return {
    stepNumber,
    title,
    content,
  };
}

/**
 * Parses an entire container :::stepper ... ::: into an array of StepperItems.
 */
export function parseStepperContainer(containerText: string): StepperItem[] {
  if (!containerText) return [];
  const matches = [...containerText.matchAll(STEP_BLOCK_REGEX)];
  if (matches.length === 0) return [];

  const items: StepperItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const chunk = matches[i][0].trim();
    const parsed = parseSingleStep(chunk, i + 1);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

/**
 * Groups consecutive step items into a unified stepper block.
 */
export function groupSteppers<T extends { type: string }>(
  blocks: T[],
  isStep: (b: T) => boolean,
  getStep: (b: T) => StepperItem,
  createStepper: (steps: StepperItem[]) => T
): T[] {
  const result: T[] = [];
  let currentSteps: StepperItem[] = [];

  const flush = () => {
    if (currentSteps.length > 0) {
      result.push(createStepper([...currentSteps]));
      currentSteps = [];
    }
  };

  for (const block of blocks) {
    if (isStep(block)) {
      currentSteps.push(getStep(block));
    } else {
      flush();
      result.push(block);
    }
  }

  flush();
  return result;
}
