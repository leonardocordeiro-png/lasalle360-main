import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CouncilWizard } from "./CouncilWizard";

interface CouncilClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  councilId?: string;
}

export function CouncilClassDialog({
  open,
  onOpenChange,
  onSuccess,
  councilId,
}: CouncilClassDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto px-2 sm:px-4">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            {councilId ? "Editar Conselho de Classe" : "Novo Conselho de Classe"}
          </DialogTitle>
        </DialogHeader>
        <CouncilWizard
          key={councilId || 'new'}
          onComplete={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
          councilId={councilId}
        />
      </DialogContent>
    </Dialog>
  );
}