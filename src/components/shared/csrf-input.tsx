"use client";

import { useEffect, useState } from "react";
import { CSRF_FIELD } from "@/lib/csrf-constants";
import { readCsrfToken } from "@/lib/csrf-client";

export function CsrfInput({ token = "" }: { token?: string }) {
  const [value, setValue] = useState(token);

  useEffect(() => {
    // Reads the token from document.cookie, which does not exist during SSR, so a
    // lazy useState initializer would mismatch on hydration. Effect-shaped by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(readCsrfToken());
  }, []);

  return <input type="hidden" name={CSRF_FIELD} value={value} />;
}
