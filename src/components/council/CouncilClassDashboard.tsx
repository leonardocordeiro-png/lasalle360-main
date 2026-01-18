import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
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
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: "Em Avaliação", className: "bg-destructive hover:bg-destructive/90 text-destructive-foreground" },
      in_progress: { label: "Em Avaliação", className: "bg-destructive hover:bg-destructive/90 text-destructive-foreground" },
      completed: { label: "Concluído", className: "bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-500 dark:hover:bg-yellow-600" },
      approved: { label: "Aprovado", className: "bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600" },
    };

    const config = statusMap[status] || statusMap.draft;
    return (
      <Badge className={`text-xs ${config.className}`}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-2 sm:px-0">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (councils.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum conselho encontrado
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie um novo conselho para começar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-2 sm:px-0">
        {councils.map((council) => {
          if (!council || !council.id) return null;
          
          return (
          <Card key={council.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">
                    {getTrimesterLabel(council.trimester || "1")} - {council.grade_class || "N/A"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {getLevelLabel(council.academic_level || filter)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Select
                  value={council.status || "draft"}
                  onValueChange={(value) => handleStatusChange(council.id, value as "draft" | "in_progress" | "completed" | "approved")}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue>
                      {getStatusBadge(council.status || "draft")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <Badge className="bg-destructive text-destructive-foreground text-xs">
                        Em Avaliação
                      </Badge>
                    </SelectItem>
                    <SelectItem value="completed">
                      <Badge className="bg-yellow-600 text-white dark:bg-yellow-500 text-xs">
                        Concluído
                      </Badge>
                    </SelectItem>
                    <SelectItem value="approved">
                      <Badge className="bg-green-600 text-white dark:bg-green-500 text-xs">
                        Aprovado
                      </Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">
                    {council.council_date ? format(new Date(council.council_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    }) : "N/A"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ano letivo:</span>
                  <span className="font-medium">{council.school_years?.year || "N/A"}</span>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 w-full sm:w-auto"
                    onClick={() => handleView(council.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 w-full sm:w-auto"
                    onClick={() => handleEdit(council.id)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => handleDeleteClick(council.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
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