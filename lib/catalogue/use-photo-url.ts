"use client";

import { useEffect, useState } from "react";
import { loadPhoto } from "./photos";

type Source = string | Blob;

// Object URL for a stored photo ID or an unsaved blob. Revoked on change and unmount.
export function usePhotoUrl(source: Source | undefined): string | undefined {
  const [state, setState] = useState<{ source: Source; url: string }>();

  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    let objectUrl: string | undefined;

    const load = typeof source === "string" ? loadPhoto(source) : Promise.resolve(source);
    void load.then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ source, url: objectUrl });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return state && state.source === source ? state.url : undefined;
}