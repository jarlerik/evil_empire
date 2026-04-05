import { mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import { createLogger } from "../utils/logger.js";

const log = createLogger("alpaca:cache");

const CACHE_DIR = ".cache/alpaca";
let cacheReady = false;

// In-memory cache: preloaded from disk for fast access
let memoryCache: Map<string, unknown> | null = null;
// Track hash->url mapping for in-memory lookups
const hashToData = new Map<string, unknown>();

// API call tracking — use getCacheStats() to inspect
let _cacheHits = 0;
let _cacheMisses = 0;

export function getCacheStats(): { hits: number; misses: number } {
  return { hits: _cacheHits, misses: _cacheMisses };
}

export function resetCacheStats(): void {
  _cacheHits = 0;
  _cacheMisses = 0;
}

async function ensureCacheDir(): Promise<void> {
  if (cacheReady) return;
  await mkdir(CACHE_DIR, { recursive: true });
  cacheReady = true;
}

function cacheKey(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return `${CACHE_DIR}/${hash}.json`;
}

function cacheHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/**
 * Preload all cache files into memory. Call once before running simulations
 * to avoid repeated disk I/O.
 */
export async function preloadCache(): Promise<number> {
  await ensureCacheDir();
  memoryCache = new Map();

  const files = await readdir(CACHE_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  log.info("Preloading cache into memory", { files: jsonFiles.length });

  let loaded = 0;
  // Load in parallel batches of 500
  const BATCH = 500;
  for (let i = 0; i < jsonFiles.length; i += BATCH) {
    const batch = jsonFiles.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (file) => {
        const hash = file.replace(".json", "");
        try {
          const data = await Bun.file(`${CACHE_DIR}/${file}`).text();
          hashToData.set(hash, JSON.parse(data));
          loaded++;
        } catch {
          // Skip corrupted files
        }
      })
    );
  }

  log.info("Cache preloaded", { loaded, total: jsonFiles.length });
  return loaded;
}

export async function getCached<T>(url: string): Promise<T | null> {
  const hash = cacheHash(url);

  // Check in-memory cache first
  if (hashToData.has(hash)) {
    _cacheHits++;
    return hashToData.get(hash) as T;
  }

  // Fall back to disk
  const path = `${CACHE_DIR}/${hash}.json`;
  if (!existsSync(path)) {
    _cacheMisses++;
    log.debug("Cache miss", { url: url.slice(0, 100) });
    return null;
  }

  try {
    const data = await Bun.file(path).text();
    const parsed = JSON.parse(data) as T;
    // Store in memory for next access
    hashToData.set(hash, parsed);
    _cacheHits++;
    log.debug("Cache hit (disk)", { url: url.slice(0, 80) });
    return parsed;
  } catch {
    _cacheMisses++;
    return null;
  }
}

export async function setCached<T>(url: string, data: T): Promise<void> {
  await ensureCacheDir();
  const hash = cacheHash(url);
  const path = `${CACHE_DIR}/${hash}.json`;
  // Store in memory
  hashToData.set(hash, data);
  // Write to disk
  await Bun.write(path, JSON.stringify(data));
}
