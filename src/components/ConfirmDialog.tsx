// Reusable confirmation dialog that replaces native confirm().
// Usage:
//   const [pending, setPending] = useState<{action: () => void; title: string; description: string} | null>(null);
//   <ConfirmDialog config={pending} onClose={() => setPending(null)} />

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmConfig = {
  title: string;
  description: string;
  action: () => void | Promise<unknown>;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

export function ConfirmDialog({
  config,
  onClose,
}: {
  config: ConfirmConfig | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!config) return;
    setLoading(true);
    try {
      await config.action();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const variant = config?.variant ?? "destructive";
  const confirmLabel = config?.confirmLabel ?? "Confirmar";
  const cancelLabel = config?.cancelLabel ?? "Cancelar";

  return (
    <AlertDialog open={!!config} onOpenChange={(o) => !o && !loading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config?.title}</AlertDialogTitle>
          <AlertDialogDescription>{config?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {loading ? "Aguarde..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
