// Origin-private file storage for large exports. The finished MP4 stays on disk and is handed
// back as a File, so its size is bounded by free storage rather than by page memory.

const EXPORT_DIR = 'ct-exports';

export interface ExportDiskTarget {
  /** Queues a positional write. Failures surface from `finish`. */
  write(data: Uint8Array, position: number): void;
  finish(): Promise<File>;
  discard(): Promise<void>;
}

type WritableHandle = FileSystemFileHandle & {
  createWritable?: (options?: { keepExistingData?: boolean }) => Promise<FileSystemWritableFileStream>;
};

async function getExportDir(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
      return null;
    }
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(EXPORT_DIR, { create });
  } catch {
    return null;
  }
}

/** True when this browser can stream an export to origin-private storage from the page. */
export function isExportDiskTargetSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.storage) &&
    typeof navigator.storage.getDirectory === 'function' &&
    typeof FileSystemFileHandle !== 'undefined' &&
    typeof (FileSystemFileHandle.prototype as WritableHandle).createWritable === 'function'
  );
}

/** Removes exports left behind by earlier sessions. Call when no exported file is in use. */
export async function clearExportStorage(): Promise<void> {
  const dir = await getExportDir(false);
  if (!dir) return;
  try {
    const names: string[] = [];
    for await (const name of (dir as any).keys() as AsyncIterable<string>) names.push(name);
    for (const name of names) {
      try {
        await dir.removeEntry(name);
      } catch {
        // A file that is still open elsewhere is cleaned up on a later run.
      }
    }
  } catch {
    // Storage cleanup is best effort.
  }
}

/** Returns null when the browser cannot provide a writable origin-private file. */
export async function openExportDiskTarget(): Promise<ExportDiskTarget | null> {
  if (!isExportDiskTargetSupported()) return null;
  const dir = await getExportDir(true);
  if (!dir) return null;

  const name = `export-${Date.now()}.mp4`;
  let writable: FileSystemWritableFileStream;
  let handle: FileSystemFileHandle;
  try {
    handle = await dir.getFileHandle(name, { create: true });
    writable = await (handle as WritableHandle).createWritable!();
  } catch {
    try { await dir.removeEntry(name); } catch { /* nothing was created */ }
    return null;
  }

  let chain: Promise<void> = Promise.resolve();
  let failure: unknown = null;
  let closed = false;

  return {
    write(data, position) {
      // The muxer may reuse its chunk buffer after this callback returns.
      const copy = data.slice();
      chain = chain.then(async () => {
        if (failure) return;
        try {
          await writable.write({ type: 'write', position, data: copy });
        } catch (e) {
          failure = e;
        }
      });
    },
    async finish() {
      await chain;
      if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
      await writable.close();
      closed = true;
      return handle.getFile();
    },
    async discard() {
      try { await chain; } catch { /* ignored: the file is being removed */ }
      if (!closed) {
        try { await writable.abort(); } catch { /* already closed */ }
        closed = true;
      }
      try { await dir.removeEntry(name); } catch { /* already removed */ }
    },
  };
}
