'use client';
import { useCallback, useEffect, useState } from 'react';

/** Hitung mundur di klien (mis. 60 detik setelah 429). Server tidak mengirim sisa waktu, jadi nilainya tetap. */
export function useCooldown(seconds = 60) {
  const [left, setLeft] = useState(0);
  const start = useCallback(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, start };
}
