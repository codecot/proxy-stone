#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find all JavaScript files in dist
const files = glob.sync("dist/**/*.js", { cwd: __dirname });

console.log(`Found ${files.length} JavaScript files to process...`);

files.forEach((file) => {
  const filePath = join(__dirname, file);
  let content = readFileSync(filePath, "utf-8");
  let modified = false;

  // Calculate relative path from this file to the dist root
  const fileDir = dirname(filePath);
  const distRoot = join(__dirname, "dist");
  const relativeToRoot = relative(fileDir, distRoot);
  const prefix = relativeToRoot ? relativeToRoot + "/" : "./";

  // Replace @/ aliases with relative paths
  const newContent = content.replace(
    /from\s+["']@\/([^"']+)["']/g,
    (match, path) => {
      modified = true;
      return `from "${prefix}${path}"`;
    }
  );

  // Replace import("@/...") dynamic imports
  const finalContent = newContent.replace(
    /import\s*\(\s*["']@\/([^"']+)["']\s*\)/g,
    (match, path) => {
      modified = true;
      return `import("${prefix}${path}")`;
    }
  );

  if (modified) {
    writeFileSync(filePath, finalContent, "utf-8");
    console.log(`Updated: ${file}`);
  }
});

console.log("✅ Path alias resolution completed!");
