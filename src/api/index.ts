import {
  Semester,
  SubjectSummary,
  SubjectMeta,
  QuestionListResult,
  QuestionSummary,
  Solution,
  SubjectSearchResult,
  SubjectsPage,
  AllQuestionsSearchResult,
  SimilarQuestionsResult,
  RepeatedQuestionsResult,
  TopicNotesSearchResult,
  AiOverview,
} from '../types';
import {
  Branch,
  BranchSemesters,
  BranchSemester,
  SyllabusSubject,
} from '../types/syllabus';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Backend from './backend';
import { authHeader, getAuthToken } from '../auth/token';
import {
  FailureKind,
  MESSAGES,
  isDeviceOffline,
  isTimeoutError,
  kindForStatus,
} from '../utils/netError';
import { cloudinaryErrorMessage, overallProgress } from '../admin/directUpload';
import { paperStatusPath } from './paperStatusUrl';
import { buildCommitPages, newPagesOf, type Slot } from '../admin/paperEdit';
import { invalidateAfterAdminWrite, withFresh } from './adminFresh';
import { queryClient } from './queryClient';

export class ApiError extends Error {
  status?: number;
  retryAfterSec?: number;
  /** Machine-readable code from the server body (e.g. `sync_unavailable`), when present. */
  code?: string;
  /** Why this failed, for callers that branch rather than just render. */
  kind: FailureKind;
  /**
   * True when `message` was written for a student to read. The screens all do
   * `e?.message || 'Could not load X.'`, so an unclassified platform string
   * would always win over their own fallback - this flag is what lets
   * userMessage() tell "safe to show" from "raw platform noise".
   */
  userFacing: boolean;
  /** The original error, kept for Sentry rather than for the UI. */
  cause?: unknown;

  constructor(
    message: string,
    status?: number,
    retryAfterSec?: number,
    kind: FailureKind = 'unknown',
    cause?: unknown
  ) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.kind = kind;
    this.userFacing = true;
    this.cause = cause;
    this.name = 'ApiError';
  }
}

// A request that never answers is worse than one that fails: the screen sits
// on a spinner forever. Cap it so a dead connection surfaces as a timeout.
const REQUEST_TIMEOUT_MS = 20000;

// Backend subject names occasionally carry stray leading/trailing whitespace,
// which breaks alphabetical sorting and looks wrong wherever it's rendered.
function trimName<T extends { name: string }>(item: T): T {
  return item.name === item.name.trim() ? item : { ...item, name: item.name.trim() };
}

// Every request resolves its origin at call time instead of closing over a
// constant, which is what lets a failover move the whole app between
// deployments without an APK update.
//
// `mount` picks the server prefix. Almost everything lives under the cached,
// anonymous /api/public; per-account endpoints (progress sync) live under
// /api/me, which the server marks private + no-store so no shared cache can
// serve one student's data to another.
type Mount = '/api/public' | '/api/me' | '/api/admin-app';
async function request<T>(
  path: string,
  init?: RequestInit,
  isRetry = false,
  mount: Mount = '/api/public'
): Promise<T> {
  // The origin this attempt is sent to, kept so failover() can tell whether
  // selection has since moved elsewhere (see Backend.failover).
  const origin = await Backend.ready();
  // Admins (and anyone who just saved an edit) skip every HTTP cache on public
  // reads - see adminFresh.ts. Students keep the cached path.
  const isPublicRead = mount === '/api/public' && (!init?.method || init.method === 'GET');
  const url = `${origin.root}${mount}${isPublicRead ? withFresh(path) : path}`;

  try {
    const res = await fetchWithTimeout(url, init);

    if (!res.ok) {
      // 5xx means this origin is sick, so it's worth asking whether the other
      // one is healthier. 4xx deliberately is not: a 404 for a missing
      // question or a 429 from the rate limiter says nothing about the
      // origin's health, and retrying a 429 elsewhere would dodge a limit the
      // app is supposed to respect (and lose the Retry-After below).
      if (res.status >= 500 && !isRetry && (await Backend.failover(origin.id))) {
        return request<T>(path, init, true, mount);
      }

      const errData = await res.json().catch(() => ({}));
      const rawRetry = res.headers?.get?.('Retry-After');
      const retryAfterSec = rawRetry ? Number(rawRetry) : undefined;
      const kind = kindForStatus(res.status);
      // Our own backend writes messages meant for students, so prefer it.
      // res.statusText ("Bad Gateway") is not that, hence the MESSAGES map.
      const apiError = new ApiError(
        errData.message || MESSAGES[kind],
        res.status,
        retryAfterSec,
        kind
      );
      if (typeof errData.code === 'string') apiError.code = errData.code;
      throw apiError;
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;

    // The caller cancelled (a newer search superseded this one, or the screen
    // went away). That says nothing about the origin's health, so no failover
    // and no user-facing error - React Query discards the result anyway.
    if (init?.signal?.aborted) throw err;

    // Transport-level failure (DNS, refused, timeout) - the classic sign the
    // origin is gone rather than unhappy. isRetry caps this at one extra
    // attempt, so a genuinely offline device fails fast into the React Query cache
    // the callers below fall back on, instead of ping-ponging between origins.
    if (!isRetry && (await Backend.failover(origin.id))) {
      return request<T>(path, init, true, mount);
    }

    // Both origins are unreachable. Ask the OS why before blaming the server:
    // "you're offline" is actionable, "couldn't reach PYQdeck" is not.
    const kind: FailureKind = (await isDeviceOffline())
      ? 'offline'
      : isTimeoutError(err)
        ? 'timeout'
        : 'unreachable';
    throw new ApiError(MESSAGES[kind], undefined, undefined, kind, err);
  }
}

// fetch has no timeout of its own, so a half-open socket hangs the screen's
// spinner indefinitely. AbortController is used rather than
// AbortSignal.timeout for Hermes support on older Android. A caller's own
// signal (React Query cancelling a superseded search, say) is forwarded so
// either one aborts the request.
// Tells the server which build is calling, so it can count versions in its sync
// metrics (docs/SRS-event-driven-architecture.md, SRV-FR-1). Advisory only: the
// server never changes an answer because of it. Native builds only - on the web
// preview a custom header would turn every GET into a CORS preflight for nothing.
const VERSION_HEADERS: Record<string, string> = (() => {
  if (Platform.OS === 'web') return {};
  const out: Record<string, string> = {};
  const version = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.android?.versionCode;
  if (version) out['X-App-Version'] = version;
  if (build) out['X-App-Build'] = String(build);
  return out;
})();

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  const onOuterAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', onOuterAbort);
  }
  try {
    return await fetch(url, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), ...VERSION_HEADERS },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

