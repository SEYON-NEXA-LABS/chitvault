/**
 * Shared Version Recovery Utilities
 * Consolidates 'ChunkLoadError' detection and recovery logic.
 */

const RECOVERY_STORAGE_KEY = 'chitvault_chunk_reload_count';

/**
 * Detects if an error is likely due to a version mismatch (stale assets).
 */
export function isVersionMismatch(error: Error | string | any): boolean {
  if (!error) return false;
  
  const msg = typeof error === 'string' 
    ? error 
    : (error.message || String(error));

  return (
    msg.includes('ChunkLoadError') || 
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch') ||
    msg.includes("Unexpected token '<'") || // HTML served instead of JS
    msg.includes("Unexpected token '{'")    // Common in some SSR failure cases
  );
}

/**
 * Performs a full system recovery by clearing caches and service workers.
 * Then reloads the page with a cache-busting timestamp.
 */
export async function handleHardReset() {
  try {
    // 1. Clear Browser Caches (Service Worker & Asset Caches)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // 2. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // 3. Clear Session Recovery State
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    
    // 4. Force Hard Reload with Cache-Buster
    const url = new URL(window.location.href);
    url.searchParams.set('recovery', Date.now().toString());
    window.location.replace(url.toString());
  } catch (e) {
    console.error('System Recovery Failed:', e);
    window.location.reload();
  }
}

/**
 * Manages automatic recovery attempts stored in sessionStorage.
 * Prevents infinite reload loops.
 */
export function getAutoRecoveryAction(error: any, maxAttempts = 3): 'RELOAD' | 'HARD_RESET' | 'NONE' {
  if (!isVersionMismatch(error)) return 'NONE';

  const now = Date.now();
  const rawData = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
  const data = JSON.parse(rawData || '{"count":0, "last":0}');

  // If last attempt was over 1 minute ago, reset the counter
  if (now - data.last > 60000) {
    data.count = 0;
  }

  if (data.count < maxAttempts) {
    data.count++;
    data.last = now;
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(data));

    // On second attempt or higher, escalate to a hard reset
    return data.count > 1 ? 'HARD_RESET' : 'RELOAD';
  }

  return 'NONE';
}
