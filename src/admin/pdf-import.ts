import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = worker;
export async function readPdfText(file: File): Promise<string> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  task.onPassword = () => {
    void task.destroy();
  };
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50)
      throw Error(
        "Preview supports PDFs with up to 50 pages. The reference PDF is still uploaded.",
      );
    const lines: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let line = "",
        lastY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (lastY !== undefined && Math.abs(lastY - y) > 3 && line) {
          lines.push(line);
          line = "";
        }
        line += (line ? " " : "") + item.str;
        lastY = y;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
          lastY = undefined;
        }
      }
      if (line) lines.push(line);
      page.cleanup();
    }
    return lines.join("\n");
  } finally {
    await task.destroy();
  }
}