const fetchApi = <T,>(path: string, signal?: AbortSignal): Promise<T> =>
  request<T>(path, signal ? { signal } : undefined);

const postApi = <T,>(path: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

// POST with the Clerk session token attached. Only for endpoints the server
// gates behind requireSignIn - everything else deliberately stays anonymous.
// Sends no Authorization header at all when signed out, so the server answers
// with its own 401 rather than the client inventing one.
const postApiAuthed = async <T,>(path: string, body: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });

// Authed request to the per-account /api/me mount. The 401 a signed-out or
// expired session earns comes straight from the server.
const requestMe = async <T,>(path: string, method: string, body?: unknown): Promise<T> =>
  request<T>(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    false,
    '/api/me'
  );

// Remote app config (minimum version, banner, kill switches). Anonymous.
export const getRemoteAppConfig = (signal?: AbortSignal): Promise<unknown> =>
  fetchApi<unknown>('/app-config', signal);

// -------------------------------------------------------------
// CATALOG ENDPOINTS
// -------------------------------------------------------------
// Plain fetchers: no caching in here. Caching, freshness, de-duplication and
// the offline fallback live in React Query (see queryClient.ts / queries.ts).

export const getSemesters = (signal?: AbortSignal): Promise<Semester[]> =>
  fetchApi<Semester[]>('/semesters', signal);

export const getSubjects = async (
  semesterId: string,
  signal?: AbortSignal
): Promise<SubjectSummary[]> => {
  const live = await fetchApi<SubjectSummary[]>(`/semesters/${semesterId}/subjects`, signal);
  return live.map(trimName);
};

export const getSubjectMeta = async (subjectId: string, signal?: AbortSignal): Promise<SubjectMeta> =>
  trimName(await fetchApi<SubjectMeta>(`/subjects/${subjectId}/meta`, signal));

export const getQuestions = (
  subjectId: string,
  params: { year?: number; chapter?: string; search?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<QuestionListResult> => {
  const qs = new URLSearchParams();
  if (params.year !== undefined) qs.set('year', String(params.year));
  if (params.chapter) qs.set('chapter', params.chapter);
  if (params.search) qs.set('search', params.search);
  qs.set('limit', String(params.limit ?? 50));
  if (params.offset) qs.set('offset', String(params.offset));
  return fetchApi<QuestionListResult>(`/subjects/${subjectId}/questions?${qs.toString()}`, signal);
};

export const getQuestion = (subjectId: string, questionId: string, signal?: AbortSignal) =>
  fetchApi<QuestionListResult>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}`,
    signal
  );

export const getSolution = (
  subjectId: string,
  questionId: string,
  signal?: AbortSignal
): Promise<Solution> =>
  fetchApi<Solution>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution`,
    signal
  );

