import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, UserPlus, Clock, Filter, ArrowUpDown, MoreHorizontal, ChevronUp, GraduationCap, BookOpen, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useState } from "react";

interface ClassPlanningData {
  id: string;
  shift: string;
  total_classes: number;
  vacancies_per_class: number;
  re_enrolled_students: number;
  new_students: number;
  grade_series: {
    name: string;
    academic_level: {
      name: string;
    };
  };
}

export const SchoolPlanningDashboard = () => {
  const [periodFilter, setPeriodFilter] = useState("anual");
  
  const { data: classPlanning, isLoading } = useQuery({
    queryKey: ["school-planning-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_planning")
        .select(`
          *,
          grade_series (
            name,
            academic_level:academic_levels (name)
          )
        `);

      if (error) throw error;
      return data as ClassPlanningData[];
    },
  });

  const { data: complementaryPrograms } = useQuery({
    queryKey: ["complementary-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complementary_programs")
        .select("id, program_name, enrolled_students, school_year_id");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const totalVacancies = classPlanning?.reduce(
    (sum, item) => sum + item.total_classes * item.vacancies_per_class,
    0
  ) || 0;

  const totalStudents = classPlanning?.reduce(
    (sum, item) => sum + item.re_enrolled_students + item.new_students,
    0
  ) || 0;

  const newStudents = classPlanning?.reduce(
    (sum, item) => sum + item.new_students,
    0
  ) || 0;

  const reEnrolledStudents = classPlanning?.reduce(
    (sum, item) => sum + item.re_enrolled_students,
    0
  ) || 0;

  const occupancyRate = totalVacancies > 0 
    ? ((totalStudents / totalVacancies) * 100).toFixed(1)
    : "0";

  const fullTimeStudents = complementaryPrograms?.reduce(
    (sum, program) => sum + program.enrolled_students,
    0
  ) || 0;

  // Prepare data for charts
  const levelData = classPlanning?.reduce((acc, item) => {
    const levelName = item.grade_series.academic_level.name;
    const students = item.re_enrolled_students + item.new_students;
    
    const existing = acc.find((l) => l.name === levelName);
    if (existing) {
      existing.value += students;
    } else {
      acc.push({ name: levelName, value: students });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>);

  const occupancyByLevel = classPlanning?.reduce((acc, item) => {
    const levelName = item.grade_series.academic_level.name;
    const totalVac = item.total_classes * item.vacancies_per_class;
    const students = item.re_enrolled_students + item.new_students;
    const occupancy = totalVac > 0 ? (students / totalVac) * 100 : 0;

    const existing = acc.find((l) => l.level === levelName);
    if (existing) {
      existing.vacancies += totalVac;
      existing.students += students;
      existing.occupancy = (existing.students / existing.vacancies) * 100;
    } else {
      acc.push({
        level: levelName,
        vacancies: totalVac,
        students,
        occupancy,
      });
    }
    return acc;
  }, [] as Array<{ level: string; vacancies: number; students: number; occupancy: number }>);

  // Modern gradient colors (purple/violet theme like the reference)
  const GRADIENT_COLORS = {
    primary: "#8B5CF6",
    primaryLight: "#A78BFA", 
    secondary: "#06B6D4",
    secondaryLight: "#22D3EE",
    accent: "#7C3AED",
    success: "#10B981",
    warning: "#F59E0B",
  };

  const DONUT_COLORS = ["#8B5CF6", "#A78BFA", "#C4B5FD", "#06B6D4"];

  // Data for the weekly bar chart (simulated based on current data)
  const weeklyData = [
    { day: "Dom", value: Math.round(totalStudents * 0.12), highlight: false },
    { day: "Seg", value: Math.round(totalStudents * 0.18), highlight: false },
    { day: "Ter", value: Math.round(totalStudents * 0.22), highlight: true },
    { day: "Qua", value: Math.round(totalStudents * 0.15), highlight: false },
    { day: "Qui", value: Math.round(totalStudents * 0.14), highlight: false },
    { day: "Sex", value: Math.round(totalStudents * 0.11), highlight: false },
    { day: "Sáb", value: Math.round(totalStudents * 0.08), highlight: false },
  ];

  // Data for integration/levels table
  const levelTableData = levelData?.map((level, index) => ({
    name: level.name,
    type: index % 2 === 0 ? "Regular" : "Especial",
    rate: Math.min(100, Math.round((level.value / totalStudents) * 100)),
    students: level.value,
    icon: index === 0 ? GraduationCap : index === 1 ? BookOpen : Building2,
    color: DONUT_COLORS[index % DONUT_COLORS.length],
  })) || [];

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Top Row - Overview Card and Subscribers Card */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Overview Card with Bar Chart */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">Visão Geral</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  Filtrar
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Ordenar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="mb-4">
              <div className="text-3xl font-bold text-foreground">{totalStudents.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium">
                  <ChevronUp className="h-3 w-3 mr-0.5" />
                  {((newStudents / Math.max(1, reEnrolledStudents)) * 100).toFixed(1)}%
                </Badge>
                <span className="text-sm text-muted-foreground">+{newStudents} novos alunos</span>
              </div>
            </div>
            
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyByLevel} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="level" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`${value} alunos`, 'Total']}
                  />
                  <Bar 
                    dataKey="students" 
                    fill="url(#barGradient)" 
                    radius={[8, 8, 0, 0]}
                    label={({ x, y, width, value }) => (
                      <text 
                        x={x + width / 2} 
                        y={y - 8} 
                        fill="#6B7280" 
                        textAnchor="middle" 
                        fontSize={11}
                        fontWeight={500}
                      >
                        {value.toLocaleString()}
                      </text>
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              {levelData?.slice(0, 5).map((level, index) => (
                <div key={level.name} className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">{level.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Subscribers / Students Card */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg font-semibold text-foreground">Total de Matrículas</CardTitle>
              </div>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="mb-4">
              <div className="text-3xl font-bold text-foreground">{totalVacancies.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium">
                  <ChevronUp className="h-3 w-3 mr-0.5" />
                  {occupancyRate}%
                </Badge>
                <span className="text-sm text-muted-foreground">taxa de ocupação</span>
              </div>
            </div>
            
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barCategoryGap="15%">
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[6, 6, 0, 0]}
                  >
                    {weeklyData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.highlight ? "#8B5CF6" : "#E0E7FF"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Peak indicator */}
            <div className="text-center mt-2">
              <span className="text-sm text-muted-foreground">
                Pico: <span className="font-semibold text-foreground">{Math.max(...weeklyData.map(d => d.value)).toLocaleString()}</span> alunos
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Distribution Donut and Level Table */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Distribution Donut Chart */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">Distribuição</CardTitle>
              <Select defaultValue="mensal">
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {/* Donut Chart */}
              <div className="relative w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {levelData?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{levelData?.length || 0}</span>
                  <span className="text-xs text-muted-foreground">Níveis</span>
                </div>
              </div>

              {/* Legend with values */}
              <div className="flex-1 ml-6 space-y-3">
                {levelData?.slice(0, 4).map((level, index) => (
                  <div key={level.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground">{level.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{level.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Levels/Integration Table */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-neutral-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg font-semibold text-foreground">Níveis de Ensino</CardTitle>
              </div>
              <Button variant="link" className="text-violet-600 dark:text-violet-400 text-sm p-0 h-auto">
                Ver Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 pb-3 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-1">
                <input type="checkbox" className="rounded border-gray-300" />
                <span>Nível</span>
              </div>
              <div>Tipo</div>
              <div>Taxa</div>
              <div className="text-right">Alunos</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {levelTableData.map((level, index) => {
                const IconComponent = level.icon;
                return (
                  <div key={level.name} className="grid grid-cols-4 gap-4 py-3 items-center">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${level.color}20` }}
                      >
                        <IconComponent className="h-4 w-4" style={{ color: level.color }} />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{level.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{level.type}</div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={level.rate} 
                        className="h-1.5 flex-1 bg-gray-100 dark:bg-gray-800"
                        style={{ 
                          ['--progress-background' as string]: level.color 
                        }}
                      />
                      <span className="text-xs text-muted-foreground w-8">{level.rate}%</span>
                    </div>
                    <div className="text-right text-sm font-semibold text-foreground">
                      {level.students.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Total de Alunos</p>
                <p className="text-2xl font-bold mt-1">{totalStudents.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <ChevronUp className="h-4 w-4" />
              <span className="text-sm">{occupancyRate}% ocupação</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 text-sm font-medium">Novos Alunos</p>
                <p className="text-2xl font-bold mt-1">{newStudents.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <ChevronUp className="h-4 w-4" />
              <span className="text-sm">{reEnrolledStudents} rematrículas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Vagas Disponíveis</p>
                <p className="text-2xl font-bold mt-1">{(totalVacancies - totalStudents).toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-sm">de {totalVacancies.toLocaleString()} total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Turno Integral</p>
                <p className="text-2xl font-bold mt-1">{fullTimeStudents.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-sm">alunos matriculados</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};