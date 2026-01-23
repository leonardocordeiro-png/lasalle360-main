import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User, Users as ClassIcon, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { bookingEmailQueue } from "@/lib/bookingEmailQueue";

interface QuickRoomBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  selectedTime: { start: string; end: string } | null;
  roomType: 'auditorio' | 'laboratorio';
  roomName: string;
  onBookingCreated: () => void;
}

export function QuickRoomBookingModal({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  roomType,
  roomName,
  onBookingCreated,
}: QuickRoomBookingModalProps) {
  const [className, setClassName] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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

    if (open) {
      fetchUserName();
      setClassName("");
      setObservations("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma data e horário",
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

      const bookingData = {
        user_id: user.id,
        full_name: fullName,
        room_type: roomType,
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedTime.start,
        end_time: selectedTime.end,
        class_name: className.trim(),
        observations: observations.trim() || null,
        status: 'active',
      };

      const { data: newBooking, error } = await supabase
        .from('room_bookings')
        .insert([bookingData])
        .select()
        .single();

      if (error) {
        console.error('Booking error:', error);
        if (error.message.includes('Room is already booked')) {
          toast({
            title: "Auditório já agendada",
            description: "Esta sala já está reservada para este horário",
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

      // Add booking to email queue for consolidated sending
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

      toast({
        title: "Sucesso!",
        description: `Agendamento da ${roomName} criado com sucesso`,
      });

      onBookingCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar o agendamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDate || !selectedTime) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            Agendamento Rápido - {roomName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {selectedTime.start} às {selectedTime.end}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome do Professor
            </Label>
            <Input
              id="fullName"
              value={fullName}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="className" className="flex items-center gap-2">
              <ClassIcon className="h-4 w-4" />
              Turma *
            </Label>
            <Input
              id="className"
              placeholder="Ex: 3º Ano A"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações / Solicitações
            </Label>
            <Textarea
              id="observations"
              placeholder="Descreva suas necessidades ou observações (opcional)"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {observations.length}/500 caracteres
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Criando..." : "Confirmar Agendamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}