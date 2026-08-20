import { Platform } from 'react-native';
import {
  Semester,
  SubjectSummary,
  SubjectMeta,
  QuestionListResult,
  Solution,
  SubjectSearchResult,
  SubjectsPage,
  AllQuestionsSearchResult,
  SimilarQuestionsResult,
  RepeatedQuestionsResult,
} from '../types';

export const API_BASE_URL = 'https://api.pyqdeck.in/api/public';

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(errData.message || `Request failed with status ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error occurred');
  }
}

export const getSemesters = () => fetchApi<Semester[]>('/semesters');

export const getSubjects = (semesterId: string) =>
  fetchApi<SubjectSummary[]>(`/semesters/${semesterId}/subjects`);

export const getSubjectMeta = (subjectId: string) =>
  fetchApi<SubjectMeta>(`/subjects/${subjectId}/meta`);

export const getQuestions = (
  subjectId: string,
  params: { year?: number; chapter?: string; search?: string; limit?: number; offset?: number } = {}
) => {
  const qs = new URLSearchParams();
  if (params.year !== undefined) qs.set('year', String(params.year));
  if (params.chapter) qs.set('chapter', params.chapter);
  if (params.search) qs.set('search', params.search);
  qs.set('limit', String(params.limit ?? 50));
  if (params.offset) qs.set('offset', String(params.offset));
  return fetchApi<QuestionListResult>(`/subjects/${subjectId}/questions?${qs.toString()}`);
};

export const getQuestion = (subjectId: string, questionId: string) =>
  fetchApi<QuestionListResult>(`/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}`);

export const getSolution = (subjectId: string, questionId: string) =>
  fetchApi<Solution>(`/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/solution`);

export const searchSubjects = (query: string, limit = 20) =>
  fetchApi<SubjectSearchResult>(`/subjects/search?q=${encodeURIComponent(query)}&limit=${limit}`);

export const listAllSubjects = (params: { q?: string; page?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  return fetchApi<SubjectsPage>(`/subjects?${qs.toString()}`);
};

export const searchAllQuestions = (query: string, limit = 20) =>
  fetchApi<AllQuestionsSearchResult>(`/questions/semantic-search?q=${encodeURIComponent(query)}&limit=${limit}`);

export const getSimilarQuestions = (subjectId: string, questionId: string, limit = 5) =>
  fetchApi<SimilarQuestionsResult>(`/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/similar?limit=${limit}`);

export const getRepeatedQuestions = (subjectId: string, questionId: string, limit = 5) =>
  fetchApi<RepeatedQuestionsResult>(`/subjects/${subjectId}/questions/${encodeURIComponent(questionId)}/repeats?limit=${limit}`);

