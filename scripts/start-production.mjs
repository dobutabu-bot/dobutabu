import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

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
