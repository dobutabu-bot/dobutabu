import "dotenv/config";

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const port = optionValue(args, ["-p", "--port"]) || process.env.PORT || "3000";
const hostname = optionValue(args, ["-H", "--hostname"]) || process.env.HOSTNAME || "0.0.0.0";

const nextBin = process.platform === "win32"
  ? "node_modules/.bin/next.cmd"
  : "node_modules/.bin/next";

const child = spawn(nextBin, ["start", "-H", hostname, "-p", port], {
  env: {
    ...process.env,
    HOSTNAME: hostname,
    PORT: port
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function optionValue(values, names) {
  const index = values.findIndex((value) => names.includes(value));
  if (index === -1) return undefined;
  return values[index + 1];
}
