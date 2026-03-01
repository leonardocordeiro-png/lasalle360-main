import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone, Target, ClipboardList, Star } from "lucide-react";

interface CouncilActionsProps {
  data: any;
  onComplete: (data: any) => void;
}

export function CouncilActions({ data, onComplete }: CouncilActionsProps) {
  const [actions, setActions] = useState({
    pais_chamados: "",
    soe_acompanhar: "",
    sct_chamar: "",
    destaques: "",
  });

  useEffect(() => {
    setActions({
      pais_chamados: data?.actions?.pais_chamados || "",
      soe_acompanhar: data?.actions?.soe_acompanhar || "",
      sct_chamar: data?.actions?.sct_chamar || "",
      destaques: data?.actions?.destaques || "",
    });
  }, [data?.actions]);

  const updateAction = (field: string, value: string) => {
    setActions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContinue = () => {
    onComplete(actions);
  };

  const actionCards = [
    {
      key: "pais_chamados",
      icon: Phone,
      title: "Pais a serem chamados",
      color: "text-blue-500",
      placeholder: "Liste os nomes dos alunos cujos pais devem ser contactados...",
    },
    {
      key: "soe_acompanhar",
      icon: Target,
      title: "SOE deve acompanhar",
      color: "text-purple-500",
      placeholder: "Liste os alunos que necessitam acompanhamento do SOE...",
    },
    {
      key: "sct_chamar",
      icon: ClipboardList,
      title: "SCT deve chamar",
      color: "text-orange-500",
      placeholder: "Liste os alunos que o SCT deve contatar...",
    },
    {
      key: "destaques",
      icon: Star,
      title: "Alunos Destaque",
      color: "text-yellow-500",
      placeholder: "Liste os alunos que se destacaram positivamente...",
    },
  ];

  return (
    <div className="space-y-5 px-2 sm:px-0">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
          <ClipboardList className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Encaminhamentos e Ações</h3>
          <p className="text-[11px] text-muted-foreground font-medium">
            Registre as ações pedagógicas necessárias
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actionCards.map((action) => {
          const Icon = action.icon;
          const colorMap: Record<string, string> = {
            "text-blue-500": "from-blue-400 to-blue-600",
            "text-purple-500": "from-purple-400 to-purple-600",
            "text-orange-500": "from-orange-400 to-orange-600",
            "text-yellow-500": "from-amber-400 to-yellow-500",
          };
          const bgMap: Record<string, string> = {
            "text-blue-500": "bg-blue-100 dark:bg-blue-900/40",
            "text-purple-500": "bg-purple-100 dark:bg-purple-900/40",
            "text-orange-500": "bg-orange-100 dark:bg-orange-900/40",
            "text-yellow-500": "bg-amber-100 dark:bg-amber-900/40",
          };
          return (
            <div key={action.key} className="relative overflow-hidden rounded-xl border border-border/40 bg-card/95 shadow-sm">
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colorMap[action.color] || "from-gray-400 to-gray-600"}`} />
              <div className="p-4 pl-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-7 w-7 rounded-lg ${bgMap[action.color] || "bg-muted"} flex items-center justify-center`}>
                    <Icon className={`h-3.5 w-3.5 ${action.color}`} />
                  </div>
                  <span className="text-xs font-bold">{action.title}</span>
                </div>
                <Textarea
                  value={actions[action.key as keyof typeof actions]}
                  onChange={(e) => updateAction(action.key, e.target.value)}
                  placeholder={action.placeholder}
                  className="min-h-[100px] rounded-lg border-border/50 bg-muted/20 text-sm resize-none focus:bg-background transition-colors"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/10 p-3.5 flex items-start gap-2.5">
        <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Star className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Dica:</strong> Você pode digitar os nomes dos alunos
          separados por vírgula ou em linhas diferentes. Os setores responsáveis
          serão notificados automaticamente.
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleContinue} className="w-full sm:w-auto rounded-xl h-9 px-6 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md">
          Salvar Conselho
        </Button>
      </div>
    </div>
  );
}