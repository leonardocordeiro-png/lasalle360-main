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
    <div className="space-y-6 px-2 sm:px-0">
      <div>
        <h3 className="text-lg font-semibold">Encaminhamentos e Ações</h3>
        <p className="text-sm text-muted-foreground">
          Registre as ações pedagógicas necessárias
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionCards.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={`h-5 w-5 ${action.color}`} />
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={actions[action.key as keyof typeof actions]}
                  onChange={(e) => updateAction(action.key, e.target.value)}
                  placeholder={action.placeholder}
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Dica:</strong> Você pode digitar os nomes dos alunos
          separados por vírgula ou em linhas diferentes. Os setores responsáveis
          serão notificados automaticamente.
        </p>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleContinue} className="w-full sm:w-auto">
          Salvar Conselho
        </Button>
      </div>
    </div>
  );
}