export const searchSubjects = async (query: string, limit = 20, signal?: AbortSignal) => {
  const res = await fetchApi<SubjectSearchResult>(
    `/subjects/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal
  );
  return { ...res, subjects: Array.isArray(res?.subjects) ? res.subjects.map(trimName) : [] };
};

export const listAllSubjects = async (
  params: { q?: string; page?: number } = {},
  signal?: AbortSignal
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  const res = await fetchApi<SubjectsPage>(`/subjects?${qs.toString()}`, signal);
  return { ...res, subjects: Array.isArray(res?.subjects) ? res.subjects.map(trimName) : [] };
};

// Hybrid, not semantic-only: the meaning-based search cannot represent a rare
// acronym ("OSI model" came back as COCOMO / ER models / waterfall), so the
// server combines it with a keyword search that weighs rare words and exact
// phrases (hybridSearchService.js). Its `score` is a fusion value, not a
// similarity, so the UI must not show it as a "match" number.
export const searchAllQuestions = (query: string, limit = 20, signal?: AbortSignal) =>
  fetchApi<AllQuestionsSearchResult>(
    `/questions/hybrid-search?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal
  );

export const getSimilarQuestions = (
  subjectId: string,
  questionId: string,
  limit = 5,
  signal?: AbortSignal
) =>
  fetchApi<SimilarQuestionsResult>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/similar?limit=${limit}`,
    signal
  );

export const getRepeatedQuestions = (
  subjectId: string,
  questionId: string,
  limit = 5,
  signal?: AbortSignal
) =>
  fetchApi<RepeatedQuestionsResult>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/repeats?limit=${limit}`,
    signal
  );

