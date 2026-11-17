// Extracts text from a PDF in the browser, so large PDFs don't have to be
// parsed inside the edge function (which hits CPU/time limits and returns 504).
const MAX_CHARS = 35000;

export async function extractPdfTextInBrowser(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  let total = 0;
  for (let i = 1; i <= pdf.numPages && total < MAX_CHARS; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      pages.push(text);
      total += text.length;
    }
  }
  await pdf.destroy();
  return pages.join('\n\n').slice(0, MAX_CHARS);
}
