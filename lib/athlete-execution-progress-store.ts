const STORAGE_EVENT = 'tempo:live-progress-change';
const fallbackProgress = new Map<string, string>();

function notifyProgressChanged(key: string): void {
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
}

export function getExecutionProgress(key: string): string | null {
  try {
    const savedProgress = localStorage.getItem(key);
    fallbackProgress.delete(key);
    return savedProgress;
  } catch {
    return fallbackProgress.get(key) ?? null;
  }
}

export function saveExecutionProgress(key: string, progress: string): void {
  try {
    localStorage.setItem(key, progress);
    fallbackProgress.delete(key);
  } catch {
    // Keep the current tab usable when persistent browser storage is unavailable.
    fallbackProgress.set(key, progress);
  }
  notifyProgressChanged(key);
}

export function clearExecutionProgress(key: string): void {
  fallbackProgress.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // Clearing this browser's copy is best effort; server completion is separate.
  }
  notifyProgressChanged(key);
}

export function subscribeToExecutionProgress(key: string, callback: () => void): () => void {
  const handleLocalChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === key) callback();
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener(STORAGE_EVENT, handleLocalChange);
  window.addEventListener('storage', handleStorageChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, handleLocalChange);
    window.removeEventListener('storage', handleStorageChange);
  };
}
