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

      const { auditLog } = await import('@/lib/auditLogger');
      await auditLog({
        action: 'delete',
        module: 'it_equipment',
        description: `Equipamento "${equipmentToDelete.equipment_name}" excluído`,
        resourceId: equipmentToDelete.id,
        oldData: { name: equipmentToDelete.equipment_name, type: equipmentToDelete.equipment_type }
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

      const { auditLog } = await import('@/lib/auditLogger');
      await auditLog({
        action: 'bulk_delete',
        module: 'it_equipment',
        description: `${selectedIds.length} equipamento(s) excluído(s) em lote`,
        metadata: { count: selectedIds.length, ids: selectedIds }
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
      
      <Card className="border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
        {/* Gradient Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 sm:p-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/[0.04] rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/[0.03] rounded-full blur-xl" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20 shadow-lg">
                <Monitor className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Equipamentos de TI
                  {isReadOnly && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full text-white/80">
                      <Eye className="h-3 w-3" />
                      Leitura
                    </span>
                  )}
                </h2>
                <p className="text-blue-100/60 text-[11px] sm:text-xs font-medium tracking-wide">
                  Gerencie o inventário de equipamentos de tecnologia
                </p>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                {selectedIds.length > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="w-full sm:w-auto rounded-xl shadow-lg h-9 text-xs font-semibold"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Excluir ({selectedIds.length})
                  </Button>
                )}
                <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto rounded-xl bg-white text-blue-700 hover:bg-blue-50 shadow-lg h-9 text-xs font-semibold">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Cadastrar
                </Button>
                <Button variant="ghost" onClick={() => setBulkImportOpen(true)} className="w-full sm:w-auto rounded-xl text-white/80 hover:text-white hover:bg-white/10 h-9 text-xs font-semibold">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Importar
                </Button>
                <Button variant="ghost" onClick={exportToCSV} className="w-full sm:w-auto rounded-xl text-white/80 hover:text-white hover:bg-white/10 h-9 text-xs font-semibold">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Exportar
                </Button>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="inline-flex w-auto sm:w-full max-w-md items-center gap-1 bg-muted/50 backdrop-blur-sm border border-border/40 p-1 rounded-xl sm:justify-center">
              <TabsTrigger value="dashboard" className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200">
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200">
                <Monitor className="h-3.5 w-3.5" />
                Listagem
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <ITEquipmentDashboard equipments={equipments} />
            </TabsContent>

            <TabsContent value="list" className="mt-6">
          <div className="space-y-4">
            {/* Search & Filters Bar */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Buscar por ID, patrimônio, equipamento, marca, modelo, série, MAC..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 rounded-xl h-10 border-border/50 bg-muted/30 focus:bg-background transition-colors"
                  />
                </div>
                
                <Select
                  value={filters.sector}
                  onValueChange={(value) => setFilters({ ...filters, sector: value })}
                >
                  <SelectTrigger className="w-full sm:w-44 rounded-xl h-10 border-border/50 bg-muted/30">
                    <SelectValue placeholder="Setor" />
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
                  <SelectTrigger className="w-full sm:w-40 rounded-xl h-10 border-border/50 bg-muted/30">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="ATIVO">ATIVO</SelectItem>
                    <SelectItem value="EMPRESTIMO">EMPRÉSTIMO</SelectItem>
                    <SelectItem value="DEFEITO">DEFEITO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort & Info Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ordenar:</span>
                  <Select
                    value={sorting.field}
                    onValueChange={(value) => setSorting({ ...sorting, field: value })}
                  >
                    <SelectTrigger className="w-auto min-w-[140px] h-8 rounded-lg text-xs border-border/50 bg-muted/30">
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
                    className="h-8 w-8 rounded-lg border-border/50"
                  >
                    {sorting.direction === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {filteredEquipments.length} equipamento{filteredEquipments.length !== 1 ? 's' : ''} encontrado{filteredEquipments.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center animate-pulse">
                  <Monitor className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Carregando equipamentos...</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        {canEdit && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedIds.length === paginatedEquipments.length && paginatedEquipments.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-16 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nº</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ID</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Patrimônio</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Equipamento</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Marca/Modelo</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">N° Série</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Setor</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Emprestado Para</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</TableHead>
                        {canEdit && <TableHead className="w-24 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEquipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canEdit ? 12 : 10} className="text-center py-16">
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <Search className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Nenhum equipamento encontrado</p>
                                <p className="text-xs text-muted-foreground/60 mt-0.5">Tente ajustar os filtros de busca</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedEquipments.map((equipment) => (
                          <TableRow key={equipment.id} className="group hover:bg-muted/20 transition-colors">
                            {canEdit && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.includes(equipment.id)}
                                  onCheckedChange={() => toggleSelectOne(equipment.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-mono text-xs text-muted-foreground">{equipment.equipment_number}</TableCell>
                            <TableCell className="font-semibold text-sm">{equipment.id_number || '-'}</TableCell>
                            <TableCell className="font-semibold text-sm">{normalizePatrimony(equipment.patrimony)}</TableCell>
                            <TableCell className="text-sm">{equipment.equipment_type}</TableCell>
                            <TableCell className="text-sm">
                              <span className="font-medium">{equipment.brand}</span>{' '}
                              <span className="text-muted-foreground">{equipment.model}</span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{equipment.serial_number}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center text-xs font-medium bg-muted/40 px-2 py-0.5 rounded-md">
                                {equipment.sector}
                              </span>
                            </TableCell>
                            <TableCell>
                              <EquipmentLoanBadge status={equipment.status} />
                            </TableCell>
                            <TableCell>
                              {equipment.status === 'EMPRESTIMO' && equipment.active_loan ? (
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold">{equipment.active_loan.borrower_name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {format(parse(equipment.active_loan.loan_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                                  </p>
                                  {equipment.active_loan.responsible_teacher && (
                                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                      Prof.: {equipment.active_loan.responsible_teacher}
                                    </p>
                                  )}
                                  {equipment.active_loan.quantity > 1 && (
                                    <span className="inline-flex text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                      {equipment.active_loan.quantity} Chromebooks
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{equipment.responsible}</TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                                    onClick={() => {
                                      setSelectedEquipment(equipment);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    onClick={() => {
                                      setEquipmentToDelete(equipment);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={`rounded-lg h-8 ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                          .map((page, idx, arr) => (
                            <span key={page} className="contents">
                              {idx > 0 && arr[idx - 1] !== page - 1 && (
                                <PaginationItem>
                                  <span className="px-2 text-xs text-muted-foreground">…</span>
                                </PaginationItem>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer rounded-lg h-8 w-8 text-xs"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            </span>
                          ))}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={`rounded-lg h-8 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
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