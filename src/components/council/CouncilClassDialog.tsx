import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CouncilWizard } from "./CouncilWizard";
import { BookOpen, Edit } from "lucide-react";

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
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto px-0 sm:px-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center ring-1 ring-purple-200/50 dark:ring-purple-800/30">
              {councilId ? (
                <Edit className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {councilId ? "Editar Conselho de Classe" : "Novo Conselho de Classe"}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                {councilId ? "Modifique os dados do conselho existente" : "Preencha as etapas para criar um novo conselho"}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="px-2 sm:px-4 py-4">
          <CouncilWizard
            key={councilId || 'new'}
            onComplete={() => {
              onSuccess?.();
              onOpenChange(false);
            }}
            councilId={councilId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}