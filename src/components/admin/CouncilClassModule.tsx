import { useState } from "react";
import { Plus, BookOpen, GraduationCap, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CouncilClassDashboard } from "@/components/council/CouncilClassDashboard";
import { CouncilClassDialog } from "@/components/council/CouncilClassDialog";

export function CouncilClassModule() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"EM" | "EFII">("EM");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCouncilSuccess = () => {
    setIsCreateOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-5 sm:p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/[0.04] rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/[0.03] rounded-full blur-xl" />
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/[0.02] rounded-full blur-lg" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20 shadow-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Conselho de Classe
              </h2>
              <p className="text-purple-100/60 text-[11px] sm:text-xs font-medium tracking-wide">
                Gestão digital de atas e encaminhamentos pedagógicos
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto rounded-xl bg-white text-purple-700 hover:bg-purple-50 shadow-lg h-9 text-xs font-semibold"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo Conselho
          </Button>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6">
        {/* Tabs por nível acadêmico */}
        <Tabs defaultValue="EM" onValueChange={(v) => setSelectedLevel(v as any)}>
          <div className="mb-5">
            <div className="w-full overflow-x-auto">
              <TabsList className="inline-flex h-10 items-center gap-1 rounded-xl bg-muted/50 p-1">
                <TabsTrigger
                  value="EM"
                  className="gap-2 whitespace-nowrap rounded-lg px-4 text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Ensino Médio
                </TabsTrigger>
                <TabsTrigger
                  value="EFII"
                  className="gap-2 whitespace-nowrap rounded-lg px-4 text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <School className="h-3.5 w-3.5" />
                  Ensino Fundamental II
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="EM" key={`EM-${refreshKey}`}>
            <Tabs defaultValue="1" className="w-full">
              <div className="w-full overflow-x-auto mb-5">
                <TabsList className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/40 p-1">
                  <TabsTrigger value="1" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">1º Trimestre</TabsTrigger>
                  <TabsTrigger value="2" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">2º Trimestre</TabsTrigger>
                  <TabsTrigger value="3" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">3º Trimestre</TabsTrigger>
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
              <div className="w-full overflow-x-auto mb-5">
                <TabsList className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/40 p-1">
                  <TabsTrigger value="1" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">1º Trimestre</TabsTrigger>
                  <TabsTrigger value="2" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">2º Trimestre</TabsTrigger>
                  <TabsTrigger value="3" className="whitespace-nowrap rounded-md px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">3º Trimestre</TabsTrigger>
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
      </CardContent>

      {/* Dialog de criação */}
      <CouncilClassDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCouncilSuccess}
      />
    </Card>
  );
}