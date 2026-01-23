import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, School, FlaskConical, User, Mail, CheckCircle2, Loader2, Lightbulb, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { bookingEmailQueue } from "@/lib/bookingEmailQueue";

interface TimeSlot {
  start: string;
  end: string;
}

interface RoomBookingSummaryProps {
  roomType: 'auditorio' | 'laboratorio' | 'sala_criativa';
  roomName: string;
  selectedDate: Date | null;
  selectedSlots: TimeSlot[];
  observations: string;
  onBookingCreated: () => void;
  onClearSelection: () => void;
}

export function RoomBookingSummary({
  roomType,
  roomName,
  selectedDate,
  selectedSlots,
  observations,
  onBookingCreated,
  onClearSelection,
}: RoomBookingSummaryProps) {
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const { toast } = useToast();

  const roomInfo: Record<string, { name: string; icon: typeof School }> = {
    auditorio: {
      name: "Auditório",
      icon: School,
    },
    laboratorio: {
      name: "Laboratório",
      icon: FlaskConical,
    },
    sala_criativa: {
      name: "Sala Criativa",
      icon: Lightbulb,
    },
  };

  const currentRoom = roomInfo[roomType] || roomInfo.auditorio;
  const RoomIcon = currentRoom.icon;

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setFullName(profile.full_name);
        }
      }
    };
    fetchUserData();
  }, []);

  // Limpar campos quando seleção mudar
  useEffect(() => {
    if (selectedSlots.length === 0) {
      setClassName("");
    }
  }, [selectedSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || selectedSlots.length === 0) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma data e pelo menos um horário",
        variant: "destructive",
      });
      return;
    }

    if (!className.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe a turma",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Criar múltiplas reservas
      const bookingsToCreate = selectedSlots.map(slot => ({
        user_id: user.id,
        full_name: fullName,
        room_type: roomType,
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: slot.start,
        end_time: slot.end,
        class_name: className.trim(),
        observations: observations.trim() || null,
        status: 'active',
      }));

      const { data: newBookings, error } = await supabase
        .from('room_bookings')
        .insert(bookingsToCreate)
        .select();

      if (error) {
        console.error('Booking error:', error);
        if (error.message.includes('Room is already booked')) {
          toast({
            title: "Sala já agendada",
            description: "Um ou mais horários selecionados já estão reservados",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao criar agendamento",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      // Add bookings to email queue
      if (newBookings && newBookings.length > 0) {
        newBookings.forEach(newBooking => {
          bookingEmailQueue.addToQueue(user.id, {
            type: 'room',
            booking: {
              class_name: newBooking.class_name,
              room_name: roomName,
              room_type: newBooking.room_type,
              booking_date: newBooking.booking_date,
              start_time: newBooking.start_time,
              end_time: newBooking.end_time,
              observations: newBooking.observations,
            },
            userEmail: user.email!,
            userName: fullName,
          });
        });
      }

      const slotsText = selectedSlots.length === 1 
        ? `às ${selectedSlots[0].start}` 
        : `em ${selectedSlots.length} horários`;

      toast({
        title: "Reserva(s) confirmada(s)!",
        description: `${roomName} reservada com sucesso para ${format(selectedDate, "dd/MM/yyyy")} ${slotsText}`,
      });

      setClassName("");
      onClearSelection();
      onBookingCreated();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar o(s) agendamento(s)",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasSelection = selectedDate && selectedSlots.length > 0;

  return (
    <Card className="h-fit sticky top-4">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Resumo da Reserva</CardTitle>
      </CardHeader>
      <CardContent>
        {hasSelection ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Informações da Sala */}
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <RoomIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{currentRoom.name}</p>
                <p className="text-xs text-muted-foreground">Sala selecionada</p>
              </div>
            </div>

            {/* Data */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(selectedDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>

            {/* Horários Selecionados */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários Selecionados ({selectedSlots.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {selectedSlots.map((slot, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  >
                    {slot.start} - {slot.end}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Professor */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Professor
              </Label>
              <Input value={fullName} disabled className="bg-muted/50" />
            </div>

            {/* Turma */}
            <div className="space-y-2">
              <Label htmlFor="className" className="text-sm">
                Turma *
              </Label>
              <Input
                id="className"
                placeholder="Ex: 9º Ano A"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                maxLength={100}
              />
            </div>

            {/* Observações (se houver) */}
            {observations.trim() && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observações / Solicitações
                </Label>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  {observations}
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="space-y-2">
              <Button
                type="submit"
                disabled={loading || !className.trim()}
                className="w-full h-12 text-base font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar {selectedSlots.length > 1 ? `${selectedSlots.length} Reservas` : 'Reserva'}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClearSelection}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Seleção
              </Button>
            </div>

            {/* Aviso de Email */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Uma confirmação será enviada para seu email após a reserva.</span>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Calendar className="h-8 w-8" />
            </div>
            <p className="font-medium">Nenhum horário selecionado</p>
            <p className="text-sm mt-1">
              Selecione um ou mais horários disponíveis na grade ao lado para fazer sua reserva.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}