// Requires a signed-in user. The server derives the voter identity from the
// Clerk session, so no voterId is sent - passing one would be ignored.
export const voteSolution = (subjectId: string, questionId: string, value: 1 | -1 | 0) =>
  postApiAuthed<{ upvotes: number; downvotes: number }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/vote`,
    { value }
  );

// Requires a signed-in user, same as voting. The server derives the reporter
// identity from the Clerk session, so no voterId is sent.
export const reportSolution = (
  subjectId: string,
  questionId: string,
  reason: 'incorrect' | 'incomplete' | 'formatting' | 'other',
  message?: string
) =>
  postApiAuthed<{ id: string; status: string }>(
    `/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution/report`,
    { reason, message }
  );

// Sent authed so the server can key the token to the account when the user is
// signed in - that link is what lets a "your report was fixed" push find them,
// and it now reaches every device they use rather than only the one they
// reported from. A signed-out device still registers fine (no Authorization
// header, no identity) and keeps receiving broadcasts.
export const registerPushToken = (token: string, platform: 'ios' | 'android') =>
  postApiAuthed<{ success: boolean }>('/push-token', { token, platform });

// Detaches this device's push token from the signed-in account (the token stays
// registered, so broadcasts still arrive). Called just before sign-out.
export const unlinkPushToken = (token: string) =>
  requestMe<{ success: boolean }>('/push-token', 'DELETE', { token });

// -------------------------------------------------------------
// ADMIN (/api/admin-app, admin accounts only)
// -------------------------------------------------------------
// The same tools as the admin MCP, authenticated with the normal session. The
// server decides what the account may do; these are only the calls.

const requestAdmin = async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
  const result = await request<T>(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    false,
    '/api/admin-app'
  );
  // Every successful write (anything but a GET) makes cached reads wrong, so
  // drop them here once instead of in each editor. Users and notify are POSTs
  // too but touch no cached content.
  if (method !== 'GET' && !path.startsWith('/users') && !path.startsWith('/notify')) {
    invalidateAfterAdminWrite(queryClient);
  }
  return result;
};

export interface AdminGrant {
  actions: '*' | string[];
  branches?: '*' | string[];
}
export interface AdminMe {
  name: string;
  role: string;
  access: { full: boolean; source: string; tools: Record<string, AdminGrant> };
}

export const adminMe = () => requestAdmin<AdminMe>('/me', 'GET');
export const adminInsights = () => requestAdmin<Record<string, any>>('/insights', 'GET');
export const adminAudit = (p: { limit?: number; offset?: number; tool?: string } = {}) =>
  requestAdmin<{
    count: number;
    entries: {
      at: string;
      admin: string;
      tool: string;
      action?: string;
      target?: string;
      outcome: 'ok' | 'error';
      detail?: string;
    }[];
  }>(
    `/audit?limit=${p.limit ?? 30}&offset=${p.offset ?? 0}${p.tool ? `&tool=${encodeURIComponent(p.tool)}` : ''}`,
    'GET'
  );
export const adminUsers = (body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/users', 'POST', body);
export const adminGetConfig = () => requestAdmin<Record<string, any>>('/config', 'GET');
export const adminPutConfig = (data: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/config', 'PUT', data);
export const adminAiStatus = () => requestAdmin<Record<string, any>>('/ai-overview', 'GET');
export const adminAiToggle = (feature: 'overview' | 'followups' | 'chat', enabled: boolean) =>
  requestAdmin<Record<string, any>>('/ai-overview/toggle', 'POST', { feature, enabled });
export const adminAiUsage = (feature: 'overview' | 'chat', days = 7) =>
  requestAdmin<Record<string, any>>(`/ai-overview/usage?feature=${feature}&days=${days}`, 'GET');
export const adminNotify =(body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/notify', 'POST', body);
// Syllabus & notes (docs/SRS-admin-syllabus-notes-app.md Phase 1). Same guard
// as the MCP: grants incl. branch scope, audit, error map. 404 = server
// predates this — the app hides the section (deploy order: server first).
export const adminSyllabus = (body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/syllabus', 'POST', body);
export const adminNotes = (body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/notes', 'POST', body);
// Past-paper catalog (semesters/subjects) and content (questions/solutions).
// Same tools as the MCP's manage_catalog / manage_content.
export const adminCatalog = (body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/catalog', 'POST', body);
export const adminContent = (body: Record<string, unknown>) =>
  requestAdmin<Record<string, any>>('/content', 'POST', body);

// -------------------------------------------------------------
// ACCOUNT PROGRESS SYNC (/api/me, signed-in only)
// -------------------------------------------------------------

export interface ProgressSyncOp {
  opId: string;
  subject: string;
  moduleId: string;
  topicId: string;
  done: boolean;
  updatedAt: number;
}

export interface ProgressSyncResponse {
  results: { opId: string | null; status: 'applied' | 'superseded' | 'rejected'; code?: string }[];
  items: {
    subject: string;
    moduleId: string;
    topicId: string;
    done: boolean;
    updatedAt: number;
  }[];
  cursor: string;
  hasMore: boolean;
  serverTime: number;
}


export interface AccountSettings {
  /** Chosen "Ask AI" engine id, or null when the account has not chosen one. */
  askAiEngine: string | null;
  /** 'accordion' | 'cards' */
  readingLayout: string | null;
  volumeScroll: boolean | null;
  /** Branch slug chosen in the Syllabus tab, e.g. "cse". */
  syllabusBranch: string | null;
}

export interface RecentsPayload {
  recentStudy: unknown[];
  recentNotes: unknown[];
}

type SectionError = { error: { code: string; message: string } };

export interface SyncAllRequest {
  progress: { cursor: string | null; ops: ProgressSyncOp[]; limit?: number };
  settings?: { changes?: Partial<AccountSettings> };
  recents?: RecentsPayload;
  /** This phone's Expo push token, so the server's nudge skips the sender. */
  device?: { pushToken: string };
}

export interface SyncAllResponse {
  progress: ProgressSyncResponse;
  settings?: AccountSettings | SectionError;
  recents?: RecentsPayload | SectionError;
}

// One request for everything the app keeps in step with the account: progress
// changes and the pull, setting changes, and Jump Back In. A problem in the
// settings or recents section comes back inside that section and never costs
// the progress result.
export const syncAll = (body: SyncAllRequest) =>
  requestMe<SyncAllResponse>('/sync', 'POST', body);

export interface MyVotes {
  solutionVotes: { solutionId: string; questionId: string | null; value: 1 | -1 }[];
  noteVotes: { topicId: string; value: 1 | -1 }[];
}

export const getMyVotes = (subjectId: string) =>
  requestMe<MyVotes>(`/votes?subject=${encodeURIComponent(subjectId)}`, 'GET');

// -------------------------------------------------------------
// ORIGINAL PAPERS (docs/SRS-original-paper-viewer.md)
// -------------------------------------------------------------

export interface PaperStatus {
  subject: string;
  year: number;
  hasOriginal: boolean;
  pages: number;
  updatedAt: string | null;
}

/**
 * Public existence check: drives the question list's paper buttons. `fresh`
 * skips the public cache (see paperStatusUrl.ts); admins use it so a paper they
 * just uploaded or removed is reflected immediately.
 */
export const getPaperStatus = (
  subjectId: string,
  year: number,
  signal?: AbortSignal,
  fresh = false
) =>
  fetchApi<PaperStatus>(paperStatusPath(subjectId, year, fresh ? Date.now() : undefined), signal);

export interface PaperViewerPage {
  order: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface PaperViewerPayload {
  subject: string;
  year: number;
  refreshAfter: string;
  pages: PaperViewerPage[];
}

// Signed page URLs for the viewer. Authed per account; throws (never empty)
// so the screen can show loading / retry / offline states. No fallback in
// here - the screen decides about placeholder data in dev.
export const getOriginalPaperPages = (subjectId: string, year: number) =>
  requestMe<PaperViewerPayload>(`/papers/${encodeURIComponent(subjectId)}/${year}/pages`, 'GET');

export interface PaperUploadSummary {
  subject: string;
  year: number;
  pages: number;
  replaced: boolean;
  uploadedBy: string | null;
  updatedAt: string;
}

export interface PaperPageAsset {
  uri: string;
  name: string;
  type: string;
}

// Legacy admin upload: the pages travel through OUR server (multipart). Kept
// only as a fallback for a server that does not have the direct-upload
// endpoints yet. fetch has no upload progress, so this goes over
// XMLHttpRequest; progress is the uploaded fraction 0..1.
// Never throws on its own terms: HTTP errors come back as ApiError.
const adminUploadPaperViaServer = (
  subjectId: string,
  year: number,
  assets: PaperPageAsset[],
  onProgress?: (fraction: number) => void
): Promise<PaperUploadSummary> =>
  (async () => {
    const origin = await Backend.ready();
    const token = await getAuthToken();
    return new Promise<PaperUploadSummary>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${origin.root}/api/admin-app/papers`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const form = new FormData();
      form.append('subject', subjectId);
      form.append('year', String(year));
      assets.forEach((a, i) => {
        form.append('pages', {
          uri: a.uri,
          name: a.name || `page-${i + 1}.jpg`,
          type: a.type || 'image/jpeg',
        } as any);
      });
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
        };
      }
      xhr.onload = () => {
        let body: any = {};
        try {
          body = JSON.parse(xhr.responseText || '{}');
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as PaperUploadSummary);
          return;
        }
        const kind = kindForStatus(xhr.status);
        const err = new ApiError(
          (body && body.message) || MESSAGES[kind],
          xhr.status,
          undefined,
          kind
        );
        if (typeof body?.code === 'string') err.code = body.code;
        reject(err);
      };
      xhr.onerror = () => reject(new ApiError(MESSAGES.unreachable, undefined, undefined, 'unreachable'));
      xhr.ontimeout = () => reject(new ApiError(MESSAGES.timeout, undefined, undefined, 'timeout'));
      xhr.send(form as any);
    });
  })();

