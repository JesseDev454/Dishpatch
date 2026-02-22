const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const backendEnv = path.join(rootDir, "backend", ".env");
const backendExampleEnv = path.join(rootDir, "backend", ".env.example");

if (!fs.existsSync(backendEnv) && fs.existsSync(backendExampleEnv)) {
  fs.copyFileSync(backendExampleEnv, backendEnv);
  console.log("[setup] Created backend/.env from backend/.env.example");
  console.log("[setup] Update DATABASE_URL and JWT secrets in backend/.env before production use.");
}
