import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Printer, GripVertical, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { cn } from "@/lib/utils";

interface ClassPlanningItem {
  id: string;
  school_year: { year: number };
  grade_series: {
    name: string;
    academic_level: {
      name: string;
    };
  };
  shift: string;
  scenario_name: string;
  total_classes: number;
  vacancies_per_class: number;
  re_enrolled_students: number;
  new_students: number;
  transferred_students: number;
  waiting_list: number;
  display_order: number;
}

interface SchoolPlanningReportsProps {
  readOnly?: boolean;
}

export const SchoolPlanningReports = ({ readOnly = false }: SchoolPlanningReportsProps) => {
  const queryClient = useQueryClient();
  const [isReordering, setIsReordering] = useState(false);
  const [localClassPlanning, setLocalClassPlanning] = useState<ClassPlanningItem[]>([]);

  const { data: classPlanning, isLoading, error: queryError } = useQuery({
    queryKey: ["class-planning-reports"],
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
      if (error) throw error;
      return data as ClassPlanningItem[];
    },
  });

  useEffect(() => {
    if (classPlanning) {
      setLocalClassPlanning(classPlanning);
    }
  }, [classPlanning]);

  const updateOrderMutation = useMutation({
    mutationFn: async (orderedItems: ClassPlanningItem[]) => {
      const updates = orderedItems.map((item, index) => ({
        id: item.id,
        display_order: index, // Assign new display_order based on array index
      }));
      
      const updatePromises = updates.map(updateItem =>
        supabase
          .from("class_planning")
          .update({ display_order: updateItem.display_order }) // Explicitly update only display_order
          .eq("id", updateItem.id)
      );
      
      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error).map(r => r.error);
      if (errors.length > 0) {
        errors.forEach(err => console.error("Error updating item order:", err));
        throw new Error(`Falha ao atualizar a ordem de alguns itens: ${errors.map(e => e.message).join(', ')}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-planning-reports"] });
      toast.success("Ordem dos planejamentos atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar ordem: " + error.message);
    },
    onSettled: () => {
      setIsReordering(false);
    }
  });

  const handlePrint = () => {
    window.print();
    toast.success("Preparando impressão...");
  };

  const handleExportExcel = () => {
    if (!localClassPlanning?.length) {
      toast.error("Não há dados para exportar");
      return;
    }

    // Prepare CSV data
    const headers = [
      "Ano",
      "Nível",
      "Série",
      "Turno",
      "Cenário",
      "Turmas",
      "Vagas/Turma",
      "Total Vagas",
      "Rematriculados",
      "Novos",
      "Total Alunos",
      "Vagas Disponíveis",
      "Transferidos",
      "Lista Espera",
      "Ocupação %",
    ];

    const rows = localClassPlanning.map((item) => {
      const totalVacancies = item.total_classes * item.vacancies_per_class;
      const totalStudents = item.re_enrolled_students + item.new_students;
      const availableVacancies = totalVacancies - totalStudents;
      const occupancy = totalVacancies > 0 ? (totalStudents / totalVacancies) * 100 : 0;

      return [
        item.school_year.year,
        item.grade_series.academic_level.name,
        item.grade_series.name,
        item.shift,
        item.scenario_name,
        item.total_classes,
        item.vacancies_per_class,
        totalVacancies,
        item.re_enrolled_students,
        item.new_students,
        totalStudents,
        availableVacancies,
        item.transferred_students,
        item.waiting_list,
        occupancy.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `planejamento_escolar_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Arquivo Excel exportado com sucesso!");
  };

  const calculateOccupancy = (item: any) => {
    const totalVacancies = item.total_classes * item.vacancies_per_class;
    const totalStudents = item.re_enrolled_students + item.new_students;
    return totalVacancies > 0 ? (totalStudents / totalVacancies) * 100 : 0;
  };

  const getOccupancyStyle = (occupancy: number) => {
    if (occupancy > 100) return "bg-red-100 text-red-800";
    if (occupancy > 80) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const getAvailableVacanciesStyle = (available: number) => {
    if (available < 0) return "bg-red-100 text-red-800";
    if (available <= 5) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
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

    const reorderedItems = Array.from(localClassPlanning);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);

    setLocalClassPlanning(reorderedItems);
    setIsReordering(true);
  };

  const handleSaveOrder = () => {
    updateOrderMutation.mutate(localClassPlanning);
  };

  const handleCancelReorder = () => {
    setLocalClassPlanning(classPlanning || []);
    setIsReordering(false);
    toast.info("Reordenação cancelada.");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <h2 className="text-xl sm:text-2xl font-bold">Relatórios</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!readOnly && isReordering && (
            <>
              <Button 
                onClick={handleCancelReorder} 
                variant="outline" 
                className="w-full sm:w-auto"
                disabled={updateOrderMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveOrder} 
                className="w-full sm:w-auto"
                disabled={updateOrderMutation.isPending}
              >
                {updateOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar Ordem
              </Button>
            </>
          )}
          <Button onClick={handleExportExcel} variant="outline" className="w-full sm:w-auto">
            <FileDown className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatório Completo de Planejamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 sm:space-y-6">
            {/* Summary by Level */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {["Educação Infantil", "Ensino Fundamental I", "Ensino Fundamental II", "Ensino Médio"].map(
                (level) => {
                  const levelData = localClassPlanning?.filter(
                    (item) => item.grade_series.academic_level.name === level
                  );
                  const totalVacancies = levelData?.reduce(
                    (sum, item) => sum + item.total_classes * item.vacancies_per_class,
                    0
                  ) || 0;
                  const totalStudents = levelData?.reduce(
                    (sum, item) => sum + item.re_enrolled_students + item.new_students,
                    0
                  ) || 0;
                  const occupancy = totalVacancies > 0 ? (totalStudents / totalVacancies) * 100 : 0;

                  return (
                    <Card key={level} style={{ borderColor: "#0066CC", borderWidth: "2px" }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{level}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" style={{ color: "#0066CC" }}>
                          {totalStudents}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          de {totalVacancies} vagas
                        </p>
                        <div
                          className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getOccupancyStyle(
                            occupancy
                          )}`}
                        >
                          {occupancy.toFixed(1)}% ocupação
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>

            {/* Detailed Table */}
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "#0066CC" }}>
              {isLoading ? (
                <div className="text-center py-8">Carregando planejamentos...</div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Table className="min-w-max sm:min-w-0">
                    <TableHeader>
                      <TableRow style={{ backgroundColor: "#0066CC" }}>
                        {!readOnly && <TableHead className="w-12 text-white text-xs sm:text-sm">Ordem</TableHead>}
                        <TableHead className="text-white text-xs sm:text-sm">Ano</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm whitespace-nowrap">Nível de Ensino</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Série/Ano</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Turno</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Cenário</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Turmas</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm whitespace-nowrap">Vagas/Turma</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm whitespace-nowrap">Total Vagas</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Remat.</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Novos</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm whitespace-nowrap">Total Alunos</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm whitespace-nowrap">Vagas Disponíveis</TableHead>
                        <TableHead className="text-white text-xs sm:text-sm">Ocupação %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <Droppable droppableId="planning-reports-table">
                      {(provided) => (
                        <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                          {localClassPlanning && localClassPlanning.length > 0 ? (
                            localClassPlanning.map((item, index) => {
                              const totalVacancies = item.total_classes * item.vacancies_per_class;
                              const totalStudents = item.re_enrolled_students + item.new_students;
                              const availableVacancies = totalVacancies - totalStudents;
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
                                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">{academicLevelName}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.grade_series.name}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.shift}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.scenario_name}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.total_classes}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.vacancies_per_class}</TableCell>
                                      <TableCell className="text-xs sm:text-sm font-semibold">{totalVacancies}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.re_enrolled_students}</TableCell>
                                      <TableCell className="text-xs sm:text-sm">{item.new_students}</TableCell>
                                      <TableCell className="text-xs sm:text-sm font-semibold">{totalStudents}</TableCell>
                                      <TableCell>
                                        <span
                                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap ${getAvailableVacanciesStyle(
                                            availableVacancies
                                          )}`}
                                        >
                                          {availableVacancies}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap ${getOccupancyStyle(
                                            occupancy
                                          )}`}
                                        >
                                          {occupancy.toFixed(1)}%
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Draggable>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={!readOnly ? 14 : 13} className="text-center py-8 text-muted-foreground">
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
            </div>

            {/* Legend */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-500 flex-shrink-0" />
                <span>Até 80% - Disponível</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-yellow-500 flex-shrink-0" />
                <span>80-100% - Atenção</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-500 flex-shrink-0" />
                <span>&gt;100% - Superlotação</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};