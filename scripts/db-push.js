const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Find .env file in the application root (one level up from scripts/)
const envPath = path.join(__dirname, "..", ".env");

if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, "utf8");
  console.log(".env file size:", envContent.length, "bytes");
  
  // Strip UTF-8 BOM if present
  if (envContent.startsWith("\uFEFF")) {
    envContent = envContent.slice(1);
  }
  
  const loadedKeys = [];
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    // Skip comments and lines without separators
    if (trimmedLine.startsWith("#")) return;
    
    // Support both '=' and ':' as separators
    const hasEquals = trimmedLine.includes("=");
    const hasColon = trimmedLine.includes(":");
    if (!hasEquals && !hasColon) return;
    
    const separator = hasEquals ? "=" : ":";
    const [key, ...valueParts] = trimmedLine.split(separator);
    const trimmedKey = key.trim();
    let value = valueParts.join(separator).trim();
    
    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    
    process.env[trimmedKey] = value;
    loadedKeys.push(trimmedKey);
  });
  console.log("Successfully loaded environment variables from .env. Keys:", loadedKeys);
} else {
  console.warn(".env file not found at:", envPath);
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set in process.env or .env file!");
  console.log("Available environment keys:", Object.keys(process.env).filter(k => !k.startsWith("npm_") && k.length < 30));
  process.exit(1);
}

console.log("Running: npx prisma db push (with inline env)...");

const dbUrl = process.env.DATABASE_URL;
// Escape double quotes in database URL just in case
const escapedDbUrl = dbUrl.replace(/"/g, '\\"');
const cmd = `DATABASE_URL="${escapedDbUrl}" npx prisma db push`;

const child = spawn(cmd, [], {
  stdio: "inherit",
  shell: true,
});

child.on("close", (code) => {
  process.exit(code);
});
