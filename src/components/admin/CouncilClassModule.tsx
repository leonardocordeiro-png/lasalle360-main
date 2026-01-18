import { useState } from "react";
import { Plus, Filter, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CouncilClassDashboard } from "@/components/council/CouncilClassDashboard";
import { CouncilClassDialog } from "@/components/council/CouncilClassDialog";

export function CouncilClassModule() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"EM" | "EFII">("EM");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCouncilSuccess = () => {
    setIsCreateOpen(false);
    setRefreshKey((prev) => prev + 1); // Force refresh of the dashboard
  };

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-primary" />
            Conselho de Classe
          </h2>
          <p className="text-muted-foreground mt-1">
            Gerencie as atas de Conselho de Classe de forma digital e eficiente
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="lg" className="w-full sm:w-auto">
          <Plus className="mr-2 h-5 w-5" />
          Novo Conselho
        </Button>
      </div>

      {/* Tabs por nível acadêmico */}
      <Tabs defaultValue="EM" onValueChange={(v) => setSelectedLevel(v as any)}>
        <div className="mb-6">
          <div className="w-full overflow-x-auto">
            <TabsList className="flex w-max gap-2">
              <TabsTrigger value="EM" className="gap-2 whitespace-nowrap">
                📚 Ensino Médio
              </TabsTrigger>
              <TabsTrigger value="EFII" className="gap-2 whitespace-nowrap">
                📖 Ensino Fundamental II
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="EM" key={`EM-${refreshKey}`}>
          <Tabs defaultValue="1" className="w-full">
            <div className="w-full overflow-x-auto">
              <TabsList className="mb-6 flex w-max gap-2">
                <TabsTrigger value="1" className="whitespace-nowrap">1º Trimestre</TabsTrigger>
                <TabsTrigger value="2" className="whitespace-nowrap">2º Trimestre</TabsTrigger>
                <TabsTrigger value="3" className="whitespace-nowrap">3º Trimestre</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="1">
              <CouncilClassDashboard filter="EM" trimester="1" />
            </TabsContent>
            <TabsContent value="2">
              <CouncilClassDashboard filter="EM" trimester="2" />
            </TabsContent>
            <TabsContent value="3">
              <CouncilClassDashboard filter="EM" trimester="3" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="EFII" key={`EFII-${refreshKey}`}>
          <Tabs defaultValue="1" className="w-full">
            <div className="w-full overflow-x-auto">
              <TabsList className="mb-6 flex w-max gap-2">
                <TabsTrigger value="1" className="whitespace-nowrap">1º Trimestre</TabsTrigger>
                <TabsTrigger value="2" className="whitespace-nowrap">2º Trimestre</TabsTrigger>
                <TabsTrigger value="3" className="whitespace-nowrap">3º Trimestre</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="1">
              <CouncilClassDashboard filter="EFII" trimester="1" />
            </TabsContent>
            <TabsContent value="2">
              <CouncilClassDashboard filter="EFII" trimester="2" />
            </TabsContent>
            <TabsContent value="3">
              <CouncilClassDashboard filter="EFII" trimester="3" />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Dialog de criação */}
      <CouncilClassDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCouncilSuccess}
      />
    </div>
  );
}