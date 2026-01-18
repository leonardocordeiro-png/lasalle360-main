import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { SchoolPlanningDashboard } from "./school-planning/SchoolPlanningDashboard";
import { SchoolPlanningManagement } from "./school-planning/SchoolPlanningManagement";
import { SchoolPlanningReports } from "./school-planning/SchoolPlanningReports";
import { useModulePermission } from "@/lib/permissionsUtils";

export const SchoolPlanningModule = () => {
  const { level } = useModulePermission('admin_school_planning');
  const isReadOnly = level === 'read';

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertTitle>Modo Somente Leitura</AlertTitle>
          <AlertDescription>
            Você tem permissão apenas para visualizar este módulo. Contate um administrador para solicitar permissão de edição.
          </AlertDescription>
        </Alert>
      )}
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Planejamento Escolar
          {isReadOnly && (
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Somente Leitura
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground">
          Gerencie o planejamento de alunos para o ano letivo
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2 w-full overflow-x-auto">
          <TabsTrigger value="dashboard" className="w-full sm:w-auto whitespace-nowrap">Dashboard</TabsTrigger>
          <TabsTrigger value="management" className="w-full sm:w-auto whitespace-nowrap">Gestão</TabsTrigger>
          <TabsTrigger value="reports" className="w-full sm:w-auto whitespace-nowrap">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <SchoolPlanningDashboard />
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <SchoolPlanningManagement readOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <SchoolPlanningReports readOnly={isReadOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
};