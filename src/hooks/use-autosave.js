import { useEffect, useRef, useState } from 'react';

/**
 * Debounced save whenever `value` changes. Skips the initial load, and flushes a pending save on unmount
 * so leaving a screen right after an edit never loses data. Saves are serialized.
 */
export function useAutosave(value, save, delay = 700) {
  const [status, setStatus] = useState('saved');
  const prevRef = useRef(value);
  const pendingRef = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const chainRef = useRef(Promise.resolve());

  // Saves run one after another so an older, slower request can never overwrite a newer one.
  const enqueue = (v) => {
    chainRef.current = chainRef.current.catch(() => {}).then(() => saveRef.current(v));
    return chainRef.current;
  };

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (value == null || prev == null || prev === value) return;

    pendingRef.current = value;
    setStatus('pending');
    const timer = setTimeout(() => {
      pendingRef.current = null;
      const saving = enqueue(value);
      saving
        // Only the latest queued save may report "saved"; an older one finishing first would flicker.
        .then(() => chainRef.current === saving && !pendingRef.current && setStatus('saved'))
        .catch((err) => setStatus(`error:${err.message}`));
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  useEffect(
    () => () => {
      if (pendingRef.current) enqueue(pendingRef.current).catch(() => {});
    },
    [],
  );

  return status;
}

export function autosaveLabel(status) {
  if (status === 'saved') return 'Đã lưu';
  if (status === 'pending') return 'Đang lưu…';
  return `Lỗi lưu: ${status.slice(6)}`;
}