// Direct upload: our server only SIGNS each page and later records the result;
// the image bytes go straight from the phone to Cloudinary. That keeps large
// photos out of the host's request-size limits and out of the server's memory.
interface PaperSignedPage {
  order: number;
  /** Exactly the fields Cloudinary must receive, covered by `signature`. */
  params: Record<string, string>;
  signature: string;
}
interface PaperSignResponse {
  uploadUrl: string;
  apiKey: string;
  pages: PaperSignedPage[];
}

const uploadPageToCloudinary = (
  uploadUrl: string,
  apiKey: string,
  page: PaperSignedPage,
  asset: PaperPageAsset,
  onProgress: (fraction: number) => void
): Promise<{ public_id: string }> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.timeout = 120000;
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.name || `page-${page.order}.jpg`,
      type: asset.type || 'image/jpeg',
    } as any);
    form.append('api_key', apiKey);
    form.append('signature', page.signature);
    Object.entries(page.params).forEach(([k, v]) => form.append(k, v));
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      };
    }
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText || 'null');
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && typeof body?.public_id === 'string') {
        resolve(body);
        return;
      }
      reject(
        new ApiError(
          `Page ${page.order}: ${cloudinaryErrorMessage(body, xhr.status)}`,
          xhr.status,
          undefined,
          kindForStatus(xhr.status)
        )
      );
    };
    xhr.onerror = () => reject(new ApiError(MESSAGES.unreachable, undefined, undefined, 'unreachable'));
    xhr.ontimeout = () => reject(new ApiError(MESSAGES.timeout, undefined, undefined, 'timeout'));
    xhr.send(form as any);
  });

export interface AdminPaperPage {
  order: number;
  publicId: string;
  width: number | null;
  height: number | null;
  /** Signed full image and a small signed thumbnail. */
  url: string;
  thumbUrl: string;
}
export interface AdminPaperPages {
  subject: string;
  year: number;
  /** Send back as `baseUpdatedAt` when saving so a stale edit is refused. */
  updatedAt: string | null;
  pages: AdminPaperPage[];
}

/** The paper's current pages for the editor (ids + signed thumbnails). */
export const adminPaperPages = (subjectId: string, year: number) =>
  requestAdmin<AdminPaperPages>(`/papers/${encodeURIComponent(subjectId)}/${year}`, 'GET');

