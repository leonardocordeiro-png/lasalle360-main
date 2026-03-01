import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ITEquipmentBulkImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ITEquipmentBulkImport({ open, onOpenChange, onSuccess }: ITEquipmentBulkImportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'ID',
      'PATRIMÔNIO',
      'EQUIPAMENTO',
      'MARCA',
      'MODELO',
      'N° SÉRIE',
      'MAC',
      'SETOR',
      'STATUS',
      'RESPONSÁVEL',
      'DESCRIÇÃO'
    ];

    const exampleRow1 = [
      '',
      '062111',
      'Chromebook',
      'Samsung',
      'XE310XBA',
      '09WZ9QBT109103D',
      '7C:50:79:49:1F:D3',
      'TI/TE',
      'ATIVO',
      'TI/TE',
      ''
    ];

    const exampleRow2 = [
      '',
      '062112',
      'Desktop',
      'HP',
      'ProDesk 600',
      'SN987654321',
      '',
      'Administrativo',
      'ATIVO',
      'Administrativo',
      'Equipamento da secretaria'
    ];

    const csvContent = [
      headers.join(';'),
      exampleRow1.join(';'),
      exampleRow2.join(';')
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_equipamentos_ti.csv';
    link.click();
  };

  const parseCSV = (text: string): string[][] => {
    // Remove BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // Split by line breaks (handle both \n and \r\n)
    const lines = cleanText.split(/\r?\n/);
    
    // Detect separator by checking first line
    const firstLine = lines[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const separator = semicolonCount >= commaCount ? ';' : ',';
    
    return lines.map(line => {
      // Skip empty lines
      if (!line.trim()) return [];
      
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else if (char !== '\r') { // Ignore carriage return
          current += char;
        }
      }
      
      values.push(current.trim());
      return values;
    }).filter(row => row.length > 0 && row.some(cell => cell.length > 0));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrors([]);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      console.log('CSV parsed:', { totalRows: rows.length, firstRow: rows[0], secondRow: rows[1] });
      
      if (rows.length < 2) {
        throw new Error('Arquivo CSV deve conter cabeçalho e pelo menos uma linha de dados');
      }

      const [headers, ...dataRows] = rows;
      
      // Validate header count
      if (headers.length !== 11) {
        throw new Error(`Cabeçalho inválido: esperado 11 colunas, encontrado ${headers.length}. Verifique se o arquivo está usando ponto e vírgula (;) como separador.`);
      }

      // Fetch existing equipment to check for duplicates
      const { data: existingEquipments, error: fetchError } = await supabase
        .from('it_equipment')
        .select('patrimony, serial_number, mac_address');

      if (fetchError) throw fetchError;

      const existingPatrimonies = new Set(existingEquipments?.map(eq => eq.patrimony.toLowerCase()) || []);
      const existingSerialNumbers = new Set(existingEquipments?.map(eq => eq.serial_number.toLowerCase()) || []);
      const existingMacs = new Set(existingEquipments?.filter(eq => eq.mac_address).map(eq => eq.mac_address!.toLowerCase()) || []);
      
      const validationErrors: string[] = [];
      const equipmentsToInsert: any[] = [];
      const currentPatrimonies = new Set<string>();
      const currentSerialNumbers = new Set<string>();
      const currentMacs = new Set<string>();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNumber = i + 2;

        if (row.length < 11) {
          validationErrors.push(`Linha ${rowNumber}: Número insuficiente de colunas (esperado: 11, recebido: ${row.length})`);
          continue;
        }

        const [id_number, patrimony, equipment_type, brand, model, serial_number, mac_address, sector, status, responsible, description] = row;

        const { data: validationResult } = await supabase.rpc('validate_it_equipment_import', {
          p_patrimony: patrimony,
          p_equipment_type: equipment_type,
          p_brand: brand,
          p_model: model,
          p_serial_number: serial_number,
          p_mac_address: mac_address || null,
          p_sector: sector,
          p_status: status,
          p_responsible: responsible
        });

        if (validationResult !== 'OK') {
          validationErrors.push(`Linha ${rowNumber}: ${validationResult}`);
          continue;
        }

        // Check for duplicates against existing equipment
        const patrimonyLower = patrimony.toLowerCase();
        const serialLower = serial_number.toLowerCase();
        const macLower = mac_address ? mac_address.toLowerCase() : null;

        if (existingPatrimonies.has(patrimonyLower)) {
          validationErrors.push(`Linha ${rowNumber}: Patrimônio "${patrimony}" já existe no sistema`);
          continue;
        }

        if (existingSerialNumbers.has(serialLower)) {
          validationErrors.push(`Linha ${rowNumber}: N° Série "${serial_number}" já existe no sistema`);
          continue;
        }

        if (macLower && existingMacs.has(macLower)) {
          validationErrors.push(`Linha ${rowNumber}: Endereço MAC "${mac_address}" já existe no sistema`);
          continue;
        }

        // Check for duplicates within the current import batch
        if (currentPatrimonies.has(patrimonyLower)) {
          validationErrors.push(`Linha ${rowNumber}: Patrimônio "${patrimony}" está duplicado na planilha`);
          continue;
        }

        if (currentSerialNumbers.has(serialLower)) {
          validationErrors.push(`Linha ${rowNumber}: N° Série "${serial_number}" está duplicado na planilha`);
          continue;
        }

        if (macLower && currentMacs.has(macLower)) {
          validationErrors.push(`Linha ${rowNumber}: Endereço MAC "${mac_address}" está duplicado na planilha`);
          continue;
        }

        // Add to current batch tracking
        currentPatrimonies.add(patrimonyLower);
        currentSerialNumbers.add(serialLower);
        if (macLower) currentMacs.add(macLower);

        equipmentsToInsert.push({
          id_number: id_number || null,
          patrimony,
          equipment_type,
          brand,
          model,
          serial_number,
          mac_address: mac_address || null,
          sector,
          status: status as 'ATIVO' | 'DEFEITO',
          responsible,
          description: description || null,
          created_by: user.id
        });
      }

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (equipmentsToInsert.length === 0) {
        throw new Error('Nenhum equipamento válido para importar');
      }

      const { error } = await supabase
        .from('it_equipment')
        .insert(equipmentsToInsert);

      if (error) throw error;

      toast({
        title: "Importação concluída",
        description: `${equipmentsToInsert.length} equipamento(s) importado(s) com sucesso.`,
      });

      const { auditLog } = await import('@/lib/auditLogger');
      await auditLog({
        action: 'import',
        module: 'it_equipment',
        description: `${equipmentsToInsert.length} equipamento(s) importado(s) via planilha`,
        metadata: { count: equipmentsToInsert.length }
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Equipamentos em Lote</DialogTitle>
          <DialogDescription>
            Importe múltiplos equipamentos de uma vez usando um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Modelo de Planilha
            </Button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivo CSV
                  </>
                )}
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Erros encontrados na validação:</div>
                <ul className="list-disc pl-4 space-y-1 max-h-60 overflow-y-auto">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-semibold">Instruções:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Baixe o modelo de planilha CSV</li>
              <li>Abra o arquivo com um editor de texto ou Excel</li>
              <li>Preencha os dados dos equipamentos nas linhas seguintes</li>
              <li>
                <span className="font-semibold">Importante:</span> Ao salvar no Excel:
                <ul className="list-disc pl-4 mt-1">
                  <li>Use "Salvar Como" → "CSV (delimitado por ponto e vírgula) (*.csv)"</li>
                  <li>OU mantenha o separador como ponto e vírgula (;)</li>
                </ul>
              </li>
              <li>Faça o upload do arquivo preenchido</li>
            </ol>
            <div className="mt-2 space-y-1">
              <p><span className="font-semibold">Campos obrigatórios:</span> PATRIMÔNIO, EQUIPAMENTO, MARCA, MODELO, N° SÉRIE, SETOR, STATUS, RESPONSÁVEL</p>
              <p><span className="font-semibold">Campos opcionais:</span> ID, MAC (formato XX:XX:XX:XX:XX:XX ou XX-XX-XX-XX-XX-XX), DESCRIÇÃO</p>
              <p><span className="font-semibold">STATUS:</span> Apenas ATIVO ou DEFEITO</p>
              <p className="text-orange-600 dark:text-orange-400 font-semibold">⚠️ O arquivo deve ter exatamente 11 colunas separadas por ponto e vírgula (;)</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}