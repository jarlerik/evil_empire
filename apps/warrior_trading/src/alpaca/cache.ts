import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { createLogger } from "../utils/logger.js";

const log = createLogger("alpaca:cache");

const CACHE_DIR = ".cache/alpaca";
let cacheReady = false;

async function ensureCacheDir(): Promise<void> {
  if (cacheReady) return;
  await mkdir(CACHE_DIR, { recursive: true });
  cacheReady = true;
}

function cacheKey(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return `${CACHE_DIR}/${hash}.json`;
}

export async function getCached<T>(url: string): Promise<T | null> {
  const path = cacheKey(url);
  if (!existsSync(path)) return null;

  try {
    const data = await Bun.file(path).text();
    log.debug("Cache hit", { url: url.slice(0, 80) });
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(url: string, data: T): Promise<void> {
  await ensureCacheDir();
  const path = cacheKey(url);
  await Bun.write(path, JSON.stringify(data));
}
