import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, Users, BookOpen, FileText, GraduationCap, Printer } from "lucide-react";
import { exportCouncilToPDF } from "@/lib/pdfExport";

interface CouncilViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  councilId: string;
}

export function CouncilViewDialog({ open, onOpenChange, councilId }: CouncilViewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [councilData, setCouncilData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  const filterSubjectsByGradeClass = (allSubjects: any[], gradeClass: string, level: string) => {
    const normalizedClass = gradeClass.toUpperCase().trim();
    
    const normalizeCode = (s: string) =>
      s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.\s]/g, "").trim();

    // Disciplinas excluídas para EF II: ESP, MÚS, TEC, PV, PAST
    const excludedForEFII = ["ESP", "MUS", "MÚSICA", "TEC", "PV", "PAST"];
    
    const efii6a8 = ["GRAM", "L. PORT", "MAT", "CIEN", "GEO", "HIST", "HIS", "EF", "ED. FIS", "ARTE", "RED", "ING", "ENS. REL"];
    const efii9 = ["GRAM", "MAT", "BIO", "GEO", "HIST", "HIS", "EF", "ED. FIS", "ARTE", "RED", "ING", "QUI", "LIT", "FÍS", "FIS", "ENS. REL"];
    const em = ["L. PORT", "LIT", "ARTE", "ED. FIS", "ING", "MAT", "BIO", "FÍS", "QUI", "GEO", "HIS", "FIL", "SOC", "VIDA/FÉ", "AP/HIS", "AP/GEO", "INT/TEXT", "AP/MAT", "AP/BIO", "AP/QUI", "AP/FÍS"];

    let allowedSubjects: string[] = [];

    if (level === "EFII") {
      if (["161M", "162M", "163M", "171M", "172M", "181M", "182M"].includes(normalizedClass)) {
        allowedSubjects = efii6a8;
      } else if (["191M", "192M"].includes(normalizedClass)) {
        allowedSubjects = efii9;
      } else {
        return allSubjects;
      }
    } else if (level === "EM") {
      if (["211M", "212M", "213M", "221M", "222M", "231M", "232M"].includes(normalizedClass)) {
        allowedSubjects = em;
      } else {
        return allSubjects;
      }
    } else {
      return allSubjects;
    }

    const normalizedAllowed = new Set(allowedSubjects.map((code) => normalizeCode(code)));
    const normalizedExcluded = new Set(excludedForEFII.map((code) => normalizeCode(code)));

    const filtered = allSubjects.filter((subject) => {
      const normalizedCode = normalizeCode(subject.subject_code);
      // Excluir matérias proibidas para EF II
      if (level === "EFII" && normalizedExcluded.has(normalizedCode)) {
        return false;
      }
      return normalizedAllowed.has(normalizedCode);
    });

    // Remove duplicatas
    const uniqueByCode = new Map<string, any>();
    filtered.forEach((s) => {
      const key = normalizeCode(s.subject_code);
      const existing = uniqueByCode.get(key);
      if (!existing) {
        uniqueByCode.set(key, s);
      } else {
        const preferCurrent = s.academic_level === level && existing.academic_level !== level;
        if (preferCurrent) uniqueByCode.set(key, s);
      }
    });

    return Array.from(uniqueByCode.values());
  };

  useEffect(() => {
    if (open && councilId) {
      fetchCouncilData();
    }
  }, [open, councilId]);

  const fetchCouncilData = async () => {
    try {
      setLoading(true);

      // Fetch council basic info
      const { data: council, error: councilError } = await supabase
        .from("class_councils")
        .select(`
          *,
          school_years(year)
        `)
        .eq("id", councilId)
        .single();

      if (councilError) throw councilError;
      setCouncilData(council);

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("council_students")
        .select("*")
        .eq("council_id", councilId)
        .order("display_order");

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Fetch grades
      const { data: gradesData, error: gradesError } = await supabase
        .from("council_grades")
        .select(`
          *,
          council_students(student_name, student_number),
          council_subjects(subject_name, subject_code)
        `)
        .in("council_student_id", studentsData?.map((s) => s.id) || []);

      if (gradesError) throw gradesError;
      setGrades(gradesData || []);

      // Fetch subjects for this academic level
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("council_subjects")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (subjectsError) throw subjectsError;
      
      // Filter subjects based on academic level and grade class
      const filteredSubjects = filterSubjectsByGradeClass(
        subjectsData || [],
        council.grade_class,
        council.academic_level
      );
      setSubjects(filteredSubjects);

      // Fetch actions
      const { data: actionsData, error: actionsError } = await supabase
        .from("council_actions")
        .select("*")
        .eq("council_id", councilId);

      if (actionsError) throw actionsError;
      setActions(actionsData || []);
    } catch (error) {
      console.error("Error fetching council data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (status: string) => {
    switch (status) {
      case "AP":
        return "bg-green-100 text-green-800 border-green-300";
      case "REC":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "-":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-white";
    }
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pais_chamados: "Pais a serem chamados",
      soe_acompanhar: "SOE deve acompanhar",
      sct_chamar: "SCT deve chamar",
      destaques: "Alunos Destaque",
    };
    return labels[type] || type;
  };

  const calculateFinalResult = (studentId: string) => {
    const studentGrades = grades.filter((g) => g.council_student_id === studentId);
    
    // Filter out grades that are "-" (não se aplica)
    const relevantGrades = studentGrades.filter((g) => g.grade_status && g.grade_status !== "-");
    
    // If no relevant grades, return N/A
    if (relevantGrades.length === 0) return { status: "N/A", label: "Sem avaliação" };
    
    // Check if any grade is REC
    const hasREC = relevantGrades.some((g) => g.grade_status === "REC");
    if (hasREC) return { status: "REC", label: "Recuperação" };
    
    // Check if all relevant grades are AP
    const allAP = relevantGrades.every((g) => g.grade_status === "AP");
    if (allAP) return { status: "AP", label: "Aprovado" };
    
    return { status: "N/A", label: "Sem avaliação" };
  };

  const getResultColor = (status: string) => {
    switch (status) {
      case "AP":
        return "bg-green-100 text-green-800 border-green-300";
      case "REC":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const handlePrint = async () => {
    try {
      await exportCouncilToPDF({
        council: councilData,
        students,
        grades,
        subjects,
        actions,
      } as any);
    } catch (e) {
      console.error("Erro ao gerar impressão do conselho:", e);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!councilData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-none max-h-[90vh] px-2 sm:px-4">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Conselho de Classe - {councilData.grade_class}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] pr-2 sm:pr-4 overflow-x-auto">
          <div className="space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nível Acadêmico</p>
                    <p className="font-medium">
                      {councilData.academic_level === "EM" ? "Ensino Médio" : "Ensino Fundamental II"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trimestre</p>
                    <p className="font-medium">{councilData.trimester}º Trimestre</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Turma</p>
                    <p className="font-medium">{councilData.grade_class}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data do Conselho</p>
                    <p className="font-medium">
                      {format(new Date(councilData.council_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ano Letivo</p>
                    <p className="font-medium">{councilData.school_years?.year}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="secondary">{councilData.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alunos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Alunos ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-2 text-sm border rounded-lg p-2">
                      <Badge variant="outline">{student.student_number}</Badge>
                      <span>{student.student_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notas por Disciplina */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Avaliações por Disciplina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <div className="relative w-full overflow-x-auto h-[50vh]">
                    <div className="min-w-[700px] sm:min-w-[900px] md:min-w-[1200px] p-2 sm:p-4">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left border sticky left-0 bg-muted z-10">Aluno</th>
                            {subjects.map((subject) => (
                              <th key={subject.id} className="p-2 text-center text-xs border whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-bold">{subject.subject_code}</span>
                                  <span className="text-[10px] text-muted-foreground">{subject.subject_name}</span>
                                </div>
                              </th>
                            ))}
                            <th className="p-2 text-center border bg-muted sticky right-0 z-10 w-40 min-w-[10rem]">
                              <span className="font-bold text-sm">Resultado Final</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => {
                            const finalResult = calculateFinalResult(student.id);
                            return (
                              <tr key={student.id} className="border-b hover:bg-muted/50">
                                <td className="p-2 border sticky left-0 bg-background font-medium z-10">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{student.student_number}</Badge>
                                    <span className="text-sm">{student.student_name}</span>
                                  </div>
                                </td>
                                {subjects.map((subject) => {
                                  const grade = grades.find(
                                    (g) => g.council_student_id === student.id && g.subject_id === subject.id
                                  );
                                  return (
                                    <td key={subject.id} className="p-2 text-center border">
                                      {grade ? (
                                        <Badge className={`${getGradeColor(grade.grade_status)} text-xs`}>
                                          {grade.grade_status}
                                        </Badge>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="p-2 text-center border bg-background sticky right-0 z-10 w-40 min-w-[10rem]">
                                  <Badge className={`${getResultColor(finalResult.status)} font-medium`}>
                                    {finalResult.label}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Encaminhamentos */}
            {actions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Encaminhamentos e Ações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {actions.map((action) => (
                      <div key={action.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>{getActionTypeLabel(action.action_type)}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {action.trimester}º Trimestre
                          </span>
                        </div>
                        {action.description && (
                          <p className="text-sm mt-2">{action.description}</p>
                        )}
                        {action.student_names && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <strong>Alunos:</strong> {action.student_names}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}