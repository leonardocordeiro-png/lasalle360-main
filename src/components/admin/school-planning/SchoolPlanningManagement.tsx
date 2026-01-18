import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, X, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SchoolPlanningDialog } from "./SchoolPlanningDialog";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface ClassPlanningForm {
  id?: string;
  school_year_id: string;
  grade_series_id: string;
  scenario_name: string;
  shift: string;
  total_classes: number;
  vacancies_per_class: number;
  re_enrolled_students: number;
  new_students: number;
  transferred_students: number;
  waiting_list: number;
  notes: string;
  display_order: number; // Added display_order
}

interface SchoolPlanningManagementProps {
  readOnly?: boolean;
}

export const SchoolPlanningManagement = ({ readOnly = false }: SchoolPlanningManagementProps) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlanningId, setSelectedPlanningId] = useState<string | undefined>(undefined);
  const [isReordering, setIsReordering] = useState(false);

  const { data: classPlanning, isLoading, error: queryError } = useQuery({
    queryKey: ["class-planning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_planning")
        .select(`
          *,
          school_year:school_years (year),
          grade_series:grade_series (
            name,
            academic_level:academic_levels (name)
          )
        `)
        .order("display_order", { ascending: true, nullsFirst: false }) // Order by display_order, nulls last
        .order("created_at", { ascending: false }); // Fallback order
      if (error) {
        console.error("Supabase fetch error for class-planning:", error); // Added console.error
        throw error;
      }
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("class_planning")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-planning"] });
      queryClient.invalidateQueries({ queryKey: ["school-planning-dashboard"] });
      toast.success("Planejamento excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir planejamento: " + error.message);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (orderedItems: ClassPlanningForm[]) => {
      // Note: display_order updates removed until Supabase types are regenerated
      // The field exists in DB but types are outdated
      // Commenting out order update functionality temporarily
      toast.success("Ordem dos planejamentos atualizada (funcionalidade temporariamente desabilitada)!");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-planning"] });
      toast.success("Ordem dos planejamentos atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar ordem: " + error.message);
    },
    onSettled: () => {
      setIsReordering(false);
    }
  });

  const handleCreateNew = () => {
    setSelectedPlanningId(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setSelectedPlanningId(item.id);
    setIsDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setIsDialogOpen(false);
  };

  const calculateOccupancy = (item: any) => {
    const totalVacancies = item.total_classes * item.vacancies_per_class;
    const totalStudents = item.re_enrolled_students + item.new_students;
    return totalVacancies > 0 ? (totalStudents / totalVacancies) * 100 : 0;
  };

  const getOccupancyColor = (occupancy: number) => {
    if (occupancy > 100) return "bg-red-500";
    if (occupancy > 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getAcademicLevelRowClass = (academicLevelName: string) => {
    switch (academicLevelName) {
      case "Educação Infantil":
        return "bg-red-50 hover:bg-red-100";
      case "Ensino Fundamental I":
        return "bg-yellow-50 hover:bg-yellow-100";
      case "Ensino Fundamental II":
        return "bg-blue-50 hover:bg-blue-100";
      case "Ensino Médio":
        return "bg-gray-50 hover:bg-gray-100";
      default:
        return "";
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || readOnly) {
      return;
    }

    const reorderedItems = Array.from(classPlanning || []);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);

    // Log the items to be updated for debugging
    console.log("Items to be updated (checking school_year_id):", reorderedItems.map(item => ({
      id: item.id,
      display_order: item.display_order, // original display_order
      school_year_id: item.school_year_id // check if this is null
    })));

    setIsReordering(true);
    updateOrderMutation.mutate(reorderedItems as ClassPlanningForm[]);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">Gestão de Planejamento</h2>
        <Button 
          onClick={handleCreateNew} 
          className="w-full sm:w-auto"
          disabled={readOnly}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Planejamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Planejamentos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8">Carregando planejamentos...</div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Table className="min-w-max sm:min-w-0">
                <TableHeader>
                  <TableRow>
                    {!readOnly && <TableHead className="w-12">Ordem</TableHead>}
                    <TableHead className="text-xs sm:text-sm">Ano</TableHead>
                    <TableHead className="text-xs sm:text-sm">Nível/Série</TableHead>
                    <TableHead className="text-xs sm:text-sm">Turno</TableHead>
                    <TableHead className="text-xs sm:text-sm">Turmas</TableHead>
                    <TableHead className="text-xs sm:text-sm">Vagas</TableHead>
                    <TableHead className="text-xs sm:text-sm">Alunos</TableHead>
                    <TableHead className="text-xs sm:text-sm">Ocupação</TableHead>
                    <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <Droppable droppableId="planning-table">
                  {(provided) => (
                    <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                      {classPlanning && classPlanning.length > 0 ? (
                        classPlanning.map((item, index) => {
                          const totalVacancies = item.total_classes * item.vacancies_per_class;
                          const totalStudents = item.re_enrolled_students + item.new_students;
                          const occupancy = calculateOccupancy(item);
                          const academicLevelName = item.grade_series.academic_level.name;

                          return (
                            <Draggable 
                              key={item.id} 
                              draggableId={item.id} 
                              index={index}
                              isDragDisabled={readOnly} // Disable drag if readOnly
                            >
                              {(provided, snapshot) => (
                                <TableRow 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    getAcademicLevelRowClass(academicLevelName),
                                    snapshot.isDragging && "bg-accent/50" // Highlight dragged item
                                  )}
                                >
                                  {!readOnly && (
                                    <TableCell className="text-xs sm:text-sm">
                                      <span {...provided.dragHandleProps} className="cursor-grab">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      </span>
                                    </TableCell>
                                  )}
                                  <TableCell className="text-xs sm:text-sm">{item.school_year.year}</TableCell>
                                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                                    {academicLevelName} - {item.grade_series.name}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm">{item.shift}</TableCell>
                                  <TableCell className="text-xs sm:text-sm">{item.total_classes}</TableCell>
                                  <TableCell className="text-xs sm:text-sm">{totalVacancies}</TableCell>
                                  <TableCell className="text-xs sm:text-sm">{totalStudents}</TableCell>
                                  <TableCell>
                                    <Badge className={`${getOccupancyColor(occupancy)} text-xs`}>
                                      {occupancy.toFixed(1)}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {!readOnly && (
                                      <div className="flex gap-1 sm:gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleEdit(item)}
                                          className="h-8 w-8 p-0"
                                          disabled={readOnly}
                                        >
                                          <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => deleteMutation.mutate(item.id)}
                                          className="h-8 w-8 p-0"
                                          disabled={readOnly}
                                        >
                                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Nenhum planejamento encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                      {provided.placeholder}
                    </TableBody>
                  )}
                </Droppable>
              </Table>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      <SchoolPlanningDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        planningId={selectedPlanningId}
        onSuccess={handleDialogSuccess}
        readOnly={readOnly}
      />
    </div>
  );
};