/**
 * Saves the paper as the given ordered list of pages: each is either a page the
 * paper already has (kept by id) or a new local photo. Only the NEW photos are
 * sent: sign with our server, upload each straight to Cloudinary (one at a time,
 * so progress is smooth and memory stays low), then commit the whole ordered
 * list so the server records it and deletes the pages left out. Progress is the
 * overall fraction 0..1 of the new uploads. `baseUpdatedAt` is the paper's
 * updatedAt when it was opened; if someone else changed it since, the server
 * answers 409. A list of only new pages falls back to the through-the-server
 * route when the server predates the sign/commit endpoints.
 */
export const adminSavePaper = async (
  subjectId: string,
  year: number,
  slots: Slot[],
  baseUpdatedAt: string | null,
  onProgress?: (fraction: number) => void
): Promise<PaperUploadSummary> => {
  const fresh = newPagesOf(slots);
  const issued: string[] = [];

  if (fresh.length > 0) {
    let signed: PaperSignResponse;
    try {
      signed = await requestAdmin<PaperSignResponse>('/papers/sign', 'POST', {
        subject: subjectId,
        year,
        count: fresh.length,
      });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        // Server without direct upload: only a whole-paper replace can work.
        if (fresh.length === slots.length) {
          return adminUploadPaperViaServer(subjectId, year, fresh, onProgress);
        }
        throw new ApiError(
          'The server needs updating before single pages can be edited.',
          e.status,
          undefined,
          'unknown'
        );
      }
      throw e;
    }
    if (!Array.isArray(signed?.pages) || signed.pages.length !== fresh.length) {
      throw new ApiError('The server returned an unexpected upload plan.', undefined, undefined, 'unknown');
    }
    for (let i = 0; i < fresh.length; i++) {
      const res = await uploadPageToCloudinary(
        signed.uploadUrl,
        signed.apiKey,
        signed.pages[i],
        fresh[i],
        (fraction) => onProgress?.(overallProgress(i, fresh.length, fraction))
      );
      issued.push(res.public_id);
      onProgress?.(overallProgress(i + 1, fresh.length, 0));
    }
  }

  return requestAdmin<PaperUploadSummary>('/papers/commit', 'POST', {
    subject: subjectId,
    year,
    pages: buildCommitPages(slots, issued),
    ...(baseUpdatedAt ? { baseUpdatedAt } : {}),
  });
};

/** Replace a whole paper with these photos (every page new). */
export const adminUploadPaper = (
  subjectId: string,
  year: number,
  assets: PaperPageAsset[],
  onProgress?: (fraction: number) => void
): Promise<PaperUploadSummary> =>
  adminSavePaper(
    subjectId,
    year,
    assets.map((page) => ({ kind: 'new' as const, page })),
    null,
    onProgress
  );

/** Admin removal of a year's paper. */
export const adminDeletePaper = (subjectId: string, year: number) =>
  requestAdmin<{ subject: string; year: number; deleted: boolean; pages: number }>(
    `/papers/${encodeURIComponent(subjectId)}/${year}`,
    'DELETE'
  );

// Paid-ads entitlement for the signed-in account (docs/SRS-advertisements.md,
// FR-ADS-14). Never throws for the caller: signed-out, offline and error all
// mean "not proven ad-free", so the caller fails open (shows ads).
export const getMyAdsEntitlement = async (): Promise<{ adFree: boolean }> => {
  try {
    const res = await requestMe<{ adFree: boolean }>('/ads', 'GET');
    return { adFree: res?.adFree === true };
  } catch {
    return { adFree: false };
  }
};



// -------------------------------------------------------------
// SYLLABUS
// -------------------------------------------------------------
// Plain fetchers. The syllabus is network-first (staleTime 0 in queries.ts) so
// an admin's edit reaches every install without waiting out a TTL; the
// persisted React Query copy is only the offline fallback. Notes are fetched
// separately, on demand - see getTopicNotes.

const syllabusRead = <T,>(path: string, signal?: AbortSignal): Promise<T> =>
  fetchApi<T>(path, signal);

export const getBranches = (signal?: AbortSignal) =>
  syllabusRead<Branch[]>('/syllabus/branches', signal);

