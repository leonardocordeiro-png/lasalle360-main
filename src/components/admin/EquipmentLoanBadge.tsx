import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";

interface EquipmentLoanBadgeProps {
  status: 'ATIVO' | 'DEFEITO' | 'EMPRESTIMO';
  className?: string;
}

export function EquipmentLoanBadge({ status, className }: EquipmentLoanBadgeProps) {
  const config = {
    ATIVO: {
      icon: CheckCircle,
      color: "bg-green-500 hover:bg-green-600 text-white",
      label: "ATIVO"
    },
    EMPRESTIMO: {
      icon: Package,
      color: "bg-yellow-500 hover:bg-yellow-600 text-black",
      label: "EMPRÉSTIMO"
    },
    DEFEITO: {
      icon: AlertTriangle,
      color: "bg-red-500 hover:bg-red-600 text-white",
      label: "DEFEITO"
    }
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <Badge className={cn(color, "gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
