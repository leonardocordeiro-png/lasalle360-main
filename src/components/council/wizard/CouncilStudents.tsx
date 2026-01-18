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
    <div className="px-2 sm:px-0 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Lista de Alunos</h3>
          <p className="text-sm text-muted-foreground">
            Adicione os alunos que participarão deste conselho
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Modelo
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <Button onClick={addStudent} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      <Card>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Nº</TableHead>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
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
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={student.student_name}
                        onChange={(e) =>
                          updateStudent(student.id, "student_name", e.target.value)
                        }
                        placeholder="Nome completo do aluno"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStudent(student.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total: {students.length} alunos
        </p>
        <Button onClick={handleContinue} className="w-full sm:w-auto">
          Continuar
        </Button>
      </div>
    </div>
  );
}