export const getBranchSemesters = (branch: string, signal?: AbortSignal) =>
  syllabusRead<BranchSemesters>(
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters`,
    signal
  );

export const getBranchSemester = (branch: string, semester: number, signal?: AbortSignal) =>
  syllabusRead<BranchSemester>(
    `/syllabus/branches/${encodeURIComponent(branch)}/semesters/${semester}`,
    signal
  );

export const getSyllabusSubject = (subject: string, signal?: AbortSignal) =>
  syllabusRead<SyllabusSubject>(`/syllabus/subjects/${encodeURIComponent(subject)}`, signal);

// --- topic-wise past papers (links an admin made between questions and topics) ---

/** Distinct past-paper questions per topic and per module of one syllabus subject. */
export interface TopicQuestionCounts {
  subject: string;
  topics: Record<string, number>;
  modules: Record<string, number>;
  total: number;
}

export const getTopicQuestionCounts = (subject: string, signal?: AbortSignal) =>
  syllabusRead<TopicQuestionCounts>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topic-questions/counts`,
    signal
  );

export interface TopicQuestion extends QuestionSummary {
  /** The past-paper subject the question belongs to (open it there). */
  subjectId: string | null;
  subjectName: string | null;
  /** The question's other topics in the same syllabus subject. */
  otherTopics: { id: string; title: string; moduleId: string }[];
}

export interface TopicQuestionsResult {
  syllabusSubject: string;
  topic: { id: string; title: string; moduleId: string; moduleTitle: string };
  summary: { count: number; withSolution: number; years: { year: number; count: number }[] };
  total: number;
  returned: number;
  offset: number;
  questions: TopicQuestion[];
}

export const getTopicQuestions = (
  subject: string,
  topicId: string,
  params: { year?: number; hasSolution?: boolean; limit?: number; offset?: number } = {},
  signal?: AbortSignal
) => {
  const qs = new URLSearchParams();
  if (params.year) qs.set('year', String(params.year));
  if (params.hasSolution !== undefined) qs.set('hasSolution', String(params.hasSolution));
  qs.set('limit', String(params.limit ?? 30));
  qs.set('offset', String(params.offset ?? 0));
  return syllabusRead<TopicQuestionsResult>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/questions?${qs}`,
    signal
  );
};

/** The syllabus topics a past-paper question is linked to (chips on its detail screen). */
export interface QuestionTopicRef {
  syllabusSubject: string;
  syllabusSubjectName: string;
  moduleId: string;
  moduleTitle: string;
  topicId: string;
  title: string;
}

export const getQuestionTopicRefs = (subjectId: string, questionId: string, signal?: AbortSignal) =>
  fetchApi<{ subject: string; questionId: string; topics: QuestionTopicRef[] }>(
    `/subjects/${encodeURIComponent(subjectId)}/questions/${encodeURIComponent(questionId)}/topics`,
    signal
  );

/** The syllabus subject(s) a past-paper subject belongs to (the way back from the PYQ tab). */
export interface SyllabusForPyq {
  subject: string;
  syllabusSubjects: {
    id: string;
    name: string;
    semester: number;
    branches: { id: string; name: string }[];
  }[];
}

export const getSyllabusForPyqSubject = (subjectId: string, signal?: AbortSignal) =>
  fetchApi<SyllabusForPyq>(`/subjects/${encodeURIComponent(subjectId)}/syllabus`, signal);

// Deliberately not part of getSyllabusSubject's payload - a subject screen
// renders every topic in the tree at once, so bundling every topic's notes
// into that one fetch would make it slow for a subject whose notes most
// students never open. Fetched only when a topic's notes screen is opened,
// and NOT cached (unlike the rest of the syllabus) - an admin can revise a
// topic's notes at any time and a student should never be stuck reading a
// stale AsyncStorage copy.
export const getTopicNotes = (subject: string, topicId: string, signal?: AbortSignal) =>
  fetchApi<{ id: string; title: string; notes: string }>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/notes`,
    signal
  );

export type NoteVotes = { topicId: string; upvotes: number; downvotes: number; myVote: 1 | -1 | 0 };

// Totals are public, but `myVote` is only filled in when the request carries
// the Clerk token, so this one read goes out authed (and anonymous when signed
// out - authHeader() then sends nothing).
export const getNoteVotes = async (
  subject: string,
  topicId: string,
  signal?: AbortSignal
): Promise<NoteVotes> =>
  request<NoteVotes>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/notes/votes`,
    { headers: await authHeader(), ...(signal ? { signal } : {}) }
  );

// Both need a signed-in account; identity comes from the Clerk session.
export const voteNote = (subject: string, topicId: string, value: 1 | -1 | 0) =>
  postApiAuthed<NoteVotes>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/notes/vote`,
    { value }
  );

export type NoteReportReason = 'incorrect' | 'incomplete' | 'outdated' | 'offensive' | 'other';

export const reportNote = (
  subject: string,
  topicId: string,
  reason: NoteReportReason,
  message?: string
) =>
  postApiAuthed<{ id: string; status: string }>(
    `/syllabus/subjects/${encodeURIComponent(subject)}/topics/${encodeURIComponent(topicId)}/notes/report`,
    { reason, message }
  );

