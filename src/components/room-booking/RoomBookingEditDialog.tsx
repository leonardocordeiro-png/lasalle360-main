import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Users, Calendar, Clock, School, FlaskConical, Lightbulb } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RoomBooking {
  id: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  full_name: string;
  observations?: string;
  room_type: string;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
}

interface RoomBookingEditDialogProps {
  booking: RoomBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingUpdated: () => void;
}

export function RoomBookingEditDialog({
  booking,
  open,
  onOpenChange,
  onBookingUpdated,
}: RoomBookingEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [className, setClassName] = useState("");
  const [observations, setObservations] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const roomNames: Record<string, { name: string; icon: typeof School }> = {
    sala_google: { name: "Sala Google", icon: School },
    laboratorio: { name: "Laboratório", icon: FlaskConical },
    sala_criativa: { name: "Sala Criativa", icon: Lightbulb },
  };

  useEffect(() => {
    if (booking && open) {
      setClassName(booking.class_name);
      setObservations(booking.observations || "");
      setSelectedUserId(booking.user_id);
      fetchUsers();
    }
  }, [booking, open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_blocked', false)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async () => {
    if (!booking) return;

    if (!className.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe a turma",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUserId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um usuário",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar o nome do usuário selecionado
      const selectedUser = users.find(u => u.user_id === selectedUserId);
      
      const { error } = await supabase
        .from('room_bookings')
        .update({
          class_name: className.trim(),
          observations: observations.trim() || null,
          user_id: selectedUserId,
          full_name: selectedUser?.full_name || booking.full_name,
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Agendamento atualizado!",
        description: selectedUserId !== booking.user_id 
          ? `Agendamento transferido para ${selectedUser?.full_name}`
          : "As alterações foram salvas com sucesso.",
      });

      onOpenChange(false);
      onBookingUpdated();
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o agendamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  const roomInfo = roomNames[booking.room_type] || roomNames.sala_google;
  const RoomIcon = roomInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RoomIcon className="h-5 w-5 text-primary" />
            Editar Agendamento
          </DialogTitle>
          <DialogDescription>
            Edite as informações do agendamento ou transfira para outro usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações da Reserva */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <RoomIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{roomInfo.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(booking.booking_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
              </span>
            </div>
          </div>

          {/* Transferir para outro usuário */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Responsável pelo Agendamento
            </Label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando usuários...
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({user.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedUserId !== booking.user_id && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ O agendamento será transferido para este usuário.
              </p>
            )}
          </div>

          {/* Turma */}
          <div className="space-y-2">
            <Label htmlFor="className">Turma *</Label>
            <Input
              id="className"
              placeholder="Ex: 9º Ano A"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações / Solicitações</Label>
            <Textarea
              id="observations"
              placeholder="Observações adicionais..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {observations.length}/500 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}