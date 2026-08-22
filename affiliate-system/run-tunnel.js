const { spawn } = require("child_process");
const fs = require("fs");
const logFile = "C:\\Users\\A\\Documents\\New folder\\affiliate-system\\tunnel.log";
const child = spawn("npx", ["cloudflared", "tunnel", "--url", "http://localhost:3000", "--protocol", "http2"], {
  cwd: "C:\\Users\\A\\Documents\\New folder\\affiliate-system",
  shell: true,
  stdio: ["ignore", "pipe", "pipe"]
});
child.stdout.on("data", (data) => {
  const line = data.toString();
  process.stdout.write(line);
  fs.appendFileSync(logFile, line);
});
child.stderr.on("data", (data) => {
  const line = data.toString();
  process.stderr.write(line);
  fs.appendFileSync(logFile, line);
});
child.on("exit", (code) => {
  console.log("Tunnel exited with code " + code);
});
