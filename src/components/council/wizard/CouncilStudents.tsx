import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Upload, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  student_number: number;
  student_name: string;
}

interface CouncilStudentsProps {
  data: any;
  onComplete: (data: Student[]) => void;
}

export function CouncilStudents({ data, onComplete }: CouncilStudentsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [students, setStudents] = useState<Student[]>(
    data?.students || [
      { id: crypto.randomUUID(), student_number: 1, student_name: "" },
    ]
  );

  const addStudent = () => {
    const newNumber = students.length > 0
      ? Math.max(...students.map((s) => s.student_number)) + 1
      : 1;

    setStudents([
      ...students,
      {
        id: crypto.randomUUID(),
        student_number: newNumber,
        student_name: "",
      },
    ]);
  };

  const removeStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
  };

  const updateStudent = (id: string, field: keyof Student, value: any) => {
    setStudents(
      students.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const downloadTemplate = () => {
    const templateData = [
      { "Número": 1, "Nome do Aluno": "Exemplo de Aluno 1" },
      { "Número": 2, "Nome do Aluno": "Exemplo de Aluno 2" },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alunos");
    XLSX.writeFile(wb, "modelo_alunos.xlsx");

    toast({
      title: "Modelo baixado",
      description: "Use este arquivo como modelo para importar alunos",
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const importedStudents: Student[] = data.map((row: any) => ({
          id: crypto.randomUUID(),
          student_number: parseInt(row["Número"] || row["Numero"] || row["numero"]) || 0,
          student_name: String(row["Nome do Aluno"] || row["Nome"] || row["nome"] || "").trim(),
        }));

        const validStudents = importedStudents.filter(
          (s) => s.student_name !== "" && s.student_number > 0
        );

        if (validStudents.length === 0) {
          toast({
            title: "Erro na importação",
            description: "Nenhum aluno válido encontrado no arquivo",
            variant: "destructive",
          });
          return;
        }

        setStudents(validStudents);
        toast({
          title: "Importação concluída",
          description: `${validStudents.length} aluno(s) importado(s) com sucesso`,
        });
      } catch (error) {
        toast({
          title: "Erro na importação",
          description: "Não foi possível ler o arquivo Excel",
          variant: "destructive",
        });
      }
    };
    reader.readAsBinaryString(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleContinue = () => {
    const validStudents = students.filter((s) => s.student_name.trim() !== "");
    if (validStudents.length === 0) {
      alert("Adicione pelo menos um aluno");
      return;
    }
    onComplete(validStudents);
  };

  return (
    <div className="px-2 sm:px-0 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Lista de Alunos</h3>
            <p className="text-[11px] text-muted-foreground font-medium">
              Adicione os alunos que participarão deste conselho
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 rounded-lg text-xs font-medium border-border/50">
            <Download className="mr-1.5 h-3 w-3" />
            Modelo
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 rounded-lg text-xs font-medium border-border/50">
            <Upload className="mr-1.5 h-3 w-3" />
            Importar
          </Button>
          <Button onClick={addStudent} size="sm" className="h-8 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
            <Plus className="mr-1.5 h-3 w-3" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[520px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nº</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome do Aluno</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} className="group hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <Input
                        type="number"
                        value={student.student_number}
                        onChange={(e) =>
                          updateStudent(
                            student.id,
                            "student_number",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-16 h-8 rounded-lg text-xs border-border/50 bg-muted/20 text-center font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={student.student_name}
                        onChange={(e) =>
                          updateStudent(student.id, "student_name", e.target.value)
                        }
                        placeholder="Nome completo do aluno"
                        className="h-8 rounded-lg text-sm border-border/50 bg-muted/20"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                        onClick={() => removeStudent(student.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          {students.length} aluno{students.length !== 1 ? 's' : ''} adicionado{students.length !== 1 ? 's' : ''}
        </span>
        <Button onClick={handleContinue} className="w-full sm:w-auto rounded-xl h-9 px-6 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md">
          Continuar
        </Button>
      </div>
    </div>
  );
}