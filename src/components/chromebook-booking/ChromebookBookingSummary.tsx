import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Chrome, Calendar, Clock, GraduationCap, Loader2, CheckCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TimeSlot {
  start: string;
  end: string;
}

interface ChromebookBookingSummaryProps {
  selectedDate: Date;
  selectedSlots: TimeSlot[];
  quantity: number;
  classGroupName: string;
  onBookingCreated: () => void;
  onClearSelection: () => void;
  totalInventory: number;
}

export function ChromebookBookingSummary({
  selectedDate,
  selectedSlots,
  quantity,
  classGroupName,
  onBookingCreated,
  onClearSelection,
  totalInventory,
}: ChromebookBookingSummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        setUserProfile(data);
      }
    };
    fetchUserProfile();
  }, []);

  const canSubmit = selectedSlots.length > 0 && quantity > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Criar um agendamento para cada slot selecionado
      const bookingsToCreate = selectedSlots.map(slot => ({
        user_id: user.id,
        full_name: profile.full_name,
        class_name: classGroupName.trim() || 'Sem turma',
        quantity: quantity,
        booking_date: dateStr,
        start_time: slot.start,
        end_time: slot.end,
        status: 'active',
      }));

      const { error } = await supabase
        .from('chromebook_bookings')
        .insert(bookingsToCreate);

      if (error) throw error;

      toast({
        title: "Agendamento realizado!",
        description: `${selectedSlots.length} horário(s) reservado(s) com sucesso.`,
      });

      onBookingCreated();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast({
        title: "Erro ao agendar",
        description: error.message || "Não foi possível realizar o agendamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-fit sticky top-4 border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-500 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
            <CheckCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Resumo da Reserva</h3>
            <p className="text-[11px] text-white/70 font-medium">
              {selectedSlots.length > 0 ? `${selectedSlots.length} horário(s)` : 'Nenhum horário selecionado'}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {selectedSlots.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
              <Chrome className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Selecione os horários desejados na grade de disponibilidade</p>
          </div>
        ) : (
          <>
            {/* Recurso */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/15">
              <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/20">
                <Chrome className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Chromebooks</p>
                <p className="text-[11px] text-muted-foreground">Equipamento de Aluno</p>
              </div>
            </div>

            {/* Data */}
            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors duration-150">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {format(selectedDate, "EEEE", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Horários Selecionados */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Horários Selecionados</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSlots.map((slot, index) => (
                  <Badge key={index} variant="secondary" className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 font-medium">
                    {slot.start} - {slot.end}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quantidade */}
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground font-medium">Quantidade</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xl text-emerald-600 dark:text-emerald-400 leading-none">{quantity}</span>
                  <span className="text-[11px] text-muted-foreground">un.</span>
                </div>
              </div>
            </div>

            {/* Turma */}
            {classGroupName && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors duration-150">
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Turma</p>
                  <p className="text-sm font-medium">{classGroupName}</p>
                </div>
              </div>
            )}

            {/* Solicitante */}
            {userProfile && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors duration-150">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary">
                    {userProfile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Solicitante</p>
                  <p className="text-sm font-medium">{userProfile.full_name}</p>
                </div>
              </div>
            )}

            <Separator className="my-1" />

            {/* Botões */}
            <div className="space-y-2 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Reserva
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={onClearSelection}
                className="w-full h-9 rounded-xl text-xs border-muted/60 hover:bg-muted/30"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Limpar Seleção
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}