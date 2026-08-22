const { spawn } = require("child_process");
const child = spawn("npx", ["next", "dev", "--port", "3000", "--hostname", "0.0.0.0"], {
  cwd: "C:\\Users\\A\\Documents\\New folder\\affiliate-system",
  stdio: "inherit",
  shell: true
});
child.on("exit", (code) => process.exit(code));
