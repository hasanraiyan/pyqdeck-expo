import { COLORS, FONTS } from '../theme/colors';

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
}

interface RenderJob {
  id: string;
  code: string;
  resolve: (result: RenderResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// In-memory cache for rendered diagrams so revisited screens render instantly (0ms)
const svgCache = new Map<string, RenderResult>();
const SVG_CACHE_MAX = 40;

function cacheSet(key: string, value: RenderResult) {
  svgCache.delete(key);
  svgCache.set(key, value);
  // Map iterates in insertion order, so the first key is the least recently set.
  while (svgCache.size > SVG_CACHE_MAX) {
    const oldest = svgCache.keys().next().value;
    if (oldest === undefined) break;
    svgCache.delete(oldest);
  }
}

// In-flight pending jobs mapped by diagram code to deduplicate identical diagrams
const inFlightRequests = new Map<string, Array<{ resolve: (res: RenderResult) => void; reject: (err: Error) => void }>>();

// Internal queue and worker state
const jobQueue: RenderJob[] = [];
let activeJob: RenderJob | null = null;
let jobCounter = 0;
let isWorkerReady = false;
let sendToWorkerCallback: ((codeStr: string) => void) | null = null;
let jobTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

const JOB_TIMEOUT_MS = 6000;

// The worker WebView (and its 2.5 MB mermaid bundle) is only started once a
// diagram actually needs rendering, so screens without diagrams never pay for it.
let workerRequested = false;
const workerRequestListeners = new Set<() => void>();

export function isWorkerRequested(): boolean {
  return workerRequested;
}

export function subscribeWorkerRequested(listener: () => void): () => void {
  workerRequestListeners.add(listener);
  return () => {
    workerRequestListeners.delete(listener);
  };
}

function requestWorker() {
  if (workerRequested) return;
  workerRequested = true;
  workerRequestListeners.forEach((l) => l());
}

export function getCachedDiagram(code: string): RenderResult | undefined {
  return svgCache.get(code.trim());
}

/**
 * Register the singleton worker's sender function.
 * Called when MermaidWorker mounts.
 */
export function registerMermaidWorker(
  sender: (codeStr: string) => void
): () => void {
  sendToWorkerCallback = sender;
  return () => {
    sendToWorkerCallback = null;
    isWorkerReady = false;
  };
}

/**
 * Notify the renderer service that the worker WebView has finished bootstrapping Mermaid.
 */
export function notifyWorkerReady() {
  isWorkerReady = true;
  processNextJob();
}

/**
 * Handle incoming message from the worker WebView.
 */
export function handleWorkerMessage(data: any) {
  if (!data || typeof data !== 'object') return;

  if (data.type === 'ready') {
    notifyWorkerReady();
    return;
  }

  if (data.type === 'rendered') {
    if (jobTimeoutTimer) {
      clearTimeout(jobTimeoutTimer);
      jobTimeoutTimer = null;
    }

    const { id, svg, width, height } = data;
    if (activeJob && activeJob.id === id) {
      const result: RenderResult = {
        svg: String(svg || ''),
        width: Number(width) || 300,
        height: Number(height) || 180,
      };

      // Save to cache
      cacheSet(activeJob.code.trim(), result);

      // Resolve the primary job
      activeJob.resolve(result);

      // Resolve any deduplicated in-flight requests for the same code
      const pendingList = inFlightRequests.get(activeJob.code.trim());
      if (pendingList) {
        pendingList.forEach((req) => req.resolve(result));
        inFlightRequests.delete(activeJob.code.trim());
      }

      activeJob = null;
    }

    processNextJob();
    return;
  }

  if (data.type === 'error') {
    if (jobTimeoutTimer) {
      clearTimeout(jobTimeoutTimer);
      jobTimeoutTimer = null;
    }

    const { id, message } = data;
    if (activeJob && activeJob.id === id) {
      const err = new Error(message || 'Failed to render diagram');
      activeJob.reject(err);

      const pendingList = inFlightRequests.get(activeJob.code.trim());
      if (pendingList) {
        pendingList.forEach((req) => req.reject(err));
        inFlightRequests.delete(activeJob.code.trim());
      }

      activeJob = null;
    }

    processNextJob();
    return;
  }
}

/**
 * Enqueue a Mermaid diagram for background rendering.
 * Returns a Promise that resolves with the rendered SVG and bounding dimensions.
 */
export function renderMermaid(code: string): Promise<RenderResult> {
  const trimmed = code.trim();

  // 1. Instant Cache Hit
  const cached = svgCache.get(trimmed);
  if (cached) {
    return Promise.resolve(cached);
  }

  // 2. In-flight Deduplication
  const existingInFlight = inFlightRequests.get(trimmed);
  if (existingInFlight) {
    return new Promise<RenderResult>((resolve, reject) => {
      existingInFlight.push({ resolve, reject });
    });
  }

  // 3. New Job (wakes the worker WebView if it has not started yet)
  requestWorker();
  return new Promise<RenderResult>((resolve, reject) => {
    inFlightRequests.set(trimmed, []);

    const job: RenderJob = {
      id: `m_${Date.now()}_${++jobCounter}`,
      code: trimmed,
      resolve,
      reject,
      timestamp: Date.now(),
    };

    jobQueue.push(job);
    processNextJob();
  });
}

function processNextJob() {
  if (!isWorkerReady || activeJob !== null || jobQueue.length === 0) {
    return;
  }

  if (!sendToWorkerCallback) {
    return;
  }

  activeJob = jobQueue.shift()!;

  // Safety timeout in case worker hangs on complex syntax
  jobTimeoutTimer = setTimeout(() => {
    if (activeJob) {
      console.warn('[MermaidRenderer] Job timeout for diagram:', activeJob.id);
      const err = new Error('Mermaid render timeout');
      activeJob.reject(err);

      const pendingList = inFlightRequests.get(activeJob.code.trim());
      if (pendingList) {
        pendingList.forEach((req) => req.reject(err));
        inFlightRequests.delete(activeJob.code.trim());
      }

      activeJob = null;
      processNextJob();
    }
  }, JOB_TIMEOUT_MS);

  // Send instruction to worker WebView
  const payload = JSON.stringify({
    type: 'render',
    id: activeJob.id,
    code: activeJob.code,
  });

  sendToWorkerCallback(`window.__mermaidWorkerRender && window.__mermaidWorkerRender(${payload}); true;`);
}

/**
 * Generate worker HTML that initializes Mermaid once and listens for render calls.
 */
export function getWorkerHtml(mermaidJs: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 800px;
      height: 600px;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, Roboto, sans-serif;
    }
    #measure {
      position: absolute;
      left: 0;
      top: 0;
      visibility: hidden;
      pointer-events: none;
    }
  </style>
  <script>
    ${mermaidJs}
  </script>
</head>
<body>
  <div id="measure"></div>
  <script>
    function post(obj) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          primaryColor: '${COLORS.card}',
          primaryTextColor: '${COLORS.text}',
          primaryBorderColor: '${COLORS.border}',
          lineColor: '${COLORS.primary}',
          secondaryColor: '${COLORS.cardSecondary}',
          tertiaryColor: '${COLORS.accent}',
          fontFamily: '${FONTS.sans || 'sans-serif'}',
          fontSize: '13px'
        }
      });
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', message: 'Failed to init mermaid: ' + String(e) });
    }

    window.__mermaidWorkerRender = function(job) {
      if (!job || !job.id || !job.code) return;
      try {
        var uniqueSvgId = 'mm_' + Math.random().toString(36).substring(2, 9);
        mermaid.render(uniqueSvgId, job.code).then(function(res) {
          var m = document.getElementById('measure');
          m.innerHTML = res.svg;
          var svgEl = m.querySelector('svg');
          var w = 320;
          var h = 180;
          if (svgEl) {
            var rect = svgEl.getBoundingClientRect();
            w = rect.width || 320;
            h = rect.height || 180;
            var vb = svgEl.getAttribute('viewBox');
            if (vb) {
              var parts = vb.trim().split(/[\\s,]+/);
              if (parts.length === 4) {
                var vbW = parseFloat(parts[2]);
                var vbH = parseFloat(parts[3]);
                if (vbW > 0 && vbH > 0) {
                  w = vbW;
                  h = vbH;
                }
              }
            }
          }
          m.innerHTML = '';
          post({ type: 'rendered', id: job.id, svg: res.svg, width: w, height: h });
        }).catch(function(err) {
          post({ type: 'error', id: job.id, message: (err && (err.message || err.str)) || String(err) });
        });
      } catch (err) {
        post({ type: 'error', id: job.id, message: (err && (err.message || err.str)) || String(err) });
      }
    };
  </script>
</body>
</html>`;
}
