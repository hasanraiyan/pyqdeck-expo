// Must stay in sync with pyqdeck-frontend's app/[semester]/[subject]/[year]/[questionId]
// route - this is the exact path both the website and Android App Links (see
// app.json's intentFilters + the site's public/.well-known/assetlinks.json) resolve.
export function buildQuestionUrl(
  semesterId: string,
  subjectId: string,
  year: number | string,
  questionId: string
): string {
  return `https://pyqdeck.in/${semesterId}/${subjectId}/${year}/${questionId}`;
}
