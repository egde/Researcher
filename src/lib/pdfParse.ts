export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic require to avoid pdf-parse loading canvas at build time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text as string;
}
