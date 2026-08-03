"use client";

import { useEffect, useState } from "react";

/**
 * Object URLs for a blob, revoked when the blob changes or the component goes
 * away. Creating one per render without revoking pins every decoded image in
 * memory until a reload — with a hundred-file queue that is the whole batch.
 *
 * `enabled` defers creation so a preview that is never opened never allocates.
 */
export function useObjectUrl(blob: Blob | undefined, enabled = true) {
  const [url, setUrl] = useState<string>();

  /* react-hooks/set-state-in-effect wants the URL derived during render, but an
     object URL is an allocation that has to be revoked, and only an effect
     cleanup runs at the right moment. Deriving it in a useMemo would leak one
     URL per StrictMode double-render, which is exactly the pinning this hook
     exists to prevent. */
  useEffect(() => {
    if (!blob || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(undefined);
      return;
    }

    const next = URL.createObjectURL(blob);
    setUrl(next);

    return () => {
      URL.revokeObjectURL(next);
      setUrl(undefined);
    };
  }, [blob, enabled]);

  return url;
}
