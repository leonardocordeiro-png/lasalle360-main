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
  EM_USO: "#3b82f6",
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
    const onLoan = equipments.filter((eq) => eq.status === "EM_USO").length;
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
      if (eq.status === "EM_USO") typeData.onLoan++;
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
    { name: "Em Uso", value: stats.onLoan, color: STATUS_COLORS.EM_USO },
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
      {/* Cards de Estatísticas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-card/95 backdrop-blur-sm group hover:shadow-xl transition-shadow duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-600 rounded-l" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/[0.04] rounded-full -translate-y-4 translate-x-4" />
          <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</p>
              <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center ring-2 ring-blue-200/50 dark:ring-blue-800/30 flex-shrink-0">
                <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground leading-none tracking-tight">{stats.total}</div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1 font-medium">cadastrados</p>
          </CardContent>
        </Card>

        {/* Ativos */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-card/95 backdrop-blur-sm group hover:shadow-xl transition-shadow duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-green-600 rounded-l" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/[0.04] rounded-full -translate-y-4 translate-x-4" />
          <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ativos</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center ring-2 ring-emerald-200/50 dark:ring-emerald-800/30 flex-shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">{stats.active}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{stats.activePercentage}%</span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium">operacionais</span>
            </div>
          </CardContent>
        </Card>

        {/* Com Defeito */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-card/95 backdrop-blur-sm group hover:shadow-xl transition-shadow duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-400 to-rose-600 rounded-l" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/[0.04] rounded-full -translate-y-4 translate-x-4" />
          <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Com Defeito</p>
              <div className="h-8 w-8 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center ring-2 ring-red-200/50 dark:ring-red-800/30 flex-shrink-0">
                <Wrench className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 leading-none tracking-tight">{stats.defective}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.defectivePercentage > 10 ? (
                <ArrowUpRight className="h-3 w-3 text-red-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-emerald-500" />
              )}
              <span className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium">{stats.defectivePercentage}% do total</span>
            </div>
          </CardContent>
        </Card>

        {/* Em Empréstimo */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-card/95 backdrop-blur-sm group hover:shadow-xl transition-shadow duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/[0.04] rounded-full -translate-y-4 translate-x-4" />
          <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Em Empréstimo</p>
              <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center ring-2 ring-amber-200/50 dark:ring-amber-800/30 flex-shrink-0">
                <Laptop className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 leading-none tracking-tight">{stats.onLoan}</div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1 font-medium">emprestados</p>
          </CardContent>
        </Card>
      </div>

      {/* Saúde do Parque e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Indicador de Saúde */}
        <Card className="lg:col-span-1 border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Saúde do Parque</CardTitle>
                <CardDescription className="text-[11px]">Índice de funcionamento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-2 pb-5">
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="none"
                  className="text-muted/15"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={stats.activePercentage >= 80 ? "#22c55e" : stats.activePercentage >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${stats.activePercentage * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black tracking-tight">{stats.activePercentage}%</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Operacional</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-2.5 px-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium">Ativos</span>
                </div>
                <span className="font-bold">{stats.active}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="font-medium">Com Defeito</span>
                </div>
                <span className="font-bold">{stats.defective}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-medium">Em Empréstimo</span>
                </div>
                <span className="font-bold">{stats.onLoan}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Status - Gráfico */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Distribuição por Status</CardTitle>
            <CardDescription className="text-[11px]">Visão geral do estado dos equipamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
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
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="middle" 
                  align="right" 
                  layout="vertical"
                  formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equipamentos por Setor e Marca */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Por Setor */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Por Setor</CardTitle>
                <CardDescription className="text-[11px]">Top 8 setores</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {equipmentBySector.map((sector, index) => {
                const percentage = stats.total > 0 ? Math.round((sector.total / stats.total) * 100) : 0;
                const healthPercentage = sector.total > 0 ? Math.round((sector.active / sector.total) * 100) : 0;
                return (
                  <div key={sector.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="font-semibold truncate max-w-[130px]">{sector.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-muted/50 px-1.5 py-0.5 rounded">
                          {sector.total}
                        </span>
                        <span className={`text-[10px] font-bold ${healthPercentage >= 80 ? 'text-emerald-600' : healthPercentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {healthPercentage}%
                        </span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Marcas */}
        <Card className="border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                <Monitor className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Por Marca</CardTitle>
                <CardDescription className="text-[11px]">Principais fabricantes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={brandDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={90} 
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} equipamento(s)`, 'Quantidade']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#3b82f6" 
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equipamentos por Tipo - Gráfico de Barras */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Equipamentos por Tipo</CardTitle>
          <CardDescription className="text-[11px]">Quantidade por categoria com status detalhado</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={equipmentByType} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80} 
                tick={{ fontSize: 10 }}
                tickLine={false}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
              <Bar dataKey="active" name="Ativos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="defective" name="Com Defeito" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onLoan" name="Em Empréstimo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cards de Resumo por Tipo */}
      <Card className="border-0 shadow-lg bg-card/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Resumo por Tipo</CardTitle>
          <CardDescription className="text-[11px]">Estatísticas de cada categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipmentByType.map((type, index) => {
              const healthPercentage = type.total > 0 ? Math.round((type.active / type.total) * 100) : 0;
              return (
                <div 
                  key={type.name} 
                  className="relative overflow-hidden p-4 border border-border/40 rounded-xl hover:bg-muted/30 transition-all duration-200 group"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <div className="flex items-start justify-between mb-2.5 pl-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center ring-1 ring-border/30"
                        style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}15` }}
                      >
                        <Monitor 
                          className="h-4 w-4" 
                          style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{type.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {type.total} equipamento{type.total !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] font-bold ${healthPercentage >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : healthPercentage >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}
                    >
                      {healthPercentage}% ok
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      {type.active} Ativo{type.active !== 1 ? 's' : ''}
                    </Badge>
                    {type.defective > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                        <AlertCircle className="h-2.5 w-2.5 mr-1" />
                        {type.defective} Defeito{type.defective !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {type.onLoan > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                        <Laptop className="h-2.5 w-2.5 mr-1" />
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
