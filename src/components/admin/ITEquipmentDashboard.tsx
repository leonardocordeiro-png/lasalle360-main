import { useMemo } from "react";
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

interface ITEquipmentDashboardProps {
  equipments: any[];
}

const STATUS_COLORS = {
  ATIVO: "hsl(var(--chart-1))",
  DEFEITO: "hsl(var(--chart-2))",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ITEquipmentDashboard({ equipments }: ITEquipmentDashboardProps) {
  const stats = useMemo(() => {
    const total = equipments.length;
    const active = equipments.filter((eq) => eq.status === "ATIVO").length;
    const defective = equipments.filter((eq) => eq.status === "DEFEITO").length;
    const activePercentage = total > 0 ? ((active / total) * 100).toFixed(1) : 0;

    return { total, active, defective, activePercentage };
  }, [equipments]);

  const equipmentByType = useMemo(() => {
    const typeMap = new Map<string, { total: number; active: number; defective: number }>();

    equipments.forEach((eq) => {
      const type = eq.equipment_type;
      if (!typeMap.has(type)) {
        typeMap.set(type, { total: 0, active: 0, defective: 0 });
      }
      const typeData = typeMap.get(type)!;
      typeData.total++;
      if (eq.status === "ATIVO") typeData.active++;
      if (eq.status === "DEFEITO") typeData.defective++;
    });

    return Array.from(typeMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [equipments]);

  const equipmentBySector = useMemo(() => {
    const sectorMap = new Map<string, number>();

    equipments.forEach((eq) => {
      const sector = eq.sector;
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
    });

    return Array.from(sectorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 setores
  }, [equipments]);

  const statusData = useMemo(() => [
    { name: "Ativos", value: stats.active, color: STATUS_COLORS.ATIVO },
    { name: "Com Defeito", value: stats.defective, color: STATUS_COLORS.DEFEITO },
  ], [stats]);

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipamentos Ativos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Em funcionamento normal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Defeito</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.defective}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Necessitam manutenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Funcionamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePercentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Equipamentos operacionais
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Visão geral do status dos equipamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Setor */}
        <Card>
          <CardHeader>
            <CardTitle>Equipamentos por Setor</CardTitle>
            <CardDescription>Top 8 setores com mais equipamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={equipmentBySector} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Equipamentos por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Equipamentos por Tipo</CardTitle>
          <CardDescription>Quantidade total, ativos e com defeito por tipo de equipamento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={equipmentByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total" fill="hsl(var(--chart-3))" />
              <Bar dataKey="active" name="Ativos" fill="hsl(var(--chart-1))" />
              <Bar dataKey="defective" name="Com Defeito" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela de Resumo por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Detalhado por Tipo</CardTitle>
          <CardDescription>Estatísticas detalhadas de cada tipo de equipamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {equipmentByType.map((type, index) => (
              <div key={type.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Total: {type.total} equipamento{type.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {type.active} Ativo{type.active !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {type.defective > 0 && (
                    <div className="text-right">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {type.defective} Defeito{type.defective !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
