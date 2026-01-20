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

  const canSubmit = selectedSlots.length > 0 && classGroupName.trim().length > 0 && quantity > 0;

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
        class_name: classGroupName.trim(),
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
    <Card className="h-fit sticky top-4">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle className="h-5 w-5 text-primary" />
          Resumo da Reserva
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedSlots.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Chrome className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Selecione os horários desejados na grade de disponibilidade</p>
          </div>
        ) : (
          <>
            {/* Recurso */}
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Chrome className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Chromebooks</p>
                <p className="text-xs text-muted-foreground">Equipamento de Aluno</p>
              </div>
            </div>

            {/* Data */}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, "EEEE", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Horários Selecionados */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Horários Selecionados</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSlots.map((slot, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {slot.start} - {slot.end}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quantidade */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Quantidade</span>
                <div className="text-right">
                  <span className="font-bold text-lg text-primary">{quantity}</span>
                  <span className="text-sm text-muted-foreground ml-1">un.</span>
                </div>
              </div>
            </div>

            {/* Turma */}
            {classGroupName && (
              <div className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Turma</p>
                  <p className="text-sm font-medium">{classGroupName}</p>
                </div>
              </div>
            )}

            {/* Solicitante */}
            {userProfile && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {userProfile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                  <p className="text-sm font-medium">{userProfile.full_name}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Validação */}
            {!classGroupName.trim() && selectedSlots.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg animate-pulse">
                <p className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  ⚠️ Informe a turma no painel de filtros (ao lado) para continuar
                </p>
              </div>
            )}

            {/* Botões */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className="w-full"
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
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Seleção
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}