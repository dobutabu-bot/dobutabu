import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const allowedEnvironmentExamples = new Set([
  ".env.example",
  ".env.railway.example",
  ".env.staging.example"
]);

const tracked = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024
});

if (tracked.status !== 0) {
  console.error("FAIL: Git tarafindan izlenen dosyalar okunamadi.");
  process.exit(1);
}

const files = tracked.stdout.split("\0").filter(Boolean);
const findings = [];

for (const file of files) {
  if (isForbiddenTrackedPath(file)) {
    findings.push({ file, line: 0, rule: "TRACKED_PRIVATE_DATA" });
    continue;
  }

  let stat;
  try {
    stat = statSync(file);
  } catch {
    findings.push({ file, line: 0, rule: "TRACKED_FILE_MISSING" });
    continue;
  }

  if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) continue;

  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;

  const lines = bytes.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const rule = sensitiveContentRule(line);
    if (rule) findings.push({ file, line: index + 1, rule });
  });
}

if (findings.length > 0) {
  console.error("FAIL: Git kapsaminda secret veya private data adayi bulundu.");
  for (const finding of findings) {
    const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
    console.error(`- ${location} [${finding.rule}]`);
  }
  console.error("Degerler guvenlik nedeniyle yazdirilmadi.");
  process.exit(1);
}

console.log(`PASS: ${files.length} tracked dosya secret/private-data kurallarindan gecti.`);

function isForbiddenTrackedPath(file) {
  const normalized = file.replaceAll("\\", "/");
  const baseName = normalized.split("/").at(-1) ?? normalized;
  const lower = normalized.toLowerCase();

  if (
    (baseName === ".env" || baseName.startsWith(".env.")) &&
    !allowedEnvironmentExamples.has(baseName)
  ) {
    return true;
  }

  if (/\.(db|sqlite|sqlite3|db-wal|db-shm|db-journal)$/i.test(baseName)) return true;
  if (/^(storage|backups?|recovery-backups|artifacts)\//i.test(lower)) return true;
  if (/^\.release-hotfix-/i.test(lower)) return true;

  return false;
}

function sensitiveContentRule(line) {
  if (/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/.test(line)) {
    return "PRIVATE_KEY";
  }
  if (/\bghp_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/.test(line)) {
    return "GITHUB_TOKEN";
  }
  if (/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(line)) return "API_KEY";
  if (/\bAKIA[0-9A-Z]{16}\b/.test(line)) return "AWS_ACCESS_KEY";
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(line)) {
    return "JWT";
  }

  const databaseUrl = line.match(/\b(?:postgres(?:ql)?|mysql):\/\/([^:\s/]+):([^@\s/]+)@/i);
  if (databaseUrl && !looksLikePlaceholder(databaseUrl[1]) && !looksLikePlaceholder(databaseUrl[2])) {
    return "DATABASE_CREDENTIAL";
  }

  const secretAssignment = line.match(
    /^\s*(?:AUTH_SECRET|SESSION_SECRET|JWT_SECRET|API_TOKEN|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*["']?([^"'#\s]+)/
  );
  if (secretAssignment && !looksLikePlaceholder(secretAssignment[1])) {
    return "LITERAL_SECRET";
  }

  return null;
}

function looksLikePlaceholder(value) {
  return /(?:\$\{|<|>|example|invalid|placeholder|replace|change|dummy|sample|test|ci[-_]?only|local-development|build-time|user|password|host|en-az|rastgele|cok-guclu|alan-adiniz)/i.test(
    value
  );
}