export const searchTopicNotes = (query: string, limit = 20, signal?: AbortSignal) =>
  fetchApi<TopicNotesSearchResult>(
    `/syllabus/search/topics?q=${encodeURIComponent(query)}&limit=${limit}`,
    signal
  );

// -------------------------------------------------------------
// AI OVERVIEW (Vertex AI Search, proxied by the server)
// -------------------------------------------------------------

// Asked once per app session before the card is ever rendered, so a
// deployment with the feature switched off costs nothing but this one cheap
// call. Never throws: a failure here just means "no card".
export const getAiOverviewStatus = async (signal?: AbortSignal): Promise<boolean> => {
  try {
    const res = await fetchApi<{ enabled: boolean }>('/search/ai-overview/status', signal);
    return Boolean(res?.enabled);
  } catch {
    return false;
  }
};

// POST, not GET: the server keeps the query out of a cacheable URL because
// Cloudflare caches public GETs for an hour and every miss is billed.
export const getAiOverview = (query: string, limit?: number, signal?: AbortSignal) =>
  postApi<AiOverview>('/search/ai-overview', { query, ...(limit ? { limit } : {}) }, signal);

// -------------------------------------------------------------
// STUDENT PAPER CONTRIBUTIONS
// -------------------------------------------------------------

export interface ContributionFile {
  url: string;
  name: string;
  size: number;
  storageId: string;
  resourceType: 'raw' | 'image';
}

export interface PaperContribution {
  _id: string;
  subjectName: string;
  year?: number;
  fileType: 'pdf' | 'images';
  files: ContributionFile[];
  status: 'received' | 'reviewed' | 'approved' | 'rejected';
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitContributionResult {
  success: boolean;
  submissionId: string;
  message: string;
  submission: PaperContribution;
}

/**
 * Upload student exam paper contribution.
 * Works for both anonymous guests and signed-in users.
 * Uses XMLHttpRequest for solid React Native Android/iOS multipart/form-data support and real progress tracking.
 */
export const submitPaperContribution = async (params: {
  files: Array<{ uri: string; name: string; type: string }>;
  subjectName?: string;
  year?: string;
  onProgress?: (percent: number) => void;
}): Promise<SubmitContributionResult> => {
  const origin = await Backend.ready();
  const token = await getAuthToken();
  const url = `${origin.root}/api/contributions/submit`;

  return new Promise<SubmitContributionResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 60000; // 60s timeout for large uploads

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Advisory version headers
    if (Platform.OS !== 'web') {
      const version = Constants.expoConfig?.version;
      const build = Constants.expoConfig?.android?.versionCode;
      if (version) xhr.setRequestHeader('X-App-Version', version);
      if (build) xhr.setRequestHeader('X-App-Build', String(build));
    }

    const formData = new FormData();
    if (params.subjectName?.trim()) {
      formData.append('subjectName', params.subjectName.trim());
    }
    if (params.year?.trim()) {
      formData.append('year', params.year.trim());
    }

    for (let i = 0; i < params.files.length; i++) {
      const f = params.files[i];
      const isPdf = f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf');
      const cleanName = f.name || (isPdf ? `paper_${i + 1}.pdf` : `photo_${i + 1}.jpg`);
      const mime = isPdf ? 'application/pdf' : f.type || 'image/jpeg';

      formData.append('files', {
        uri: Platform.OS === 'android' ? f.uri : f.uri.replace('file://', ''),
        name: cleanName,
        type: mime,
      } as any);
    }

    if (xhr.upload && params.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.min(98, Math.round((e.loaded / e.total) * 100));
          params.onProgress?.(pct);
        }
      };
    }

    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText || '{}');
      } catch {
        body = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as SubmitContributionResult);
        return;
      }

      const kind = kindForStatus(xhr.status);
      const err = new ApiError(
        body?.message || MESSAGES[kind] || 'Failed to submit paper.',
        xhr.status,
        undefined,
        kind
      );
      if (typeof body?.code === 'string') err.code = body.code;
      reject(err);
    };

    xhr.onerror = () => {
      reject(new ApiError(MESSAGES.unreachable, undefined, undefined, 'unreachable'));
    };

    xhr.ontimeout = () => {
      reject(new ApiError(MESSAGES.timeout, undefined, undefined, 'timeout'));
    };

    xhr.send(formData as any);
  });
};

/**
 * Get the signed-in student's own contribution history.
 * Returns [] when signed out.
 */
export const getMyContributions = (): Promise<PaperContribution[]> =>
  requestMe<PaperContribution[]>('/contributions', 'GET');
