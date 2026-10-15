'use client';
import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';
import { googleButtonWidth } from './logic';

interface GsiId {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window { google?: { accounts: { id: GsiId } } }
}

// initialize() hanya boleh sekali per muatan halaman; callback diarahkan ke komponen yang sedang aktif.
let initialized = false;
let activeHandler: ((credential: string) => void) | null = null;

/**
 * Tombol Google Identity Services. Credential langsung diteruskan ke onCredential:
 * tidak disimpan, tidak dicatat, dan tidak ditaruh di URL/storage.
 */
export function GoogleButton({ onCredential, disabled = false, text = 'signin_with' }: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  text?: 'signin_with' | 'signup_with';
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);

  useEffect(() => { callbackRef.current = onCredential; });

  const render = useCallback(() => {
    const gsi = window.google?.accounts.id;
    const box = boxRef.current;
    if (!gsi || !box || !clientId) return;
    if (!initialized) {
      gsi.initialize({
        client_id: clientId,
        callback: response => { if (response.credential) activeHandler?.(response.credential); },
      });
      initialized = true;
    }
    box.replaceChildren();
    gsi.renderButton(box, {
      type: 'standard', size: 'large', theme: 'outline', locale: 'id', text,
      width: googleButtonWidth(wrapRef.current?.clientWidth ?? 0),
    });
  }, [clientId, text]);

  useEffect(() => {
    const mine = (credential: string) => callbackRef.current(credential);
    activeHandler = mine;
    const box = boxRef.current;
    render(); // skrip mungkin sudah dimuat (pindah halaman)
    return () => {
      if (activeHandler === mine) activeHandler = null;
      box?.replaceChildren();
    };
  }, [render]);

  if (!clientId) return null;
  return (
    <div ref={wrapRef} className="w-full max-w-[400px] mx-auto">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
      <div
        ref={boxRef}
        aria-disabled={disabled}
        className={`flex justify-center min-h-[44px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      />
    </div>
  );
}
