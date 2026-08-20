import { getDatabase } from './index';
import {
  Semester,
  SubjectSummary,
  SubjectMeta,
  QuestionSummary,
  Solution,
} from '../types';

// 12 Hours in milliseconds for background cache validation
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Generate a deterministic fingerprint hash for a subject's metadata
 */
export function generateSubjectHash(meta: SubjectMeta): string {
  const totalQuestions = meta.years.reduce((acc, y) => acc + y.questionCount, 0);
  const yearsSig = meta.years.map((y) => `${y.year}:${y.questionCount}`).join(',');
  const chaptersSig = meta.chapters.map((c) => `${c.chapter}:${c.questionCount}`).join(',');
  return `${meta.id}_q${totalQuestions}_y[${yearsSig}]_c[${chaptersSig}]`;
}

// -------------------------------------------------------------
// CACHE METADATA & FINGERPRINT CHECKS
// -------------------------------------------------------------

export async function isSubjectCacheFresh(subjectId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ last_checked: number }>(
      'SELECT last_checked FROM cache_meta WHERE key = ?',
      [`subject_meta_${subjectId}`]
    );
    if (!row) return false;
    const isFresh = Date.now() - row.last_checked < CACHE_TTL_MS;
    return isFresh;
  } catch {
    return false;
  }
}

export async function getCachedSubjectHash(subjectId: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ hash: string }>(
      'SELECT hash FROM cache_meta WHERE key = ?',
      [`subject_meta_${subjectId}`]
    );
    return row?.hash || null;
  } catch {
    return null;
  }
}

