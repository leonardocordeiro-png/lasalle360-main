import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, BookOpen, Calendar, GraduationCap, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { auditLog } from "@/lib/auditLogger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CouncilViewDialog } from "./CouncilViewDialog";
import { CouncilClassDialog } from "./CouncilClassDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CouncilClassDashboardProps {
  filter: "EM" | "EFII";
  trimester: "1" | "2" | "3";
}

export function CouncilClassDashboard({ filter, trimester }: CouncilClassDashboardProps) {
  const [councils, setCouncils] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [councilToDelete, setCouncilToDelete] = useState<string | null>(null);

  useEffect(() => {
    console.log("Fetching councils for filter:", filter, "trimester:", trimester);
    fetchCouncils();
  }, [filter, trimester]);

  const fetchCouncils = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("class_councils")
        .select(`
          *,
          school_years(year)
        `)
        .eq("academic_level", filter)
        .eq("trimester", trimester)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Councils loaded:", data?.length || 0);
      setCouncils(data || []);
    } catch (error: any) {
      console.error("Error fetching councils:", error);
      toast.error("Erro ao carregar conselhos: " + (error.message || "Erro desconhecido"));
      setCouncils([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; dotColor: string; className: string }> = {
      draft: { label: "Em Avaliação", dotColor: "bg-red-500", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
      in_progress: { label: "Em Avaliação", dotColor: "bg-red-500", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
      completed: { label: "Concluído", dotColor: "bg-amber-500", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" },
      approved: { label: "Aprovado", dotColor: "bg-emerald-500", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
    };

    const config = statusMap[status] || statusMap.draft;
    return (
      <Badge variant="outline" className={`text-[10px] font-bold gap-1.5 ${config.className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {config.label}
      </Badge>
    );
  };

  const handleStatusChange = async (councilId: string, newStatus: "draft" | "in_progress" | "completed" | "approved") => {
    try {
      const { error } = await supabase
        .from("class_councils")
        .update({ status: newStatus })
        .eq("id", councilId);

      if (error) throw error;

      toast.success("Status atualizado com sucesso!");

      await auditLog({
        action: 'status_change',
        module: 'council',
        description: `Status do conselho alterado para "${newStatus}"`,
        resourceId: councilId,
        newData: { status: newStatus }
      });

      fetchCouncils();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const getTrimesterLabel = (trimester: string) => {
    return `${trimester}º Trimestre`;
  };

  const getLevelLabel = (level: string) => {
    return level === "EM" ? "Ensino Médio" : "Ensino Fundamental II";
  };

  const handleView = (councilId: string) => {
    setSelectedCouncilId(councilId);
    setViewDialogOpen(true);
  };

  const handleEdit = (councilId: string) => {
    setSelectedCouncilId(councilId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (councilId: string) => {
    setCouncilToDelete(councilId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!councilToDelete) return;

    try {
      const { error } = await supabase
        .from("class_councils")
        .delete()
        .eq("id", councilToDelete);

      if (error) throw error;

      toast.success("Conselho excluído com sucesso!");

      await auditLog({
        action: 'delete',
        module: 'council',
        description: `Conselho de Classe excluído`,
        resourceId: councilToDelete
      });

      setDeleteDialogOpen(false);
      setCouncilToDelete(null);
      fetchCouncils();
    } catch (error: any) {
      console.error("Error deleting council:", error);
      toast.error("Erro ao excluir conselho: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-0 shadow-lg bg-card/95 overflow-hidden">
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (councils.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-16 w-16 rounded-3xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <BookOpen className="h-7 w-7 text-purple-500 dark:text-purple-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Nenhum conselho encontrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
            Crie um novo conselho de classe para começar a registrar as avaliações
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {councils.map((council) => {
          if (!council || !council.id) return null;
          
          const statusColors: Record<string, string> = {
            draft: "from-red-400 to-rose-500",
            in_progress: "from-red-400 to-rose-500",
            completed: "from-amber-400 to-orange-500",
            approved: "from-emerald-400 to-green-500",
          };
          const accentGradient = statusColors[council.status || "draft"] || statusColors.draft;

          return (
          <Card key={council.id} className="relative overflow-hidden border-0 shadow-lg bg-card/95 backdrop-blur-sm group hover:shadow-xl transition-all duration-300">
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accentGradient}`} />
            <div className="p-4 sm:p-5 pl-5 sm:pl-6">
              {/* Top: Title + Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center ring-1 ring-purple-200/50 dark:ring-purple-800/30 flex-shrink-0">
                    <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">
                      {council.grade_class || "N/A"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {getTrimesterLabel(council.trimester || "1")}
                    </p>
                  </div>
                </div>
                {getStatusBadge(council.status || "draft")}
              </div>

              {/* Info rows */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="font-medium">Data</span>
                  </div>
                  <span className="text-xs font-semibold">
                    {council.council_date ? format(new Date(council.council_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    }) : "N/A"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <BookOpen className="h-3 w-3" />
                    <span className="font-medium">Ano letivo</span>
                  </div>
                  <span className="text-xs font-semibold">{council.school_years?.year || "N/A"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">Nível</span>
                  </div>
                  <span className="text-[11px] font-medium bg-muted/40 px-2 py-0.5 rounded-md">
                    {getLevelLabel(council.academic_level || filter)}
                  </span>
                </div>
              </div>

              {/* Status Selector */}
              <div className="mb-3">
                <Select
                  value={council.status || "draft"}
                  onValueChange={(value) => handleStatusChange(council.id, value as "draft" | "in_progress" | "completed" | "approved")}
                >
                  <SelectTrigger className="w-full h-8 rounded-lg text-xs border-border/50 bg-muted/30">
                    <SelectValue>
                      {getStatusBadge(council.status || "draft")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <Badge variant="outline" className="text-[10px] font-bold gap-1.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Em Avaliação
                      </Badge>
                    </SelectItem>
                    <SelectItem value="completed">
                      <Badge variant="outline" className="text-[10px] font-bold gap-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Concluído
                      </Badge>
                    </SelectItem>
                    <SelectItem value="approved">
                      <Badge variant="outline" className="text-[10px] font-bold gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Aprovado
                      </Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 pt-3 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 rounded-lg text-xs font-medium border-border/50 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 dark:hover:bg-purple-950 dark:hover:text-purple-400 transition-colors"
                  onClick={() => handleView(council.id)}
                >
                  <Eye className="mr-1.5 h-3 w-3" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 rounded-lg text-xs font-medium border-border/50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-colors"
                  onClick={() => handleEdit(council.id)}
                >
                  <Edit className="mr-1.5 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 rounded-lg border-border/50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors p-0"
                  onClick={() => handleDeleteClick(council.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      <CouncilViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        councilId={selectedCouncilId}
      />

      <CouncilClassDialog
        key={selectedCouncilId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => {
          setEditDialogOpen(false);
          fetchCouncils();
        }}
        councilId={selectedCouncilId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este conselho? Esta ação não pode ser desfeita e todos os dados relacionados (alunos, notas e ações) serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}