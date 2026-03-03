import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, Loader2, BookOpen, Users, FileText, ClipboardList, Check } from "lucide-react";
import { CouncilBasicInfo } from "./wizard/CouncilBasicInfo";
import { CouncilStudents } from "./wizard/CouncilStudents";
import { CouncilGrades } from "./wizard/CouncilGrades";
import { CouncilActions } from "./wizard/CouncilActions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { auditLog } from "@/lib/auditLogger";

// Helper function to format date without timezone issues
const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface CouncilWizardProps {
  onComplete: () => void;
  councilId?: string;
}

export function CouncilWizard({ onComplete, councilId }: CouncilWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [councilData, setCouncilData] = useState<any>({
    basicInfo: null,
    students: [],
    grades: {},
    actions: {},
  });

  useEffect(() => {
    if (councilId) {
      loadCouncilData();
    }
  }, [councilId]);

  const loadCouncilData = async () => {
    try {
      setLoading(true);

      // Load basic info
      const { data: council, error: councilError } = await supabase
        .from("class_councils")
        .select("*")
        .eq("id", councilId)
        .single();

      if (councilError) throw councilError;

      // Load students
      const { data: students, error: studentsError } = await supabase
        .from("council_students")
        .select("*")
        .eq("council_id", councilId)
        .order("display_order");

      if (studentsError) throw studentsError;

      // Load grades
      const { data: grades, error: gradesError } = await supabase
        .from("council_grades")
        .select("*")
        .in("council_student_id", students?.map((s) => s.id) || []);

      if (gradesError) throw gradesError;

      // Convert grades array to object format expected by the wizard
      const gradesObj: any = {};
      grades?.forEach((grade) => {
        gradesObj[`${grade.council_student_id}_${grade.subject_id}`] = grade.grade_status;
      });

      // Load actions
      const { data: actions, error: actionsError } = await supabase
        .from("council_actions")
        .select("*")
        .eq("council_id", councilId);

      if (actionsError) throw actionsError;

      // Convert actions array to object format
      const actionsObj: any = {};
      actions?.forEach((action) => {
        actionsObj[action.action_type] = action.description || "";
      });

      setCouncilData({
        basicInfo: {
          ...council,
          council_date: new Date(council.council_date),
        },
        students: students || [],
        grades: gradesObj,
        actions: actionsObj,
      });
    } catch (error: any) {
      console.error("Error loading council data:", error);
      toast.error("Erro ao carregar dados do conselho");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Informações", icon: BookOpen, component: CouncilBasicInfo },
    { number: 2, title: "Alunos", icon: Users, component: CouncilStudents },
    { number: 3, title: "Avaliações", icon: FileText, component: CouncilGrades },
    { number: 4, title: "Encaminhamentos", icon: ClipboardList, component: CouncilActions },
  ];

  const currentStep = steps[step - 1];
  const StepComponent = currentStep.component;

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleStepComplete = (data: any) => {
    const stepKey = 
      step === 1 ? "basicInfo" :
      step === 2 ? "students" :
      step === 3 ? "grades" :
      "actions";

    const newCouncilData = {
      ...councilData,
      [stepKey]: data,
    };

    setCouncilData(newCouncilData);

    if (step < steps.length) {
      handleNext();
    } else {
      // Importante: usar os dados já mesclados para evitar estado desatualizado
      handleSave(newCouncilData);
    }
  };

  const handleSave = async (dataOverride?: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const dataToSave = dataOverride ?? councilData;
      let currentCouncilId = councilId;

      // 1. Create or update the council
      if (councilId) {
        // Update existing council
        const { error: councilError } = await supabase
          .from("class_councils")
          .update({
            school_year_id: dataToSave.basicInfo.school_year_id,
            academic_level: dataToSave.basicInfo.academic_level,
            trimester: dataToSave.basicInfo.trimester,
            grade_class: dataToSave.basicInfo.grade_class,
            council_date: formatDateLocal(dataToSave.basicInfo.council_date),
          })
          .eq("id", councilId);

        if (councilError) throw councilError;

        // Delete existing related data before re-inserting
        await supabase.from("council_students").delete().eq("council_id", councilId);
        await supabase.from("council_actions").delete().eq("council_id", councilId);
      } else {
        // Create new council
        const { data: council, error: councilError } = await supabase
          .from("class_councils")
          .insert({
            school_year_id: dataToSave.basicInfo.school_year_id,
            academic_level: dataToSave.basicInfo.academic_level,
            trimester: dataToSave.basicInfo.trimester,
            grade_class: dataToSave.basicInfo.grade_class,
            council_date: formatDateLocal(dataToSave.basicInfo.council_date),
            status: "draft",
            created_by: user.id,
          })
          .select()
          .single();

        if (councilError) throw councilError;
        currentCouncilId = council.id;
      }

      // 2. Insert students
      const studentsToInsert = dataToSave.students.map((student: any, index: number) => ({
        council_id: currentCouncilId,
        student_number: student.student_number,
        student_name: student.student_name,
        display_order: index + 1,
      }));

      const { data: insertedStudents, error: studentsError } = await supabase
        .from("council_students")
        .insert(studentsToInsert)
        .select();

      if (studentsError) throw studentsError;

      // 3. Insert grades
      if (dataToSave.grades && Object.keys(dataToSave.grades).length > 0) {
        const gradesToInsert: any[] = [];

        // Create a comprehensive map of student identifiers to inserted student records
        const studentMap = new Map();
        dataToSave.students.forEach((originalStudent: any, index: number) => {
          const insertedStudent = insertedStudents[index];
          if (insertedStudent) {
            studentMap.set(originalStudent.id, insertedStudent);
            studentMap.set(originalStudent.student_number?.toString(), insertedStudent);
            studentMap.set(originalStudent.student_number, insertedStudent);
            studentMap.set(index.toString(), insertedStudent);
          }
        });

        Object.entries(dataToSave.grades).forEach(([key, status]) => {
          const [studentIdentifier, subjectId] = key.split("_");
          let matchingStudent = studentMap.get(studentIdentifier);

          if (!matchingStudent) {
            const originalStudent = dataToSave.students.find(
              (s: any) => s.id === studentIdentifier
            );
            if (originalStudent) {
              matchingStudent = studentMap.get(originalStudent.student_number);
            }
          }

          if (matchingStudent && status && status !== "-") {
            gradesToInsert.push({
              council_student_id: matchingStudent.id,
              subject_id: subjectId,
              grade_status: status,
            });
          }
        });

        if (gradesToInsert.length > 0) {
          const { error: gradesError } = await supabase
            .from("council_grades")
            .insert(gradesToInsert);

          if (gradesError) {
            console.error("Error inserting grades:", gradesError);
            console.log("Grades to insert:", gradesToInsert);
            throw gradesError;
          }
        }
      }

      // 4. Insert actions/encaminhamentos
      if (dataToSave.actions && Object.keys(dataToSave.actions).length > 0) {
        const actionsToInsert: any[] = [];

        Object.entries(dataToSave.actions).forEach(([key, value]) => {
          if (value && typeof value === "string" && value.trim()) {
            actionsToInsert.push({
              council_id: currentCouncilId,
              action_type: key,
              trimester: dataToSave.basicInfo.trimester,
              description: value,
            });
          }
        });

        if (actionsToInsert.length > 0) {
          const { error: actionsError } = await supabase
            .from("council_actions")
            .insert(actionsToInsert);

          if (actionsError) throw actionsError;
        }
      }

      toast.success(councilId ? "Conselho atualizado com sucesso!" : "Conselho criado com sucesso!");

      console.log('🔍 About to call auditLog for council:', {
        councilId,
        action: councilId ? 'update' : 'create',
        grade_class: dataToSave.basicInfo.grade_class,
        trimester: dataToSave.basicInfo.trimester
      });

      await auditLog({
        action: councilId ? 'update' : 'create',
        module: 'council',
        description: `Conselho de Classe ${councilId ? 'atualizado' : 'criado'} — ${dataToSave.basicInfo.grade_class}, ${dataToSave.basicInfo.trimester}º Trimestre`,
        resourceId: councilId || undefined,
        newData: { 
          grade_class: dataToSave.basicInfo.grade_class, 
          trimester: dataToSave.basicInfo.trimester, 
          academic_level: dataToSave.basicInfo.academic_level,
          students_count: dataToSave.students?.length || 0,
          grades_count: Object.keys(dataToSave.grades || {}).length,
          actions_count: Object.keys(dataToSave.actions || {}).length,
          school_year_id: dataToSave.basicInfo.school_year_id
        },
        metadata: {
          operation_type: councilId ? 'council_edit' : 'council_create',
          sensitive_data: true,
          data_categories: ['basic_info', 'students', 'grades', 'actions']
        }
      });

      onComplete();
    } catch (error: any) {
      console.error("Error saving council:", error);
      toast.error(error.message || "Erro ao salvar conselho");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center animate-pulse">
          <BookOpen className="h-5 w-5 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Carregando conselho...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      {/* Progress Stepper */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex items-start justify-between w-max min-w-full px-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = step > s.number;
            const isCurrent = step === s.number;
            const isUpcoming = step < s.number;

            return (
              <div key={s.number} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-300 ${
                      isCompleted
                        ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                        : isCurrent
                        ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-400 dark:border-purple-500 ring-4 ring-purple-100 dark:ring-purple-900/20"
                        : "bg-muted/30 text-muted-foreground/50 border-border/50"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <p
                    className={`text-[10px] sm:text-[11px] font-semibold mt-2 text-center whitespace-nowrap ${
                      isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {s.title}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 flex items-center px-2 sm:px-3 mt-5">
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors duration-300 ${
                        step > s.number ? "bg-purple-500" : "bg-border/40"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step indicator text */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          Etapa {step} de {steps.length}
        </span>
        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
          {currentStep.title}
        </span>
      </div>

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        <StepComponent
          data={councilData}
          onComplete={handleStepComplete}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-border/40">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
          className="rounded-xl h-9 text-xs font-semibold border-border/50"
        >
          <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
          Voltar
        </Button>
      </div>
    </div>
  );
}