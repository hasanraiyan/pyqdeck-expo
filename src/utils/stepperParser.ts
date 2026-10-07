export interface StepperItem {
  stepNumber: string;
  title?: string;
  content: string;
}

/**
 * Parses a header line like ":::step 1: Lexical Analysis" or ":::step 2" or ":::step Handshake"
 */
export function parseStepHeader(headerLine: string, fallbackIndex = 1): { stepNumber: string; title?: string } {
  const raw = headerLine.replace(/^:::step\s*/i, '').trim();
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
  const lines = rawText.trim().split(/\r?\n/);
  if (lines.length === 0) return null;

  const header = lines[0];
  const { stepNumber, title } = parseStepHeader(header, fallbackIndex);

  // Content is all lines after the header, excluding trailing ":::" terminator if present
  let bodyLines = lines.slice(1);
  if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === ':::') {
    bodyLines = bodyLines.slice(0, -1);
  }

  const content = bodyLines.join('\n').trim();

  return {
    stepNumber,
    title,
    content,
  };
}

/**
 * Parses a container :::stepper ... ::: into an array of StepperItems.
 */
export function parseStepperContainer(containerText: string): StepperItem[] {
  if (!containerText) return [];
  // Strip opening :::stepper and closing :::
  const stripped = containerText
    .replace(/^:::stepper\s*/i, '')
    .replace(/:::\s*$/i, '')
    .trim();

  // Split by :::step
  const stepRegex = /(?:^|\r?\n)(:::step[^\r\n]*)/gi;
  const matches = [...stripped.matchAll(stepRegex)];
  if (matches.length === 0) return [];

  const items: StepperItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const matchStart = matches[i].index!;
    const nextStart = i + 1 < matches.length ? matches[i + 1].index! : stripped.length;
    const chunk = stripped.substring(matchStart, nextStart).trim();
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
