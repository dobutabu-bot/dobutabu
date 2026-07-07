function escapeCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

export function rowsToXls(headers: string[], rows: unknown[][], title: string) {
  const renderCell = (value: unknown, tag: "th" | "td") =>
    `<${tag}>${String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")}</${tag}>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
</head>
<body>
  <table>
    <thead><tr>${headers.map((header) => renderCell(header, "th")).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => renderCell(cell, "td")).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
}
