"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics-client";

export function PageView() {
  useEffect(() => {
    track("landing_view", { viewport: window.innerWidth < 768 ? "mobile" : "desktop" });
  }, []);
  return null;
}
