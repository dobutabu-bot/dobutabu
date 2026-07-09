/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { PDFParse } = require("pdf-parse");

PDFParse.setWorker?.(path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs"));

const chunks = [];

process.stdin.on("data", (chunk) => {
  chunks.push(Buffer.from(chunk));
});

process.stdin.on("end", async () => {
  let parser = null;

  try {
    parser = new PDFParse({ data: Buffer.concat(chunks) });
    const parsed = await parser.getText({ pageJoiner: "\n\n" });
    process.stdout.write(JSON.stringify({ text: parsed.text || "" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parse failed";
    process.stderr.write(message);
    process.exitCode = 1;
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
});
