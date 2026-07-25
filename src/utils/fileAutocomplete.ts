import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { loadSettings } from "../config/settings.js";

export function getProjectFiles(cwd: string, query: string): string[] {
  if (!existsSync(cwd)) return [];
  const results: string[] = [];
  const searchLower = query.toLowerCase();

  let userIgnored: string[] = [];
  try {
    const settings = loadSettings();
    userIgnored = settings.ignoredDirectories || [];
  } catch {}

  const defaultIgnored = ["node_modules", ".git", "dist", "build"];
  const ignoredSet = new Set([...defaultIgnored, ...userIgnored].map((d) => d.trim().toLowerCase()).filter(Boolean));

  function walk(dir: string) {
    if (results.length > 50) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignoredSet.has(entry.toLowerCase())) continue;
      const fullPath = join(dir, entry);
      let isDir = false;
      try {
        isDir = statSync(fullPath).isDirectory();
      } catch {
        continue;
      }
      
      const relPath = relative(cwd, fullPath).replace(/\\/g, "/");
      if (isDir) {
        walk(fullPath);
      } else {
        if (relPath.toLowerCase().includes(searchLower)) {
          results.push(relPath);
        }
      }
    }
  }

  walk(cwd);
  return results.slice(0, 50);
}
