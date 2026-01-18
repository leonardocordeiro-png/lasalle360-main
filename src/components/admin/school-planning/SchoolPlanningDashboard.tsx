import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, UserPlus, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
        .select("*");
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

  const COLORS = {
    primary: "hsl(var(--chart-1))",
    success: "hsl(var(--chart-2))",
    warning: "hsl(var(--chart-3))",
    danger: "hsl(var(--chart-4))",
    info: "hsl(var(--chart-5))",
  };

  const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger];

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              de {totalVacancies} vagas disponíveis
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Ocupação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalVacancies - totalStudents} vagas restantes
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Alunos</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newStudents}</div>
            <p className="text-xs text-muted-foreground">
              {reEnrolledStudents} rematriculados
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turno Integral</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fullTimeStudents}</div>
            <p className="text-xs text-muted-foreground">
              alunos matriculados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 w-full">
        {/* Pie Chart - Distribution by Level */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Distribuição por Nível de Ensino</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[320px] sm:min-w-0">
                <ChartContainer
                  config={{
                    students: {
                      label: "Alunos",
                      color: COLORS.primary,
                    },
                  }}
                  className="h-[250px] sm:h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill={COLORS.primary}
                        dataKey="value"
                      >
                        {levelData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - Occupancy by Level */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Taxa de Ocupação por Nível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[360px] sm:min-w-0">
                <ChartContainer
                  config={{
                    occupancy: {
                      label: "Ocupação %",
                      color: COLORS.primary,
                    },
                  }}
                  className="h-[250px] sm:h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyByLevel} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="level" type="category" width={100} className="text-xs sm:text-sm" />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Bar dataKey="occupancy" fill={COLORS.primary} radius={[0, 4, 4, 0]}>
                        {occupancyByLevel?.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.occupancy > 100
                                ? COLORS.danger
                                : entry.occupancy > 80
                                ? COLORS.warning
                                : COLORS.success
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stacked Bar - Re-enrolled vs New */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base">Rematriculados vs Novos Alunos por Nível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[480px] sm:min-w-0">
                <ChartContainer
                  config={{
                    reEnrolled: {
                      label: "Rematriculados",
                      color: COLORS.primary,
                    },
                    newStudents: {
                      label: "Novos",
                      color: COLORS.success,
                    },
                  }}
                  className="h-[250px] sm:h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={classPlanning?.reduce((acc, item) => {
                        const levelName = item.grade_series.academic_level.name;
                        const existing = acc.find((l) => l.level === levelName);
                        
                        if (existing) {
                          existing.reEnrolled += item.re_enrolled_students;
                          existing.newStudents += item.new_students;
                        } else {
                          acc.push({
                            level: levelName,
                            reEnrolled: item.re_enrolled_students,
                            newStudents: item.new_students,
                          });
                        }
                        return acc;
                      }, [] as Array<{ level: string; reEnrolled: number; newStudents: number }>)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="reEnrolled" stackId="a" fill={COLORS.primary} name="Rematriculados" />
                      <Bar dataKey="newStudents" stackId="a" fill={COLORS.success} name="Novos" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};