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

// Fallback for PDFs without a text layer (slides exported as images, scans):
// render pages to JPEG so the vision-capable model can read them.
const MAX_IMAGE_PAGES = 20;
const IMAGE_WIDTH = 1100;

export async function renderPdfPagesAsImages(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const total = pdf.numPages;
  const count = Math.min(total, MAX_IMAGE_PAGES);
  // Spread the selected pages evenly across the whole document.
  const pageNumbers = Array.from({ length: count }, (_, i) =>
    count === total ? i + 1 : Math.round(1 + (i * (total - 1)) / (count - 1)),
  );

  const images: string[] = [];
  for (const n of pageNumbers) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: IMAGE_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    canvas.width = canvas.height = 0;
  }
  await pdf.destroy();
  return images;
}
