import { useEffect, useState } from "react";
import { Package, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ActiveLoansWidget() {
  const [stats, setStats] = useState({
    active: 0,
    overdue: 0,
    dueSoon: 0,
  });

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("loans-stats-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chromebook_loans" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
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

      // Empréstimos que vencem hoje ou amanhã
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: dueSoonCount } = await supabase
        .from("chromebook_loans")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_uso")
        .lte("expected_return_date", tomorrow.toISOString().split("T")[0])
        .gte("expected_return_date", today.toISOString().split("T")[0]);

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
