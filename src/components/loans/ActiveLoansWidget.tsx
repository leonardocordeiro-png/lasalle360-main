import { useEffect, useState, useRef } from "react";
import { Package, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Retorna a data local em Brasília no formato yyyy-MM-dd
const getBrazilDate = (offsetDays = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce<Record<string, string>>(
    (acc, p) => ({ ...acc, [p.type]: p.value }),
    {}
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function ActiveLoansWidget() {
  const [stats, setStats] = useState({
    active: 0,
    overdue: 0,
    dueSoon: 0,
  });
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("loans-stats-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chromebook_loans" },
        () => {
          // Debounce: evita múltiplas chamadas para eventos em rajada
          if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = setTimeout(() => fetchStats(), 500);
        }
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Empréstimos ativos
      const { count: activeCount } = await supabase
        .from("chromebook_loans")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_uso");

      // Empréstimos atrasados
      const { count: overdueCount } = await supabase
        .from("chromebook_loans")
        .select("*", { count: "exact", head: true })
        .eq("status", "atrasado");

      // Empréstimos que vencem hoje ou amanhã — usando fuso de Brasília
      const todayBR = getBrazilDate(0);
      const tomorrowBR = getBrazilDate(1);

      const { count: dueSoonCount } = await supabase
        .from("chromebook_loans")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_uso")
        .lte("expected_return_date", tomorrowBR)
        .gte("expected_return_date", todayBR);

      setStats({
        active: activeCount || 0,
        overdue: overdueCount || 0,
        dueSoon: dueSoonCount || 0,
      });
    } catch (error) {
      console.error("Error fetching loan stats:", error);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Empréstimos Ativos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.active}</div>
          <p className="text-xs text-muted-foreground">em uso no momento</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
          <p className="text-xs text-muted-foreground">precisam devolução urgente</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Vencem Hoje/Amanhã</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{stats.dueSoon}</div>
          <p className="text-xs text-muted-foreground">próximos a vencer</p>
        </CardContent>
      </Card>
    </div>
  );
}
