import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";
import { CouncilBasicInfo } from "./wizard/CouncilBasicInfo";
import { CouncilStudents } from "./wizard/CouncilStudents";
import { CouncilGrades } from "./wizard/CouncilGrades";
import { CouncilActions } from "./wizard/CouncilActions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
    { number: 1, title: "Informações Básicas", component: CouncilBasicInfo },
    { number: 2, title: "Alunos", component: CouncilStudents },
    { number: 3, title: "Avaliações", component: CouncilGrades },
    { number: 4, title: "Encaminhamentos", component: CouncilActions },
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
            council_date: format(dataToSave.basicInfo.council_date, "yyyy-MM-dd"),
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
            council_date: format(dataToSave.basicInfo.council_date, "yyyy-MM-dd"),
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
      onComplete();
    } catch (error: any) {
      console.error("Error saving council:", error);
      toast.error(error.message || "Erro ao salvar conselho");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      {/* Progress Indicator */}
      <div className="w-full overflow-x-auto">
        <div className="flex items-center gap-3 w-max">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  step >= s.number
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-muted-foreground text-muted-foreground"
                }`}
              >
                {s.number}
              </div>
              <div className="ml-2">
                <p
                  className={`text-sm font-medium ${
                    step >= s.number ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.title}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 sm:w-16 mx-2 sm:mx-4 ${
                    step > s.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        <StepComponent
          data={councilData}
          onComplete={handleStepComplete}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    </div>
  );
}