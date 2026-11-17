// Prepares uploaded study material for the generate-quiz-ai edge function.
// Everything is converted to plain text (or page images for PDFs without a
// text layer) in the browser, so the server never receives the original
// file and large files no longer hit request-size or CPU limits.
import { extractPdfTextInBrowser, renderPdfPagesAsImages } from '@/lib/pdfText';

export const MAX_AI_FILE_SIZE = 200 * 1024 * 1024; // 200MB: browser memory is the only real limit
export const MAX_AI_FILE_SIZE_LABEL = '200MB';

export interface AiFilePayload {
  fileContent: string;
  fileName: string;
  mimeType?: string;
}

const MAX_CHARS = 35000;

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const textRuns = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'g'))].map((m) => decodeXml(m[1]));

async function extractPptxText(file: File): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10));
  const parts: string[] = [];
  for (const name of slideNames) {
    const num = name.match(/\d+/)![0];
    const slide = textRuns(await zip.files[name].async('string'), 'a:t').join(' ').replace(/\s+/g, ' ').trim();
    const notesFile = zip.files[`ppt/notesSlides/notesSlide${num}.xml`];
    const notes = notesFile ? textRuns(await notesFile.async('string'), 'a:t').join(' ').replace(/\s+/g, ' ').trim() : '';
    if (slide || notes) parts.push(`[Slide ${num}] ${slide}${notes ? `\nNotas: ${notes}` : ''}`);
  }
  return parts.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.files['word/document.xml'];
  if (!doc) return '';
  const xml = await doc.async('string');
  return xml
    .split('</w:p>')
    .map((p) => textRuns(p, 'w:t').join(''))
    .filter((t) => t.trim())
    .join('\n');
}

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });

export async function buildAiFilesPayload(
  files: File[],
  serverPdfFallback?: (file: File) => Promise<AiFilePayload>,
): Promise<AiFilePayload[]> {
  const payload: AiFilePayload[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      try {
        const text = await extractPdfTextInBrowser(file);
        if (text.length >= 50) {
          payload.push({ fileContent: text, fileName: file.name });
          continue;
        }
        // No text layer (slides as images / scan): send page images instead.
        const pages = await renderPdfPagesAsImages(file);
        pages.forEach((img, i) =>
          payload.push({ fileContent: img, fileName: `${file.name} (img ${i + 1})`, mimeType: 'image/jpeg' }),
        );
        continue;
      } catch (e) {
        console.warn('Extração local do PDF falhou', e);
        if (!serverPdfFallback) throw new Error(`Não foi possível ler o PDF "${file.name}".`);
        payload.push(await serverPdfFallback(file));
        continue;
      }
    }

    if (name.endsWith('.pptx') || name.endsWith('.docx')) {
      let text = '';
      try {
        text = name.endsWith('.pptx') ? await extractPptxText(file) : await extractDocxText(file);
      } catch (e) {
        console.warn('Falha ao ler arquivo Office', e);
      }
      if (text.trim().length < 50) {
        throw new Error(
          `Não encontrei texto em "${file.name}". Se os slides forem imagens, use Arquivo → Salvar como PDF e envie o PDF.`,
        );
      }
      payload.push({ fileContent: text.slice(0, MAX_CHARS), fileName: file.name });
      continue;
    }

    if (name.endsWith('.doc') || name.endsWith('.ppt')) {
      throw new Error(`O formato antigo de "${file.name}" não é suportado. Salve como .docx/.pptx ou PDF e envie novamente.`);
    }

    // .txt / .md / .csv
    payload.push({ fileContent: (await readAsText(file)).slice(0, MAX_CHARS), fileName: file.name });
  }
  return payload;
}
