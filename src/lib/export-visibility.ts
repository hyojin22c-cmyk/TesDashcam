export const waitForVisibleDocument = (signal: AbortSignal): Promise<void> => {
  signal.throwIfAborted();
  if (!document.hidden) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      signal.removeEventListener('abort', onAbort);
    };
    const onVisibilityChange = () => {
      if (document.hidden) return;
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    signal.addEventListener('abort', onAbort);
  });
};

const codecInterruptionErrors = new Set([
  'AbortError',
  'EncodingError',
  'InvalidStateError',
  'OperationError',
  'QuotaExceededError',
]);

export const isExportCodecInterruption = (error: unknown) =>
  error instanceof Error &&
  (codecInterruptionErrors.has(error.name) ||
    /codec.{0,50}reclaim|reclaim.{0,50}codec/i.test(error.message));
