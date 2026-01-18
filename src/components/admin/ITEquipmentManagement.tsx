import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useModulePermission } from "@/lib/permissionsUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ITEquipmentDialog } from "./ITEquipmentDialog";
import { ITEquipmentBulkImport } from "./ITEquipmentBulkImport";
import { ITEquipmentDashboard } from "./ITEquipmentDashboard";
import { EquipmentLoanBadge } from "./EquipmentLoanBadge";
import {
  Plus, 
  Upload, 
  Edit, 
  Trash2, 
  Search, 
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Eye,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parse } from "date-fns";

const ITEMS_PER_PAGE = 50; // Alterado de 10 para 50

// Função para normalizar o texto do patrimônio (corrigir caracteres estranhos)
const normalizePatrimony = (patrimony: string | null | undefined): string => {
  if (!patrimony) return '-';
  
  // Corrigir padrões comuns de encoding quebrado
  let normalized = patrimony
    .replace(/SEM PATRIM�NIO/gi, 'SEM PATRIMÔNIO')
    .replace(/SEM PATRIMONIO/gi, 'SEM PATRIMÔNIO')
    .replace(/PATRIM�NIO/gi, 'PATRIMÔNIO')
    .replace(/PATRIMONIO/gi, 'PATRIMÔNIO')
    .replace(/�/g, 'Ô'); // Substituir caractere quebrado genérico
  
  return normalized;
};

