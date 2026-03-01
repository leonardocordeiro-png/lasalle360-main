import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, School, FlaskConical, User, Mail, CheckCircle2, Loader2, Lightbulb, MessageSquare, X, Volume2, Monitor, Projector, Droplets, Sparkles, PresentationIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { bookingEmailQueue } from "@/lib/bookingEmailQueue";
import { useAuth } from "@/hooks/useAuth";

const AUDITORIO_RESOURCES = [
  { id: 'som', label: 'Som', icon: Volume2 },
  { id: 'computador', label: 'Computador', icon: Monitor },
  { id: 'projetor', label: 'Projetor', icon: Projector },
  { id: 'agua', label: 'Água', icon: Droplets },
  { id: 'limpeza', label: 'Limpeza do Ambiente', icon: Sparkles },
  { id: 'quadro_branco', label: 'Quadro Branco', icon: PresentationIcon },
];

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
  const { user } = useAuth();
  const [className, setClassName] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const toggleResource = (resourceId: string) => {
    setSelectedResources(prev => 
      prev.includes(resourceId) 
        ? prev.filter(r => r !== resourceId)
        : [...prev, resourceId]
    );
  };

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
      setSelectedResources([]);
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

    // Turma não é mais obrigatória
    // if (!className.trim()) {
    //   toast({
    //     title: "Erro",
    //     description: "Por favor, informe a turma",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    setIsCreating(true);

    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Para Auditório: precisa de aprovação e tem prazo de 48h
      const isAuditorio = roomType === 'auditorio';
      const approvalDeadline = isAuditorio 
        ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() 
        : null;

      // Criar múltiplas reservas
      const bookingsToCreate = selectedSlots.map(slot => ({
        user_id: user.id,
        full_name: fullName,
        room_type: roomType,
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: slot.start,
        end_time: slot.end,
        class_name: className.trim() || 'Sem turma',
        observations: observations.trim() || null,
        status: 'active',
        resources: isAuditorio ? selectedResources : [],
        approval_status: isAuditorio ? 'pending' : 'approved',
        approval_deadline: approvalDeadline,
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

      // Se for Auditório, enviar e-mail para aprovadores de forma assíncrona
      if (roomName.toLowerCase().includes('auditório') || roomName.toLowerCase().includes('auditorio')) {
        console.log('Enviando e-mail de aprovação para reserva do auditório...');
        
        // Enviar e-mail de forma assíncrona para não bloquear o fluxo
        supabase.functions.invoke('send-approval-request-email-gmail', {
          body: {
            bookings: newBookings,
            userName: user.user_metadata?.full_name || user.email || 'Usuário',
            userEmail: user.email || '',
            roomName: roomName,
            resources: selectedResources,
            observations: observations
          }
        }).then(({ data: emailResult, error: emailError }) => {
          if (emailError) {
            console.error('Erro ao enviar e-mail de aprovação:', emailError);
          } else {
            console.log('E-mail de aprovação enviado com sucesso:', emailResult);
          }
        }).catch(error => {
          console.error('Erro na chamada da função de e-mail:', error);
        });
      }

      toast({
        title: isAuditorio ? "Reserva enviada para aprovação!" : "Reserva(s) confirmada(s)!",
        description: isAuditorio 
          ? `Aguardando aprovação. Você será notificado em até 48 horas.`
          : `${roomName} reservada com sucesso para ${format(selectedDate, "dd/MM/yyyy")} ${slotsText}`,
      });

      setClassName("");
      setSelectedResources([]);
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
      setIsCreating(false);
    }
  };

  const hasSelection = selectedDate && selectedSlots.length > 0;

  const getRoomGradient = () => {
    if (roomType === 'auditorio') return 'from-blue-600 via-blue-500 to-sky-500 dark:from-blue-700 dark:via-blue-600 dark:to-sky-600';
    if (roomType === 'laboratorio') return 'from-purple-600 via-purple-500 to-violet-500 dark:from-purple-700 dark:via-purple-600 dark:to-violet-600';
    return 'from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600';
  };

  const getRoomIconBg = () => {
    if (roomType === 'auditorio') return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
    if (roomType === 'laboratorio') return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400';
    return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
  };

  return (
    <Card className="h-fit sticky top-4 border-0 shadow-xl overflow-hidden bg-card/95 backdrop-blur-sm">
      {/* Gradient Header */}
      <div className={`bg-gradient-to-br ${getRoomGradient()} p-5`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Resumo da Reserva</h3>
            <p className="text-[11px] text-white/70 font-medium">
              {hasSelection ? `${selectedSlots.length} horário(s) selecionado(s)` : 'Selecione horários na grade'}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-5">
        {hasSelection ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Room Info */}
            <div className={`relative overflow-hidden flex items-center gap-3 p-3 rounded-xl border border-border/40`}>
              <div className="absolute top-0 right-0 w-14 h-14 bg-current opacity-[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className={`relative h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getRoomIconBg()}`}>
                <RoomIcon className="h-4 w-4" />
              </div>
              <div className="relative min-w-0">
                <p className="font-semibold text-sm">{currentRoom.name}</p>
                <p className="text-[11px] text-muted-foreground">Sala selecionada</p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2.5 text-sm p-2.5 bg-muted/30 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-[13px] font-medium">{format(selectedDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>

            {/* Selected Time Slots */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Horários Selecionados ({selectedSlots.length})
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {selectedSlots.map((slot, index) => (
                  <Badge 
                    key={index} 
                    className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-md font-semibold border-0"
                  >
                    {slot.start} - {slot.end}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Professor */}
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Professor
              </Label>
              <Input value={fullName} disabled className="bg-muted/30 rounded-lg border-border/40 h-9 text-sm" />
            </div>

            {/* Turma */}
            <div className="space-y-1.5">
              <Label htmlFor="className" className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Turma *
              </Label>
              <Input
                id="className"
                placeholder="Ex: 9º Ano A"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                maxLength={100}
                className="rounded-lg border-border/40 h-9 text-sm"
              />
            </div>

            {/* Recursos do Auditório */}
            {roomType === 'auditorio' && (
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Recursos Necessários
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AUDITORIO_RESOURCES.map((resource) => {
                    const ResourceIcon = resource.icon;
                    const isActive = selectedResources.includes(resource.id);
                    return (
                      <button
                        type="button"
                        key={resource.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-150 ${
                          isActive
                            ? 'bg-primary/10 border-primary/40 shadow-sm'
                            : 'bg-muted/20 border-border/30 hover:bg-muted/40 hover:border-border/50'
                        }`}
                        onClick={() => toggleResource(resource.id)}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        }`}>
                          {isActive && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <ResourceIcon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-[11px] font-medium">{resource.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedResources.length > 0 && (
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {selectedResources.length} recurso(s) selecionado(s)
                  </p>
                )}
              </div>
            )}

            {/* Observações (se houver) */}
            {observations.trim() && (
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Observações
                </Label>
                <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 rounded-lg text-[12px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  {observations}
                </div>
              </div>
            )}

            {/* Aviso de aprovação para Auditório */}
            {roomType === 'auditorio' && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 rounded-lg">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>Atenção:</strong> Reservas do Auditório necessitam de aprovação. 
                  Você será notificado em até 48 horas.
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-2 pt-1">
              <Button
                type="submit"
                disabled={isCreating || !className.trim()}
                className={`w-full h-11 text-sm font-semibold rounded-xl bg-gradient-to-r ${getRoomGradient()} hover:opacity-90 transition-opacity shadow-lg`}
              >
                {isCreating ? (
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
                className="w-full rounded-xl border-border/50 h-9 text-sm"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Limpar Seleção
              </Button>
            </div>

            {/* Email Notice */}
            <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg">
              <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-[11px] text-muted-foreground leading-relaxed">Uma confirmação será enviada para seu email após a reserva.</span>
            </div>
          </form>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <div className="relative mx-auto mb-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </div>
            <p className="font-semibold text-sm">Nenhum horário selecionado</p>
            <p className="text-[12px] mt-1.5 text-muted-foreground/70 max-w-[200px] mx-auto leading-relaxed">
              Selecione um ou mais horários disponíveis na grade ao lado para fazer sua reserva.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}