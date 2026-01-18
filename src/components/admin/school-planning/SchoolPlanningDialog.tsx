import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, X, Loader2 } from "lucide-react";

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
  display_order?: number; // Added display_order
}

interface SchoolPlanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planningId?: string; // Optional: if provided, it's an edit operation
  onSuccess: () => void;
  readOnly?: boolean;
}

export const SchoolPlanningDialog = ({
  open,
  onOpenChange,
  planningId,
  onSuccess,
  readOnly = false,
}: SchoolPlanningDialogProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ClassPlanningForm>({
    school_year_id: "",
    grade_series_id: "",
    scenario_name: "Cenário Atual",
    shift: "Manhã",
    total_classes: 1,
    vacancies_per_class: 25,
    re_enrolled_students: 0,
    new_students: 0,
    transferred_students: 0,
    waiting_list: 0,
    notes: "",
    display_order: 0, // Default display_order
  });
  const [loadingInitialData, setLoadingInitialData] = useState(false);

  const { data: schoolYears } = useQuery({
    queryKey: ["school-years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: gradeSeries } = useQuery({
    queryKey: ["grade-series"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_series")
        .select(`
          *,
          academic_level:academic_levels (name)
        `)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      if (planningId) {
        setLoadingInitialData(true);
        const fetchPlanning = async () => {
          const { data, error } = await supabase
            .from("class_planning")
            .select("*")
            .eq("id", planningId)
            .single();
          if (error) {
            toast.error("Erro ao carregar planejamento: " + error.message);
            onOpenChange(false);
          } else if (data) {
            setFormData({
              school_year_id: data.school_year_id,
              grade_series_id: data.grade_series_id,
              scenario_name: data.scenario_name,
              shift: data.shift,
              total_classes: data.total_classes,
              vacancies_per_class: data.vacancies_per_class,
              re_enrolled_students: data.re_enrolled_students,
              new_students: data.new_students,
              transferred_students: data.transferred_students,
              waiting_list: data.waiting_list,
              notes: data.notes || "",
            });
          }
          setLoadingInitialData(false);
        };
        fetchPlanning();
      } else {
        // Reset form for new creation
        setFormData({
          school_year_id: "",
          grade_series_id: "",
          scenario_name: "Cenário Atual",
          shift: "Manhã",
          total_classes: 1,
          vacancies_per_class: 25,
          re_enrolled_students: 0,
          new_students: 0,
          transferred_students: 0,
          waiting_list: 0,
          notes: "",
        });
      }
    }
  }, [open, planningId, onOpenChange, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: Omit<ClassPlanningForm, "id">) => {
      const { data: result, error } = await supabase
        .from("class_planning")
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-planning"] });
      queryClient.invalidateQueries({ queryKey: ["school-planning-dashboard"] });
      toast.success("Planejamento criado com sucesso!");
      onSuccess();
    },
    onError: (error) => {
      toast.error("Erro ao criar planejamento: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: ClassPlanningForm) => {
      const { error } = await supabase
        .from("class_planning")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-planning"] });
      queryClient.invalidateQueries({ queryKey: ["school-planning-dashboard"] });
      toast.success("Planejamento atualizado com sucesso!");
      onSuccess();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar planejamento: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) {
      toast.error("Você não tem permissão para editar este módulo.");
      return;
    }
    if (planningId) {
      updateMutation.mutate({ ...formData, id: planningId });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{planningId ? "Editar Planejamento" : "Novo Planejamento"}</DialogTitle>
        </DialogHeader>

        {loadingInitialData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="school_year_id">Ano Letivo</Label>
                <Select
                  value={formData.school_year_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, school_year_id: value })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger id="school_year_id">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears?.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="grade_series_id">Série/Ano</Label>
                <Select
                  value={formData.grade_series_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, grade_series_id: value })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger id="grade_series_id">
                    <SelectValue placeholder="Selecione a série" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeSeries?.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.academic_level.name} - {series.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scenario_name">Cenário</Label>
                <Input
                  id="scenario_name"
                  value={formData.scenario_name}
                  onChange={(e) =>
                    setFormData({ ...formData, scenario_name: e.target.value })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="shift">Turno</Label>
                <Select
                  value={formData.shift}
                  onValueChange={(value) =>
                    setFormData({ ...formData, shift: value })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger id="shift">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manhã">Manhã</SelectItem>
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Integral">Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="total_classes">Total de Turmas</Label>
                <Input
                  id="total_classes"
                  type="number"
                  min="0"
                  value={formData.total_classes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_classes: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="vacancies_per_class">Vagas por Turma</Label>
                <Input
                  id="vacancies_per_class"
                  type="number"
                  min="0"
                  value={formData.vacancies_per_class}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vacancies_per_class: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="re_enrolled_students">Rematriculados</Label>
                <Input
                  id="re_enrolled_students"
                  type="number"
                  min="0"
                  value={formData.re_enrolled_students}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      re_enrolled_students: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="new_students">Novos Alunos</Label>
                <Input
                  id="new_students"
                  type="number"
                  min="0"
                  value={formData.new_students}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      new_students: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="transferred_students">Transferidos</Label>
                <Input
                  id="transferred_students"
                  type="number"
                  min="0"
                  value={formData.transferred_students}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      transferred_students: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <Label htmlFor="waiting_list">Lista de Espera</Label>
                <Input
                  id="waiting_list"
                  type="number"
                  min="0"
                  value={formData.waiting_list}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      waiting_list: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={readOnly}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                disabled={readOnly}
              />
            </div>

            <DialogFooter className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} className="w-full sm:w-auto">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || readOnly} className="w-full sm:w-auto">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {planningId ? "Atualizar" : "Criar"} Planejamento
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};