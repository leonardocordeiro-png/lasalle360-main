import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface CouncilGradesProps {
  data: any;
  onComplete: (data: any) => void;
}

export function CouncilGrades({ data, onComplete }: CouncilGradesProps) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any>(data?.grades || {});
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const students = data?.students || [];
  const academicLevel = data?.basicInfo?.academic_level || "EM";
  const gradeClass = data?.basicInfo?.grade_class || "";

  useEffect(() => {
    fetchSubjects();
  }, [academicLevel, gradeClass]);

  const fetchSubjects = async () => {
    const { data: subjectsData } = await supabase
      .from("council_subjects")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (subjectsData) {
      const filteredSubjects = filterSubjectsByGradeClass(subjectsData, gradeClass, academicLevel);
      setSubjects(filteredSubjects);
    }
  };

  const filterSubjectsByGradeClass = (allSubjects: any[], gradeClass: string, level: string) => {
    // Normaliza o nome da turma
    const normalizedClass = gradeClass.toUpperCase().trim();

    // Função para normalizar códigos (remove acentos, pontos e espaços)
    const normalizeCode = (s: string) =>
      s
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.\s]/g, "")
        .trim();

    // Expande sinônimos conhecidos para maior compatibilidade com o banco
    const expandSynonyms = (codes: string[]) => {
      const extra: string[] = [];
      codes.forEach((c) => {
        const n = c.toUpperCase().trim();
        // Redação
        if (["RED", "REDAÇÃO", "REDACAO"].includes(n)) {
          extra.push("RED", "REDA", "REDACAO", "REDAÇÃO", "RED.");
        }
        // Língua Portuguesa
        if (["L. PORT", "L PORT", "LÍNGUA PORTUGUESA", "LINGUA PORTUGUESA"].includes(n)) {
          extra.push("L. PORT", "L PORT", "LP", "LINGUA PORT", "LINGUA PORTUGUESA", "LÍNGUA PORTUGUESA");
        }
        // Educação Física
        if (["ED. FIS", "EF", "ED FIS"].includes(n)) {
          extra.push("ED. FIS", "EF", "ED FIS", "EDUCACAO FISICA", "EDUCAÇÃO FISICA");
        }
        // Física
        if (["FIS", "FÍS"].includes(n)) {
          extra.push("FIS", "FÍS", "FISICA", "FÍSICA");
        }
        // História
        if (["HIS", "HIST"].includes(n)) {
          extra.push("HIS", "HIST", "HISTORIA", "HISTÓRIA");
        }
      });
      return Array.from(new Set([...codes, ...extra]));
    };

    // Define os códigos de disciplinas permitidos para cada grupo (inclui sinônimos p/ compatibilidade com o banco)
    // Excluídas para EF II: ESP, MÚS, TEC, PV, PAST
    const efii6a8 = [
      "GRAM",
      "L. PORT",
      "MAT",
      "CIEN",
      "GEO",
      "HIST",
      "HIS",
      "EF",
      "ED. FIS",
      "ARTE",
      "RED",
      "ING",
      "ENS. REL",
    ];
    // Excluídas para EF II 9º ano: ESP, MÚS, TEC, PV, PAST
    const efii9 = [
      "GRAM",
      "MAT",
      "BIO",
      "GEO",
      "HIST",
      "HIS",
      "EF",
      "ED. FIS",
      "ARTE",
      "RED",
      "ING",
      "QUI",
      "LIT",
      "FÍS",
      "FIS",
      "ENS. REL",
    ];
    const em = [
      "L. PORT",
      "LIT",
      "ARTE",
      "ED. FIS",
      "ING",
      "MAT",
      "BIO",
      "FÍS",
      "QUI",
      "GEO",
      "HIS",
      "FIL",
      "SOC",
      "VIDA/FÉ",
      "AP/HIS",
      "AP/GEO",
      "INT/TEXT",
      "AP/MAT",
      "AP/BIO",
      "AP/QUI",
      "AP/FÍS",
    ];

    let allowedSubjects: string[] = [];

    // Determina quais disciplinas exibir baseado no nível e turma
    if (level === "EFII") {
      // Turmas do 6º ao 8º ano
      if (["161M", "162M", "163M", "171M", "172M", "181M", "182M"].includes(normalizedClass)) {
        allowedSubjects = efii6a8;
      }
      // Turmas do 9º ano
      else if (["191M", "192M"].includes(normalizedClass)) {
        allowedSubjects = efii9;
      }
      // Se não for nenhuma turma conhecida, mostra todas
      else {
        return allSubjects;
      }
    } else if (level === "EM") {
      // Turmas do Ensino Médio
      if (["211M", "212M", "213M", "221M", "222M", "231M", "232M"].includes(normalizedClass)) {
        allowedSubjects = em;
      }
      // Se não for nenhuma turma conhecida, mostra todas
      else {
        return allSubjects;
      }
    } else {
      // Para outros níveis, mostra todas as disciplinas
      return allSubjects;
    }

    // Normaliza os códigos permitidos para comparação (com sinônimos)
    const normalizedAllowed = new Set(
      expandSynonyms(allowedSubjects).map((code) => normalizeCode(code))
    );

    // Filtra as disciplinas baseado nos códigos permitidos (comparação robusta)
    const filtered = allSubjects.filter((subject) => {
      const normalizedCode = normalizeCode(subject.subject_code);
      return normalizedAllowed.has(normalizedCode);
    });

    // Remove duplicatas por código, priorizando o registro do nível atual
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
    const deduped = Array.from(uniqueByCode.values());

    console.log("Filtrando disciplinas:", {
      level,
      gradeClass: normalizedClass,
      allowedSubjects,
      totalSubjects: allSubjects.length,
      filteredSubjects: deduped.length,
      filtered: deduped.map((s) => s.subject_code),
    });

    return deduped;
  };

  const updateGrade = (studentId: string, subjectId: string, status: string) => {
    setGrades((prev: any) => ({
      ...prev,
      [`${studentId}_${subjectId}`]: status,
    }));
  };

  const setAllStudentsGrade = (subjectId: string, status: string) => {
    const newGrades = { ...grades };
    filteredStudents.forEach((student: any) => {
      newGrades[`${student.id}_${subjectId}`] = status;
    });
    setGrades(newGrades);
    toast.success(`Todos os alunos marcados como ${status}`);
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

  const getDisplayCode = (code: string) => {
    const n = code.toUpperCase().trim();
    if (academicLevel === "EFII") {
      if (n === "L. PORT") return "GRAM";
      if (n === "HIS") return "HIST";
    }
    if (n === "ED. FIS") return "EF";
    if (n === "FIS") return "FÍS";
    return code;
  };

  const filteredStudents = students.filter((student: any) =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditingSubject = (subject: any) => {
    setEditingSubjectId(subject.id);
    setEditingName(subject.subject_name);
  };

  const cancelEditingSubject = () => {
    setEditingSubjectId(null);
    setEditingName("");
  };

  const saveSubjectName = async (subjectId: string) => {
    if (!editingName.trim()) {
      toast.error("O nome da matéria não pode estar vazio");
      return;
    }

    const { error } = await supabase
      .from("council_subjects")
      .update({ subject_name: editingName.trim() })
      .eq("id", subjectId);

    if (error) {
      toast.error("Erro ao atualizar nome da matéria");
      return;
    }

    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId ? { ...s, subject_name: editingName.trim() } : s
      )
    );
    setEditingSubjectId(null);
    setEditingName("");
    toast.success("Nome da matéria atualizado");
  };

  const handleContinue = () => {
    onComplete(grades);
  };

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Avaliação por Disciplina</h3>
          <p className="text-sm text-muted-foreground">
            Preencha o status de cada aluno em cada disciplina
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-green-100 text-green-800">AP - Aprovado</Badge>
          <Badge className="bg-yellow-100 text-yellow-800">REC - Recuperação</Badge>
          <Badge className="bg-gray-100 text-gray-800">- Não se aplica</Badge>
        </div>
      </div>

      <Input
        placeholder="Buscar aluno..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full sm:max-w-sm"
      />

      <Card className="overflow-hidden">
        <ScrollArea className="w-full h-[600px]">
          <div className="min-w-max">
            <table className="w-full border-separate border-spacing-0">
              <thead className="bg-muted sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-2 text-left sticky left-0 top-0 bg-muted z-40 min-w-[200px]">
                    Aluno
                  </th>
                  {subjects.map((subject) => (
                    <th
                      key={subject.id}
                      className="p-2 text-center text-xs min-w-[120px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="font-semibold">{getDisplayCode(subject.subject_code)}</div>
                        {editingSubjectId === subject.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-6 text-xs w-24"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveSubjectName(subject.id);
                                } else if (e.key === "Escape") {
                                  cancelEditingSubject();
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => saveSubjectName(subject.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={cancelEditingSubject}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">
                              {subject.subject_name}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-4 w-4"
                              onClick={() => startEditingSubject(subject)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="p-2 text-left sticky left-0 bg-muted z-30 text-xs text-muted-foreground">
                    Marcar todos
                  </th>
                  {subjects.map((subject) => (
                    <th key={subject.id} className="p-1">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-12 text-[10px] bg-green-100 text-green-800 hover:bg-green-200 border-green-300"
                          onClick={() => setAllStudentsGrade(subject.id, "AP")}
                        >
                          AP
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-12 text-[10px] bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300"
                          onClick={() => setAllStudentsGrade(subject.id, "REC")}
                        >
                          REC
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-12 text-[10px] bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300"
                          onClick={() => setAllStudentsGrade(subject.id, "-")}
                        >
                          -
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student: any) => (
                  <tr key={student.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 sticky left-0 bg-background font-medium z-20 border-r border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {student.student_number}
                        </span>
                        <span className="text-sm">{student.student_name}</span>
                      </div>
                    </td>
                    {subjects.map((subject) => {
                      const gradeKey = `${student.id}_${subject.id}`;
                      const currentGrade = grades[gradeKey] || "";

                      return (
                        <td key={subject.id} className="p-1">
                          <Select
                            value={currentGrade}
                            onValueChange={(value) =>
                              updateGrade(student.id, subject.id, value)
                            }
                          >
                            <SelectTrigger
                              className={`h-8 text-xs ${getGradeColor(
                                currentGrade
                              )}`}
                            >
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AP">AP</SelectItem>
                              <SelectItem value="REC">REC</SelectItem>
                              <SelectItem value="-">-</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleContinue} className="w-full sm:w-auto">
          Continuar
        </Button>
      </div>
    </div>
  );
}