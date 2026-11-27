// Picking an image: choose a file, drop one, or paste one. It stays in the browser
// as an object URL (blob:), which the page's CSP allows for images. Nothing is uploaded.

import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface LoadedImage {
  url: string;
  name: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}

/** Holds one image as an object URL, revoking the last one when it changes or unmounts. */
export function useImageFile() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = null;
  }, []);
  useEffect(() => revoke, [revoke]);

  const load = useCallback(
    (file: File | Blob, name = file instanceof File ? file.name : "Pasted image") => {
      if (!file.type.startsWith("image/")) {
        setError("That isn't an image. Try a PNG, JPEG, WebP or GIF.");
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        revoke();
        current.current = url;
        setError(null);
        setImage({ url, name, width: img.naturalWidth, height: img.naturalHeight, image: img });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Your browser couldn't read that image. Try saving it as a PNG first.");
      };
      img.src = url;
    },
    [revoke],
  );

  const clear = useCallback(() => {
    revoke();
    setImage(null);
    setError(null);
  }, [revoke]);

  return { image, error, load, clear };
}

interface ImageDropProps {
  onFile: (file: File | Blob) => void;
  /** Also take an image pasted anywhere on the page (text pastes are left alone). */
  paste?: boolean;
  label?: string;
  hint?: React.ReactNode;
  error?: string | null;
  compact?: boolean;
}

export function ImageDrop({
  onFile,
  paste = false,
  label = "Choose an image",
  hint,
  error,
  compact = false,
}: ImageDropProps) {
  const [over, setOver] = useState(false);
  const errorId = useId();
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    if (!paste) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find(
        (i) => i.kind === "file" && i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      onFileRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [paste]);

  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the drop target is a bonus; the button inside does the same job */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-[var(--radius)] border bg-raised transition-colors duration-200 ease-out-expo ${
          over ? "border-accent" : "border-rule"
        } ${compact ? "p-2 pl-3" : "p-4"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <label className="button compact choice">
          {label}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-sm text-muted">
          {paste ? "or drop or paste one here" : "or drop one here"}
        </span>
        {hint}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
