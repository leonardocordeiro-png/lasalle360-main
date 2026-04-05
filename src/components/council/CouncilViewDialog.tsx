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
import { auditLog } from "@/lib/auditLogger";

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

      // Log access to sensitive council data
      await auditLog({
        action: 'data_access',
        module: 'council',
        description: `Dados do conselho acessados: ${council?.grade_class || 'N/A'} - ${council?.trimester || 'N/A'}º Trimestre`,
        resourceId: councilId,
        metadata: { 
          grade_class: council?.grade_class, 
          trimester: council?.trimester, 
          academic_level: council?.academic_level,
          access_type: 'view'
        }
      });

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("council_students")
        .select("id, student_number, student_name, display_order")
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
        .select("id, subject_code, subject_name, academic_level, display_order")
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
        .select("id, action_type, trimester, description, student_names")
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

      // Log PDF export of sensitive council data
      await auditLog({
        action: 'export',
        module: 'council',
        description: `PDF do conselho exportado: ${councilData?.grade_class || 'N/A'} - ${councilData?.trimester || 'N/A'}º Trimestre`,
        resourceId: councilId,
        metadata: { 
          grade_class: councilData?.grade_class, 
          trimester: councilData?.trimester, 
          academic_level: councilData?.academic_level,
          export_type: 'pdf',
          students_count: students?.length || 0,
          actions_count: actions?.length || 0
        }
      });
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

  const getActionColor = (type: string) => {
    const colors: Record<string, { gradient: string; bg: string; text: string }> = {
      pais_chamados: { gradient: "from-blue-400 to-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400" },
      soe_acompanhar: { gradient: "from-purple-400 to-purple-600", bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-600 dark:text-purple-400" },
      sct_chamar: { gradient: "from-orange-400 to-orange-600", bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-600 dark:text-orange-400" },
      destaques: { gradient: "from-amber-400 to-yellow-500", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-600 dark:text-amber-400" },
    };
    return colors[type] || colors.pais_chamados;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-none max-h-[90vh] px-0 sm:px-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center ring-1 ring-purple-200/50 dark:ring-purple-800/30">
                <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Conselho de Classe — {councilData.grade_class}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {councilData.trimester}º Trimestre • {councilData.school_years?.year}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden rounded-lg h-8 text-xs font-medium border-border/50">
              <Printer className="h-3 w-3 mr-1.5" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] overflow-x-auto">
          <div className="space-y-5 p-4 sm:p-6">
            {/* Informações Básicas */}
            <div className="rounded-xl border border-border/40 bg-muted/10 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <GraduationCap className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Informações Básicas</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Nível</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {councilData.academic_level === "EM" ? "Ensino Médio" : "Ensino Fundamental II"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Trimestre</p>
                  <p className="text-sm font-semibold mt-0.5">{councilData.trimester}º Trimestre</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Turma</p>
                  <p className="text-sm font-semibold mt-0.5">{councilData.grade_class}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Data</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {format(new Date(councilData.council_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ano Letivo</p>
                  <p className="text-sm font-semibold mt-0.5">{councilData.school_years?.year}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Status</p>
                  <div className="mt-0.5">
                    <Badge variant="outline" className="text-[10px] font-bold bg-muted/50">{councilData.status}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Alunos */}
            <div className="rounded-xl border border-border/40 bg-muted/10 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alunos ({students.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-background/60 border border-border/30">
                    <span className="text-[10px] font-bold bg-muted/50 px-1.5 py-0.5 rounded font-mono min-w-[24px] text-center">{student.student_number}</span>
                    <span className="text-xs font-medium">{student.student_name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notas por Disciplina */}
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="flex items-center gap-2 p-4 sm:p-5 pb-3">
                <div className="h-6 w-6 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Avaliações por Disciplina</span>
              </div>
              <div className="border-t border-border/30">
                <div className="relative w-full overflow-x-auto h-[50vh]">
                  <div className="min-w-[700px] sm:min-w-[900px] md:min-w-[1200px] p-2 sm:p-4">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left border border-border/30 sticky left-0 bg-muted/50 z-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aluno</th>
                          {subjects.map((subject) => (
                            <th key={subject.id} className="p-2 text-center text-xs border border-border/30 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-bold text-[11px]">{subject.subject_code}</span>
                                <span className="text-[9px] text-muted-foreground">{subject.subject_name}</span>
                              </div>
                            </th>
                          ))}
                          <th className="p-2 text-center border border-border/30 bg-muted/50 sticky right-0 z-10 w-40 min-w-[10rem]">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Resultado</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
                          const finalResult = calculateFinalResult(student.id);
                          return (
                            <tr key={student.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                              <td className="p-2 border border-border/30 sticky left-0 bg-background font-medium z-10">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold bg-muted/50 px-1.5 py-0.5 rounded font-mono">{student.student_number}</span>
                                  <span className="text-xs font-medium">{student.student_name}</span>
                                </div>
                              </td>
                              {subjects.map((subject) => {
                                const grade = grades.find(
                                  (g) => g.council_student_id === student.id && g.subject_id === subject.id
                                );
                                return (
                                  <td key={subject.id} className="p-2 text-center border border-border/30">
                                    {grade ? (
                                      <Badge variant="outline" className={`${getGradeColor(grade.grade_status)} text-[10px] font-bold`}>
                                        {grade.grade_status}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-2 text-center border border-border/30 bg-background sticky right-0 z-10 w-40 min-w-[10rem]">
                                <Badge variant="outline" className={`${getResultColor(finalResult.status)} text-[10px] font-bold`}>
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
            </div>

            {/* Encaminhamentos */}
            {actions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                    <Calendar className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Encaminhamentos e Ações</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actions.map((action) => {
                    const colors = getActionColor(action.action_type);
                    return (
                      <div key={action.id} className="relative overflow-hidden rounded-xl border border-border/40 bg-card/95 shadow-sm">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colors.gradient}`} />
                        <div className="p-4 pl-5">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px] font-bold bg-muted/50">
                              {getActionTypeLabel(action.action_type)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {action.trimester}º Trimestre
                            </span>
                          </div>
                          {action.description && (
                            <p className="text-xs leading-relaxed mt-1">{action.description}</p>
                          )}
                          {action.student_names && (
                            <p className="text-[11px] text-muted-foreground mt-2">
                              <strong className="text-foreground">Alunos:</strong> {action.student_names}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}