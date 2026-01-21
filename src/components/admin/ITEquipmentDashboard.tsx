import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Monitor, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Laptop, 
  Wrench,
  Building2,
  Activity,
  Package,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
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

interface ITEquipmentDashboardProps {
  equipments: any[];
}

const STATUS_COLORS = {
  ATIVO: "#22c55e",
  DEFEITO: "#ef4444",
  EMPRESTIMO: "#3b82f6",
};

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

export function ITEquipmentDashboard({ equipments }: ITEquipmentDashboardProps) {
  const stats = useMemo(() => {
    const total = equipments.length;
    const active = equipments.filter((eq) => eq.status === "ATIVO").length;
    const defective = equipments.filter((eq) => eq.status === "DEFEITO").length;
    const onLoan = equipments.filter((eq) => eq.status === "EMPRESTIMO").length;
    const activePercentage = total > 0 ? Math.round((active / total) * 100) : 0;
    const defectivePercentage = total > 0 ? Math.round((defective / total) * 100) : 0;

    return { total, active, defective, onLoan, activePercentage, defectivePercentage };
  }, [equipments]);

  const equipmentByType = useMemo(() => {
    const typeMap = new Map<string, { total: number; active: number; defective: number; onLoan: number }>();

    equipments.forEach((eq) => {
      const type = eq.equipment_type || "Outros";
      if (!typeMap.has(type)) {
        typeMap.set(type, { total: 0, active: 0, defective: 0, onLoan: 0 });
      }
      const typeData = typeMap.get(type)!;
      typeData.total++;
      if (eq.status === "ATIVO") typeData.active++;
      if (eq.status === "DEFEITO") typeData.defective++;
      if (eq.status === "EMPRESTIMO") typeData.onLoan++;
    });

    return Array.from(typeMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [equipments]);

  const equipmentBySector = useMemo(() => {
    const sectorMap = new Map<string, { total: number; active: number; defective: number }>();

    equipments.forEach((eq) => {
      const sector = eq.sector || "Não definido";
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { total: 0, active: 0, defective: 0 });
      }
      const data = sectorMap.get(sector)!;
      data.total++;
      if (eq.status === "ATIVO") data.active++;
      if (eq.status === "DEFEITO") data.defective++;
    });

    return Array.from(sectorMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [equipments]);

  const statusData = useMemo(() => [
    { name: "Ativos", value: stats.active, color: STATUS_COLORS.ATIVO },
    { name: "Com Defeito", value: stats.defective, color: STATUS_COLORS.DEFEITO },
    { name: "Em Empréstimo", value: stats.onLoan, color: STATUS_COLORS.EMPRESTIMO },
  ].filter(item => item.value > 0), [stats]);

  const brandDistribution = useMemo(() => {
    const brandMap = new Map<string, number>();
    equipments.forEach((eq) => {
      const brand = eq.brand || "Não informada";
      brandMap.set(brand, (brandMap.get(brand) || 0) + 1);
    });
    return Array.from(brandMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [equipments]);

  return (
    <div className="space-y-6">
      {/* Header com Visão Geral */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Visão Geral dos Equipamentos</h2>
        <p className="text-muted-foreground">
          Monitoramento em tempo real do parque tecnológico
        </p>
      </div>

      {/* Cards de Estatísticas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Equipamentos</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        {/* Ativos */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Equipamentos Ativos</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">{stats.activePercentage}%</span>
              <span className="text-xs text-muted-foreground">operacionais</span>
            </div>
          </CardContent>
        </Card>

        {/* Com Defeito */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Defeito</CardTitle>
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.defective}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.defectivePercentage > 10 ? (
                <ArrowUpRight className="h-3 w-3 text-red-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-green-500" />
              )}
              <span className="text-xs text-muted-foreground">{stats.defectivePercentage}% do total</span>
            </div>
          </CardContent>
        </Card>

        {/* Em Empréstimo */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Empréstimo</CardTitle>
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Laptop className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.onLoan}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Equipamentos emprestados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Saúde do Parque e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Indicador de Saúde */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Saúde do Parque
            </CardTitle>
            <CardDescription>Índice de funcionamento dos equipamentos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4">
            <div className="relative w-40 h-40">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={stats.activePercentage >= 80 ? "#22c55e" : stats.activePercentage >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${stats.activePercentage * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold">{stats.activePercentage}%</span>
                <span className="text-xs text-muted-foreground">Operacional</span>
              </div>
            </div>
            <div className="mt-6 w-full space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Ativos</span>
                </div>
                <span className="font-medium">{stats.active}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Com Defeito</span>
                </div>
                <span className="font-medium">{stats.defective}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Em Empréstimo</span>
                </div>
                <span className="font-medium">{stats.onLoan}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Status - Gráfico */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Visão geral do estado dos equipamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} equipamento(s)`, '']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  verticalAlign="middle" 
                  align="right" 
                  layout="vertical"
                  formatter={(value) => <span className="text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equipamentos por Setor e Tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Setor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Equipamentos por Setor
            </CardTitle>
            <CardDescription>Top 8 setores com mais equipamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {equipmentBySector.map((sector, index) => {
                const percentage = stats.total > 0 ? Math.round((sector.total / stats.total) * 100) : 0;
                const healthPercentage = sector.total > 0 ? Math.round((sector.active / sector.total) * 100) : 0;
                return (
                  <div key={sector.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="font-medium truncate max-w-[150px]">{sector.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">
                          {sector.total}
                        </Badge>
                        <span className={`text-xs font-medium ${healthPercentage >= 80 ? 'text-green-600' : healthPercentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {healthPercentage}% ok
                        </span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Marcas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              Distribuição por Marca
            </CardTitle>
            <CardDescription>Principais fabricantes no inventário</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={brandDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} equipamento(s)`, 'Quantidade']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equipamentos por Tipo - Gráfico de Barras */}
      <Card>
        <CardHeader>
          <CardTitle>Equipamentos por Tipo</CardTitle>
          <CardDescription>Quantidade por categoria com status detalhado</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={equipmentByType} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80} 
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="active" name="Ativos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="defective" name="Com Defeito" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onLoan" name="Em Empréstimo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cards de Resumo por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Detalhado por Tipo</CardTitle>
          <CardDescription>Estatísticas completas de cada categoria de equipamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipmentByType.map((type, index) => {
              const healthPercentage = type.total > 0 ? Math.round((type.active / type.total) * 100) : 0;
              return (
                <div 
                  key={type.name} 
                  className="p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20` }}
                      >
                        <Monitor 
                          className="h-5 w-5" 
                          style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{type.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {type.total} equipamento{type.total !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${healthPercentage >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : healthPercentage >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}
                    >
                      {healthPercentage}% ok
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {type.active} Ativo{type.active !== 1 ? 's' : ''}
                    </Badge>
                    {type.defective > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {type.defective} Defeito{type.defective !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {type.onLoan > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                        <Laptop className="h-3 w-3 mr-1" />
                        {type.onLoan} Empréstimo{type.onLoan !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
