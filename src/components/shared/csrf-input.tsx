"use client";

import { useEffect, useState } from "react";
import { CSRF_FIELD } from "@/lib/csrf-constants";
import { readCsrfToken } from "@/lib/csrf-client";

export function CsrfInput({ token = "" }: { token?: string }) {
  const [value, setValue] = useState(token);

  useEffect(() => {
    setValue(readCsrfToken());
  }, []);

  return <input type="hidden" name={CSRF_FIELD} value={value} />;
}
