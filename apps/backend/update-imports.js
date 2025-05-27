#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', { cwd: __dirname });

// Mapping of relative paths to @ aliases
const pathMappings = [
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/utils\/([^"']+)["']/g, to: `from "@/utils/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/types\/([^"']+)["']/g, to: `from "@/types/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/config\/([^"']+)["']/g, to: `from "@/config/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/database\/([^"']+)["']/g, to: `from "@/database/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/plugins\/([^"']+)["']/g, to: `from "@/plugins/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/\.\.\/modules\/([^"']+)["']/g, to: `from "@/modules/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/utils\/([^"']+)["']/g, to: `from "@/utils/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/types\/([^"']+)["']/g, to: `from "@/types/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/config\/([^"']+)["']/g, to: `from "@/config/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/database\/([^"']+)["']/g, to: `from "@/database/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/plugins\/([^"']+)["']/g, to: `from "@/plugins/$1"` },
  { from: /from\s+["']\.\.\/\.\.\/modules\/([^"']+)["']/g, to: `from "@/modules/$1"` },
  { from: /from\s+["']\.\.\/utils\/([^"']+)["']/g, to: `from "@/utils/$1"` },
  { from: /from\s+["']\.\.\/types\/([^"']+)["']/g, to: `from "@/types/$1"` },
  { from: /from\s+["']\.\.\/config\/([^"']+)["']/g, to: `from "@/config/$1"` },
  { from: /from\s+["']\.\.\/database\/([^"']+)["']/g, to: `from "@/database/$1"` },
  { from: /from\s+["']\.\.\/plugins\/([^"']+)["']/g, to: `from "@/plugins/$1"` },
  { from: /from\s+["']\.\.\/modules\/([^"']+)["']/g, to: `from "@/modules/$1"` },
  { from: /from\s+["']\.\/utils\/([^"']+)["']/g, to: `from "@/utils/$1"` },
  { from: /from\s+["']\.\/types\/([^"']+)["']/g, to: `from "@/types/$1"` },
  { from: /from\s+["']\.\/config\/([^"']+)["']/g, to: `from "@/config/$1"` },
  { from: /from\s+["']\.\/database\/([^"']+)["']/g, to: `from "@/database/$1"` },
  { from: /from\s+["']\.\/plugins\/([^"']+)["']/g, to: `from "@/plugins/$1"` },
  { from: /from\s+["']\.\/modules\/([^"']+)["']/g, to: `from "@/modules/$1"` },
];

let totalChanges = 0;

files.forEach(file => {
  const filePath = join(__dirname, file);
  let content = readFileSync(filePath, 'utf8');
  let fileChanges = 0;
  
  pathMappings.forEach(mapping => {
    const matches = content.match(mapping.from);
    if (matches) {
      content = content.replace(mapping.from, mapping.to);
      fileChanges += matches.length;
    }
  });
  
  if (fileChanges > 0) {
    writeFileSync(filePath, content);
    console.log(`Updated ${fileChanges} imports in ${file}`);
    totalChanges += fileChanges;
  }
});

console.log(`\nTotal: Updated ${totalChanges} import statements across ${files.length} files`); 