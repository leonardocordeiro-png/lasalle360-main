import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileDown, Printer, GripVertical, Save, X, Loader2, Users, TrendingUp, GraduationCap, ChevronUp, MoreHorizontal, Filter, BookOpen, School, Building2 } from "lucide-react";
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
        return "bg-red-50/50 hover:bg-red-100/50 dark:bg-red-950/20 dark:hover:bg-red-900/30";
      case "Ensino Fundamental I":
        return "bg-yellow-50/50 hover:bg-yellow-100/50 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30";
      case "Ensino Fundamental II":
        return "bg-blue-50/50 hover:bg-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-900/30";
      case "Ensino Médio":
        return "bg-gray-50/50 hover:bg-gray-100/50 dark:bg-gray-800/20 dark:hover:bg-gray-700/30";
      default:
        return "";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "Educação Infantil":
        return { icon: School, color: "#EF4444", bgColor: "#FEE2E2" };
      case "Ensino Fundamental I":
        return { icon: BookOpen, color: "#F59E0B", bgColor: "#FEF3C7" };
      case "Ensino Fundamental II":
        return { icon: GraduationCap, color: "#3B82F6", bgColor: "#DBEAFE" };
      case "Ensino Médio":
        return { icon: Building2, color: "#6B7280", bgColor: "#F3F4F6" };
      default:
        return { icon: Users, color: "#0066CC", bgColor: "#E0F2FE" };
    }
  };

  // Calculate totals
  const grandTotalVacancies = localClassPlanning?.reduce(
    (sum, item) => sum + item.total_classes * item.vacancies_per_class,
    0
  ) || 0;
  const grandTotalStudents = localClassPlanning?.reduce(
    (sum, item) => sum + item.re_enrolled_students + item.new_students,
    0
  ) || 0;
  const grandTotalReEnrolled = localClassPlanning?.reduce(
    (sum, item) => sum + item.re_enrolled_students,
    0
  ) || 0;
  const grandTotalNew = localClassPlanning?.reduce(
    (sum, item) => sum + item.new_students,
    0
  ) || 0;
  const overallOccupancy = grandTotalVacancies > 0 ? (grandTotalStudents / grandTotalVacancies) * 100 : 0;

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
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Relatório Completo</h2>
          <p className="text-sm text-muted-foreground mt-1">Visão detalhada do planejamento escolar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && isReordering && (
            <>
              <Button 
                onClick={handleCancelReorder} 
                variant="outline" 
                size="sm"
                className="h-9"
                disabled={updateOrderMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveOrder} 
                size="sm"
                className="h-9 bg-[#0066CC] hover:bg-[#0052A3]"
                disabled={updateOrderMutation.isPending}
              >
                {updateOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar Ordem
              </Button>
            </>
          )}
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="h-9">
            <FileDown className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
          <Button onClick={handlePrint} size="sm" className="h-9 bg-[#0066CC] hover:bg-[#0052A3]">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards - Modern Gradient Style */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-[#0066CC] to-[#004C99] text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Geral</p>
                <p className="text-2xl font-bold mt-1">{grandTotalStudents.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <ChevronUp className="h-4 w-4" />
              <span className="text-sm">{overallOccupancy.toFixed(1)}% ocupação</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Vagas Totais</p>
                <p className="text-2xl font-bold mt-1">{grandTotalVacancies.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-sm">{(grandTotalVacancies - grandTotalStudents).toLocaleString()} disponíveis</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Rematriculados</p>
                <p className="text-2xl font-bold mt-1">{grandTotalReEnrolled.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-sm">{((grandTotalReEnrolled / Math.max(1, grandTotalStudents)) * 100).toFixed(0)}% do total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Novos Alunos</p>
                <p className="text-2xl font-bold mt-1">{grandTotalNew.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-sm">{((grandTotalNew / Math.max(1, grandTotalStudents)) * 100).toFixed(0)}% do total</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level Summary Cards - Modern Design */}
      <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Resumo por Nível de Ensino</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {["Educação Infantil", "Ensino Fundamental I", "Ensino Fundamental II", "Ensino Médio"].map(
              (level) => {
                const levelInfo = getLevelIcon(level);
                const IconComponent = levelInfo.icon;
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
                  <div 
                    key={level} 
                    className="p-4 rounded-xl border-2 transition-all hover:shadow-md"
                    style={{ borderColor: levelInfo.color + "40" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: levelInfo.bgColor }}
                      >
                        <IconComponent className="h-5 w-5" style={{ color: levelInfo.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{level}</p>
                        <p className="text-xs text-muted-foreground">{levelData?.length || 0} séries</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold" style={{ color: levelInfo.color }}>
                          {totalStudents.toLocaleString()}
                        </span>
                        <Badge 
                          className={cn(
                            "text-xs font-medium",
                            occupancy > 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            occupancy > 80 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}
                        >
                          {occupancy.toFixed(0)}%
                        </Badge>
                      </div>
                      
                      <Progress 
                        value={Math.min(100, occupancy)} 
                        className="h-2"
                        style={{ 
                          backgroundColor: levelInfo.bgColor,
                        }}
                      />
                      
                      <p className="text-xs text-muted-foreground">
                        de {totalVacancies.toLocaleString()} vagas
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table - Modern Card Style */}
      <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold text-foreground">Detalhamento por Série</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {localClassPlanning?.length || 0} registros
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8">Carregando planejamentos...</div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0066CC] hover:bg-[#0066CC]">
                      {!readOnly && <TableHead className="w-12 text-white text-xs font-medium">Ordem</TableHead>}
                      <TableHead className="text-white text-xs font-medium">Ano</TableHead>
                      <TableHead className="text-white text-xs font-medium whitespace-nowrap">Nível de Ensino</TableHead>
                      <TableHead className="text-white text-xs font-medium">Série/Ano</TableHead>
                      <TableHead className="text-white text-xs font-medium">Turno</TableHead>
                      <TableHead className="text-white text-xs font-medium">Cenário</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center">Turmas</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center whitespace-nowrap">Vagas/Turma</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center whitespace-nowrap">Total Vagas</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center">Remat.</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center">Novos</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center whitespace-nowrap">Total Alunos</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center whitespace-nowrap">Disponíveis</TableHead>
                      <TableHead className="text-white text-xs font-medium text-center">Ocupação</TableHead>
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
                                  isDragDisabled={readOnly}
                                >
                                  {(provided, snapshot) => (
                                    <TableRow 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={cn(
                                        getAcademicLevelRowClass(academicLevelName),
                                        snapshot.isDragging && "bg-accent/50 shadow-lg",
                                        "transition-colors"
                                      )}
                                    >
                                      {!readOnly && (
                                        <TableCell className="text-xs">
                                          <span {...provided.dragHandleProps} className="cursor-grab hover:cursor-grabbing">
                                            <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                          </span>
                                        </TableCell>
                                      )}
                                      <TableCell className="text-xs font-medium">{item.school_year.year}</TableCell>
                                      <TableCell className="text-xs whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: getLevelIcon(academicLevelName).color }}
                                          />
                                          {academicLevelName}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs font-medium">{item.grade_series.name}</TableCell>
                                      <TableCell className="text-xs">{item.shift}</TableCell>
                                      <TableCell className="text-xs">{item.scenario_name}</TableCell>
                                      <TableCell className="text-xs text-center">{item.total_classes}</TableCell>
                                      <TableCell className="text-xs text-center">{item.vacancies_per_class}</TableCell>
                                      <TableCell className="text-xs text-center font-semibold text-[#0066CC]">{totalVacancies}</TableCell>
                                      <TableCell className="text-xs text-center">{item.re_enrolled_students}</TableCell>
                                      <TableCell className="text-xs text-center">{item.new_students}</TableCell>
                                      <TableCell className="text-xs text-center font-semibold">{totalStudents}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          className={cn(
                                            "text-xs font-medium",
                                            availableVacancies < 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            availableVacancies <= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          )}
                                        >
                                          {availableVacancies}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          className={cn(
                                            "text-xs font-medium",
                                            occupancy > 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            occupancy > 80 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          )}
                                        >
                                          {occupancy.toFixed(0)}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Draggable>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={!readOnly ? 14 : 13} className="text-center py-12 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                  <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
                                  <span>Nenhum planejamento encontrado.</span>
                                </div>
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
          </CardContent>
        </Card>

      {/* Legend - Modern Style */}
      <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900 print:hidden">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">Até 80% - Disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground">80-100% - Atenção</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">&gt;100% - Superlotação</span>
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