export function ITEquipmentManagement() {
  const { toast } = useToast();
  const { canAccess, level, loading: permissionLoading } = useModulePermission('admin_it_equipment');
  const isReadOnly = level === 'read';
  const canEdit = level === 'write';
  const [equipments, setEquipments] = useState<any[]>([]);
  const [filteredEquipments, setFilteredEquipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filters, setFilters] = useState({
    search: '',
    sector: 'all',
    status: 'all'
  });

  const [sorting, setSorting] = useState({
    field: 'equipment_number',
    direction: 'asc' as 'asc' | 'desc' // Alterado de 'desc' para 'asc'
  });

  useEffect(() => {
    fetchEquipments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [equipments, filters, sorting]);

  const fetchEquipments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('it_equipment')
        .select(`
          *,
          direct_loan:chromebook_loans!chromebook_loans_equipment_id_fkey(
            id,
            borrower_name,
            loan_date,
            status,
            responsible_teacher,
            quantity
          )
        `)
        .order('equipment_number', { ascending: false });

      if (error) throw error;
      
      const processedData = await Promise.all((data || []).map(async (eq: any) => {
        let activeLoan = null;

        // Check for direct loan
        if (Array.isArray(eq.direct_loan) && eq.direct_loan.length > 0) {
          activeLoan = eq.direct_loan.find((loan: any) => ['em_uso', 'atrasado'].includes(loan.status));
        } else if (eq.direct_loan && ['em_uso', 'atrasado'].includes(eq.direct_loan.status)) {
          activeLoan = eq.direct_loan;
        }

        // If no direct loan, check for consolidated loan
        if (!activeLoan && eq.status === 'EMPRESTIMO') {
          const { data: consolidatedLoan } = await supabase
            .from('chromebook_loans')
            .select('id, borrower_name, loan_date, status, responsible_teacher, quantity')
            .like('chromebook_number', `%${eq.patrimony}%`)
            .in('status', ['em_uso', 'atrasado'])
            .maybeSingle();
          
          if (consolidatedLoan) {
            activeLoan = consolidatedLoan;
          }
        }

        return {
          ...eq,
          active_loan: activeLoan
        };
      }));

      setEquipments(processedData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar equipamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...equipments];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(eq =>
        (eq.id_number && eq.id_number.toLowerCase().includes(searchLower)) ||
        eq.patrimony.toLowerCase().includes(searchLower) ||
        eq.equipment_type.toLowerCase().includes(searchLower) ||
        eq.brand.toLowerCase().includes(searchLower) ||
        eq.model.toLowerCase().includes(searchLower) ||
        eq.serial_number.toLowerCase().includes(searchLower) ||
        (eq.mac_address && eq.mac_address.toLowerCase().includes(searchLower)) ||
        (eq.description && eq.description.toLowerCase().includes(searchLower)) ||
        (eq.active_loan?.borrower_name && eq.active_loan.borrower_name.toLowerCase().includes(searchLower))
      );
    }

    if (filters.sector !== 'all') {
      filtered = filtered.filter(eq => eq.sector === filters.sector);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(eq => eq.status === filters.status);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sorting.field];
      let bValue = b[sorting.field];

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sorting.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredEquipments(filtered);
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!equipmentToDelete) return;

    try {
      // If the equipment is part of a consolidated loan, do not delete it directly
      // Instead, update the consolidated loan record (if it exists)
      if (equipmentToDelete.status === 'EMPRESTIMO' && equipmentToDelete.active_loan?.quantity > 1) {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: "Este equipamento faz parte de um empréstimo consolidado. Cancele o empréstimo no módulo 'Empréstimos' antes de excluir o equipamento.",
        });
        return;
      }

      const { error } = await supabase
        .from('it_equipment')
        .delete()
        .eq('id', equipmentToDelete.id);

      if (error) throw error;

      toast({
        title: "Equipamento excluído",
        description: "O equipamento foi excluído com sucesso.",
      });

      fetchEquipments();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEquipmentToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      // Check if any selected equipment is part of an active consolidated loan
      const consolidatedLoanEquipments = equipments.filter(eq => 
        selectedIds.includes(eq.id) && eq.status === 'EMPRESTIMO' && eq.active_loan?.quantity > 1
      );

      if (consolidatedLoanEquipments.length > 0) {
        toast({
          variant: "destructive",
          title: "Erro ao excluir em lote",
          description: "Alguns equipamentos selecionados fazem parte de empréstimos consolidados. Cancele os empréstimos no módulo 'Empréstimos' antes de excluir os equipamentos.",
        });
        return;
      }

      const { error } = await supabase
        .from('it_equipment')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      toast({
        title: "Equipamentos excluídos",
        description: `${selectedIds.length} equipamento(s) foram excluídos com sucesso.`,
      });

      setSelectedIds([]);
      fetchEquipments();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedEquipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedEquipments.map(eq => eq.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const exportToCSV = () => {
    const headers = [
      'NUMERAÇÃO',
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
      'DESCRIÇÃO',
      'EMPRESTADO PARA',
      'DATA EMPRÉSTIMO',
      'PROFESSOR RESP.'
    ];

    const rows = filteredEquipments.map(eq => [
      eq.equipment_number,
      eq.id_number || '',
      eq.patrimony,
      eq.equipment_type,
      eq.brand,
      eq.model,
      eq.serial_number,
      eq.mac_address || '',
      eq.sector,
      eq.status,
      eq.responsible,
      eq.description || '',
      eq.active_loan?.borrower_name || '',
      eq.active_loan?.loan_date ? format(parse(eq.active_loan.loan_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '',
      eq.active_loan?.responsible_teacher || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `equipamentos_ti_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalPages = Math.ceil(filteredEquipments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEquipments = filteredEquipments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const sectors = Array.from(new Set(equipments.map(eq => eq.sector))).sort();

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertTitle>Modo Somente Leitura</AlertTitle>
          <AlertDescription>
            Você tem permissão apenas para visualizar este módulo. Contate um administrador para solicitar permissão de edição.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Equipamentos de TI
                {isReadOnly && (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Somente Leitura
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Gerencie o inventário de equipamentos de tecnologia
              </CardDescription>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                {selectedIds.length > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir ({selectedIds.length})
                  </Button>
                )}
                <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar
                </Button>
                <Button variant="outline" onClick={() => setBulkImportOpen(true)} className="w-full sm:w-auto">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Lote
                </Button>
                <Button variant="outline" onClick={exportToCSV} className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Listagem
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <ITEquipmentDashboard equipments={equipments} />
            </TabsContent>

            <TabsContent value="list" className="mt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, patrimônio, equipamento, marca, modelo, série, MAC ou descrição..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
              
              <Select
                value={filters.sector}
                onValueChange={(value) => setFilters({ ...filters, sector: value })}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ATIVO">ATIVO</SelectItem>
                  <SelectItem value="EMPRESTIMO">EMPRÉSTIMO</SelectItem>
                  <SelectItem value="DEFEITO">DEFEITO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar por:</span>
              <Select
                value={sorting.field}
                onValueChange={(value) => setSorting({ ...sorting, field: value })}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipment_number">Numeração</SelectItem>
                  <SelectItem value="patrimony">Patrimônio</SelectItem>
                  <SelectItem value="equipment_type">Equipamento</SelectItem>
                  <SelectItem value="brand">Marca</SelectItem>
                  <SelectItem value="serial_number">N° Série</SelectItem>
                  <SelectItem value="sector">Setor</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="responsible">Responsável</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSorting({ ...sorting, direction: sorting.direction === 'asc' ? 'desc' : 'asc' })}
                title={sorting.direction === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                className="w-full sm:w-10"
              >
                {sorting.direction === 'asc' ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando equipamentos...</div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEdit && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedIds.length === paginatedEquipments.length && paginatedEquipments.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-20">Nº</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Patrimônio</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Marca/Modelo</TableHead>
                        <TableHead>N° Série</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Emprestado Para</TableHead>
                        <TableHead>Responsável</TableHead>
                        {canEdit && <TableHead className="w-24">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEquipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canEdit ? 12 : 10} className="text-center py-8 text-muted-foreground">
                            Nenhum equipamento encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedEquipments.map((equipment) => (
                          <TableRow key={equipment.id}>
                            {canEdit && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(equipment.id)}
                                  onCheckedChange={() => toggleSelectOne(equipment.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-mono">{equipment.equipment_number}</TableCell>
                            <TableCell className="font-medium">{equipment.id_number || '-'}</TableCell>
                            <TableCell className="font-medium">{normalizePatrimony(equipment.patrimony)}</TableCell>
                            <TableCell>{equipment.equipment_type}</TableCell>
                            <TableCell>
                              {equipment.brand} {equipment.model}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{equipment.serial_number}</TableCell>
                            <TableCell>{equipment.sector}</TableCell>
                            <TableCell>
                              <EquipmentLoanBadge status={equipment.status} />
                            </TableCell>
                            <TableCell>
                              {equipment.status === 'EMPRESTIMO' && equipment.active_loan ? (
                                <div className="text-sm space-y-1">
                                  <p className="font-medium">{equipment.active_loan.borrower_name}</p>
                                   <p className="text-xs text-muted-foreground">
                                     {format(parse(equipment.active_loan.loan_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                                   </p>
                                  {equipment.active_loan.responsible_teacher && (
                                    <p className="text-xs text-blue-600">
                                      Prof.: {equipment.active_loan.responsible_teacher}
                                    </p>
                                  )}
                                  {equipment.active_loan.quantity > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      ({equipment.active_loan.quantity} Chromebooks)
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{equipment.responsible}</TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedEquipment(equipment);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEquipmentToDelete(equipment);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ITEquipmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
        onSuccess={fetchEquipments}
      />

      <ITEquipmentBulkImport
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={fetchEquipments}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o equipamento <strong>{equipmentToDelete?.patrimony}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-wrap gap-2 justify-end">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="w-full sm:w-auto">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.length}</strong> equipamento(s) selecionado(s)?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-wrap gap-2 justify-end">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="w-full sm:w-auto">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}