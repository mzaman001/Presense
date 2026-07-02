"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function UpdatePrompt() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      toast.info("Update available", {
        description: "A new version is ready.",
        action: {
          label: "Reload",
          onClick: () => window.location.reload(),
        },
        duration: Infinity,
      });
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
  }, []);

  return null;
}
