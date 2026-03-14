import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";

interface EquipmentLoanBadgeProps {
  status: 'ATIVO' | 'DEFEITO' | 'EM_USO' | 'EMPRESTIMO' | string;
  className?: string;
}

export function EquipmentLoanBadge({ status, className }: EquipmentLoanBadgeProps) {
  const config = {
    ATIVO: {
      icon: CheckCircle,
      dotColor: "bg-emerald-500",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
      label: "ATIVO"
    },
    EM_USO: {
      icon: Package,
      dotColor: "bg-amber-500",
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
      label: "EM_USO"
    },
    EMPRESTIMO: {
      icon: Package,
      dotColor: "bg-amber-500",
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
      label: "EMPRESTIMO"
    },
    DEFEITO: {
      icon: AlertTriangle,
      dotColor: "bg-red-500",
      color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
      label: "DEFEITO"
    }
  };

  // Defensive validation with fallback
  const statusConfig = config[status] || {
    icon: AlertTriangle,
    dotColor: "bg-gray-500",
    color: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800",
    label: status || "DESCONHECIDO"
  };

  const { dotColor, color, label } = statusConfig;

  return (
    <Badge variant="outline" className={cn(color, "gap-1.5 text-[10px] font-bold", className)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
      {label}
    </Badge>
  );
}
