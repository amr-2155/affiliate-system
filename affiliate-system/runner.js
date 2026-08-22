const { spawn } = require("child_process");
const { execSync } = require("child_process");

const isDev = process.env.NODE_ENV === "development";
const cwd = "C:\\Users\\A\\Documents\\New folder\\affiliate-system";

if (!isDev) {
  console.log("[runner] Building for production...");
  try {
    execSync("npx next build", { cwd, stdio: "inherit", shell: true });
  } catch (e) {
    console.error("[runner] Build failed:", e.message);
    process.exit(1);
  }
}

const cmd = isDev ? "next dev" : "next start";
const args = isDev
  ? ["dev", "--port", "3000", "--hostname", "0.0.0.0"]
  : ["start", "--port", "3000", "--hostname", "0.0.0.0"];

const child = spawn("npx", args, {
  cwd,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_ENV: isDev ? "development" : "production" },
});
child.on("exit", (code) => process.exit(code));
