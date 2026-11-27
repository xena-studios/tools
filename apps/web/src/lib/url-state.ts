// Keeps a tool's settings in the URL, so a link shares the exact design.
//
// Pages are prerendered with the defaults, so the first render always uses
// them (and matches the HTML). The URL is read after hydration and written
// back with replaceState as things change: no history entry per keystroke.

import { useCallback, useEffect, useRef, useState } from "react";

export interface UrlCodec<T> {
  decode: (params: URLSearchParams, defaults: T) => T;
  encode: (value: T, defaults: T) => URLSearchParams;
}

export function useUrlState<T>(defaults: T, codec: UrlCodec<T>) {
  const [value, setValue] = useState<T>(defaults);
  const loaded = useRef(false);
  const codecRef = useRef(codec);
  const defaultsRef = useRef(defaults);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) {
      setValue(codecRef.current.decode(params, defaultsRef.current));
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const id = window.setTimeout(() => {
      const params = codecRef.current.encode(value, defaultsRef.current);
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    }, 250);
    return () => window.clearTimeout(id);
  }, [value]);

  const update = useCallback((patch: Partial<T>) => setValue((v) => ({ ...v, ...patch })), []);
  const reset = useCallback(() => setValue(defaultsRef.current), []);

  return { value, update, reset, setValue };
}

export const flag = (params: URLSearchParams, key: string, fallback: boolean) => {
  const v = params.get(key);
  return v === null ? fallback : v === "1";
};
