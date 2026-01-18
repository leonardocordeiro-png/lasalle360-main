import { useState, useEffect } from "react";
import { Plus, Filter, FileText, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CouncilClassDashboard } from "@/components/council/CouncilClassDashboard";
import { CouncilClassDialog } from "@/components/council/CouncilClassDialog";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { checkUserPermission } from "@/lib/permissionsUtils";
import { supabase } from "@/integrations/supabase/client";

export default function CouncilClass() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"ALL" | "EM" | "EFII">("ALL");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Check module permission
      const permission = await checkUserPermission(user.id, 'admin_council_class');
      setHasAccess(permission.canAccess);
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Painel Administrativo
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              Conselho de Classe
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie as atas de Conselho de Classe de forma digital e eficiente
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Novo Conselho
          </Button>
        </div>

        {/* Tabs por nível acadêmico */}
        <Tabs defaultValue="EM" onValueChange={(v) => setSelectedLevel(v as any)}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="EM" className="gap-2">
                📚 Ensino Médio
              </TabsTrigger>
              <TabsTrigger value="EFII" className="gap-2">
                📖 Ensino Fundamental II
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="EM">
            <Tabs defaultValue="1" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="1">1º Trimestre</TabsTrigger>
                <TabsTrigger value="2">2º Trimestre</TabsTrigger>
                <TabsTrigger value="3">3º Trimestre</TabsTrigger>
              </TabsList>
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

          <TabsContent value="EFII">
            <Tabs defaultValue="1" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="1">1º Trimestre</TabsTrigger>
                <TabsTrigger value="2">2º Trimestre</TabsTrigger>
                <TabsTrigger value="3">3º Trimestre</TabsTrigger>
              </TabsList>
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
      </div>

      {/* Dialog de criação */}
      <CouncilClassDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