export async function updateSubjectCacheMeta(subjectId: string, hash: string) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO cache_meta (key, hash, last_checked, updated_at) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET hash = excluded.hash, last_checked = excluded.last_checked, updated_at = excluded.updated_at`,
      [`subject_meta_${subjectId}`, hash, now, now]
    );
  } catch (e) {
    console.error('Failed to update cache meta:', e);
  }
}

// -------------------------------------------------------------
// SEMESTERS & SUBJECTS CACHE
// -------------------------------------------------------------

export async function getCachedSemesters(): Promise<{ semester: Semester; subjectCount: number }[] | null> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string; number: number; subject_count: number }>(
      'SELECT id, number, subject_count FROM semesters ORDER BY number ASC'
    );
    if (!rows || rows.length === 0) return null;
    return rows.map((r) => ({
      semester: { id: r.id, number: r.number },
      subjectCount: r.subject_count,
    }));
  } catch {
    return null;
  }
}

export async function saveCachedSemesters(data: { semester: Semester; subjectCount: number }[]) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    for (const item of data) {
      await db.runAsync(
        `INSERT INTO semesters (id, number, subject_count, cached_at) 
         VALUES (?, ?, ?, ?) 
         ON CONFLICT(id) DO UPDATE SET number = excluded.number, subject_count = excluded.subject_count, cached_at = excluded.cached_at`,
        [item.semester.id, item.semester.number, item.subjectCount, now]
      );
    }
  } catch (e) {
    console.error('Failed to save cached semesters:', e);
  }
}

export async function getCachedSubjects(semesterId: string): Promise<SubjectSummary[] | null> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string; name: string; code: string; question_count: number }>(
      'SELECT id, name, code, question_count FROM subjects WHERE semester_id = ? ORDER BY name ASC',
      [semesterId]
    );
    if (!rows || rows.length === 0) return null;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code || '',
      questionCount: r.question_count,
    }));
  } catch {
    return null;
  }
}

export async function saveCachedSubjects(semesterId: string, subjects: SubjectSummary[]) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    for (const s of subjects) {
      await db.runAsync(
        `INSERT INTO subjects (id, semester_id, name, code, question_count, cached_at) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON CONFLICT(id) DO UPDATE SET semester_id = excluded.semester_id, name = excluded.name, code = excluded.code, question_count = excluded.question_count, cached_at = excluded.cached_at`,
        [s.id, semesterId, s.name, s.code || '', s.questionCount, now]
      );
    }
  } catch (e) {
    console.error('Failed to save cached subjects:', e);
  }
}

export async function getCachedSubjectMeta(subjectId: string): Promise<SubjectMeta | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ id: string; name: string; code: string; meta_json: string }>(
      'SELECT id, name, code, meta_json FROM subjects WHERE id = ?',
      [subjectId]
    );
    if (!row || !row.meta_json) return null;
    const parsed = JSON.parse(row.meta_json);
    return {
      id: row.id,
      name: row.name,
      code: row.code || '',
      years: parsed.years || [],
      chapters: parsed.chapters || [],
    };
  } catch {
    return null;
  }
}

export async function saveCachedSubjectMeta(meta: SubjectMeta) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    const metaJson = JSON.stringify({
      years: meta.years,
      chapters: meta.chapters,
    });
    await db.runAsync(
      `UPDATE subjects SET meta_json = ?, cached_at = ? WHERE id = ?`,
      [metaJson, now, meta.id]
    );
  } catch (e) {
    console.error('Failed to save subject meta cache:', e);
  }
}

// -------------------------------------------------------------
// QUESTIONS CACHE
// -------------------------------------------------------------

export async function getCachedQuestions(
  subjectId: string,
  params: { year?: number; chapter?: string } = {}
): Promise<QuestionSummary[] | null> {
  try {
    const db = await getDatabase();
    let query = 'SELECT * FROM questions WHERE subject_id = ?';
    const args: any[] = [subjectId];

    if (params.year !== undefined) {
      query += ' AND year = ?';
      args.push(params.year);
    }
    if (params.chapter) {
      query += ' AND chapter = ?';
      args.push(params.chapter);
    }

    query += ' ORDER BY year DESC, q_number ASC';

    const rows = await db.getAllAsync<any>(query, args);
    if (!rows || rows.length === 0) return null;

    return rows.map((r) => ({
      questionId: r.question_id,
      year: r.year,
      qNumber: r.q_number || '',
      chapter: r.chapter || '',
      marks: r.marks || 0,
      text: r.text,
      textPreview: r.text_preview || r.text,
      textHtml: r.text_html || '',
      type: r.type || 'text',
      hasSolution: Boolean(r.has_solution),
    }));
  } catch {
    return null;
  }
}

export async function saveCachedQuestions(subjectId: string, questions: QuestionSummary[]) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    for (const q of questions) {
      await db.runAsync(
        `INSERT INTO questions (question_id, subject_id, year, q_number, chapter, marks, text, text_preview, text_html, type, has_solution, cached_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON CONFLICT(question_id) DO UPDATE SET 
           subject_id = excluded.subject_id, 
           year = excluded.year, 
           q_number = excluded.q_number, 
           chapter = excluded.chapter, 
           marks = excluded.marks, 
           text = excluded.text, 
           text_preview = excluded.text_preview, 
           text_html = excluded.text_html, 
           type = excluded.type, 
           has_solution = excluded.has_solution, 
           cached_at = excluded.cached_at`,
        [
          q.questionId,
          subjectId,
          q.year,
          q.qNumber || '',
          q.chapter || '',
          q.marks || 0,
          q.text,
          q.textPreview || '',
          q.textHtml || '',
          q.type || 'text',
          q.hasSolution ? 1 : 0,
          now,
        ]
      );
    }
  } catch (e) {
    console.error('Failed to save questions cache:', e);
  }
}

// -------------------------------------------------------------
// SOLUTIONS CACHE
// -------------------------------------------------------------

export async function getCachedSolution(questionId: string): Promise<Solution | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT s.*, sub.name as subject_name FROM solutions s LEFT JOIN subjects sub ON s.subject_id = sub.id WHERE s.question_id = ?',
      [questionId]
    );
    if (!row) return null;
    return {
      subject: { id: row.subject_id, name: row.subject_name || '' },
      questionId: row.question_id,
      content: row.content,
      contentHtml: row.content_html || '',
      type: row.type || 'markdown',
      votes: row.votes || 0,
      isVerified: row.is_verified === 1 ? true : row.is_verified === 0 ? false : null,
    };
  } catch {
    return null;
  }
}

export async function saveCachedSolution(subjectId: string, solution: Solution) {
  try {
    const db = await getDatabase();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO solutions (question_id, subject_id, content, content_html, type, votes, is_verified, cached_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
       ON CONFLICT(question_id) DO UPDATE SET 
         subject_id = excluded.subject_id, 
         content = excluded.content, 
         content_html = excluded.content_html, 
         type = excluded.type, 
         votes = excluded.votes, 
         is_verified = excluded.is_verified, 
         cached_at = excluded.cached_at`,
      [
        solution.questionId,
        subjectId,
        solution.content,
        solution.contentHtml || '',
        solution.type || 'markdown',
        solution.votes || 0,
        solution.isVerified === true ? 1 : solution.isVerified === false ? 0 : null,
        now,
      ]
    );
  } catch (e) {
    console.error('Failed to save solution cache:', e);
  }
}

// -------------------------------------------------------------
// OFFLINE LOCAL SEARCH
// -------------------------------------------------------------

export async function searchLocalCache(query: string): Promise<{
  subjects: SubjectSummary[];
  questions: QuestionSummary[];
}> {
  try {
    const db = await getDatabase();
    const cleanQuery = `%${query.trim()}%`;

    const [subjectRows, questionRows] = await Promise.all([
      db.getAllAsync<any>(
        'SELECT * FROM subjects WHERE name LIKE ? OR code LIKE ? LIMIT 15',
        [cleanQuery, cleanQuery]
      ),
      db.getAllAsync<any>(
        'SELECT * FROM questions WHERE text LIKE ? OR chapter LIKE ? ORDER BY year DESC LIMIT 25',
        [cleanQuery, cleanQuery]
      ),
    ]);

    const subjects: SubjectSummary[] = (subjectRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code || '',
      questionCount: s.question_count || 0,
    }));

    const questions: QuestionSummary[] = (questionRows || []).map((q) => ({
      questionId: q.question_id,
      year: q.year,
      qNumber: q.q_number || '',
      chapter: q.chapter || '',
      marks: q.marks || 0,
      text: q.text,
      textPreview: q.text_preview || q.text,
      textHtml: q.text_html || '',
      type: q.type || 'text',
      hasSolution: Boolean(q.has_solution),
    }));

    return { subjects, questions };
  } catch {
    return { subjects: [], questions: [] };
  }
}
