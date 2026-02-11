import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RoomBooking {
  id: string;
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  observations: string | null;
  status: string;
  full_name: string;
  approval_status?: string;
}

interface GroupedBooking {
  ids: string[];
  room_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  observations: string[];
  status: string;
  full_name: string;
  slots_count: number;
  approval_status?: string;
}

interface RoomBookingsListProps {
  bookings: RoomBooking[];
  onBookingDeleted: () => void;
  roomName: string;
}

// Função para agrupar todos os horários do mesmo usuário/sala/data
function groupBookingsByDay(bookings: RoomBooking[]): GroupedBooking[] {
  if (bookings.length === 0) return [];
  
  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    if (a.room_type !== b.room_type) return a.room_type.localeCompare(b.room_type);
    return a.start_time.localeCompare(b.start_time);
  });

  // Agrupar por data, sala, usuário e turma
  const groups: Record<string, RoomBooking[]> = {};
  
  for (const booking of sorted) {
    const key = `${booking.booking_date}-${booking.room_type}-${booking.full_name}-${booking.class_name}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(booking);
  }

  // Converter para o formato GroupedBooking
  const grouped: GroupedBooking[] = [];
  
  for (const group of Object.values(groups)) {
    if (group.length === 0) continue;
    
    const first = group[0];
    const allObservations = group
      .map(b => b.observations?.trim())
      .filter(Boolean) as string[];
    
    grouped.push({
      ids: group.map(b => b.id),
      room_type: first.room_type,
      booking_date: first.booking_date,
      start_time: group[0].start_time,
      end_time: group[group.length - 1].end_time,
      class_name: first.class_name,
      observations: [...new Set(allObservations)],
      status: first.status,
      full_name: first.full_name,
      slots_count: group.length,
      approval_status: first.approval_status
    });
  }
  
  return grouped.sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    return a.start_time.localeCompare(b.start_time);
  });
}

export function RoomBookingsList({ bookings, onBookingDeleted, roomName }: RoomBookingsListProps) {
  const getRoomTypeLabel = (roomType: string) => {
    if (roomType === 'auditorio') return 'Auditório';
    if (roomType === 'laboratorio') return 'Laboratório';
    if (roomType === 'sala_criativa') return 'Sala Criativa';
    return roomType;
  };

  const getRoomTypeBadgeClass = (type: string) => {
    if (type === 'auditorio') return 'bg-purple-600 hover:bg-purple-700 text-white';
    if (type === 'laboratorio') return 'bg-blue-600 hover:bg-blue-700 text-white';
    if (type === 'sala_criativa') return 'bg-amber-600 hover:bg-amber-700 text-white';
    return 'bg-gray-600 hover:bg-gray-700 text-white';
  };

  const groupedBookings = groupBookingsByDay(bookings);

  if (groupedBookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Nenhum agendamento de {roomName} encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {groupedBookings.map((booking) => {
        const uniqueObservations = [...new Set(booking.observations)];
        const hasObservations = uniqueObservations.length > 0;
        
        return (
          <div 
            key={booking.ids.join('-')} 
            className={`flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900 ${
              booking.status !== 'active' ? 'opacity-60' : ''
            }`}
          >
            {/* Badge da sala */}
            <Badge className={`${getRoomTypeBadgeClass(booking.room_type)} shrink-0 mt-0.5`}>
              {getRoomTypeLabel(booking.room_type)}
            </Badge>
            
            {/* Informações principais */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(booking.booking_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                {booking.slots_count === 1 ? (
                  <span className="flex items-center gap-1 text-sm font-medium">
                    <Clock className="h-3 w-3" />
                    {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Clock className="h-3 w-3" />
                    <span className="text-blue-600">
                      {booking.slots_count} horários
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)})
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">{booking.full_name}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{booking.class_name}</span>
              </div>
              {hasObservations && (
                <div className="flex items-start gap-1 mt-2">
                  <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5" />
                  <span className="text-xs text-muted-foreground">{uniqueObservations.join(', ')}</span>
                </div>
              )}
            </div>
            
            {/* Status */}
            {booking.room_type === 'auditorio' && booking.approval_status && booking.approval_status !== 'approved' ? (
              <Badge 
                variant={booking.approval_status === 'pending' ? 'secondary' : 'destructive'} 
                className={`shrink-0 flex items-center gap-1 ${
                  booking.approval_status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300' : ''
                }`}
              >
                {booking.approval_status === 'pending' ? (
                  <>
                    <Clock className="h-3 w-3" />
                    Aguardando
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    Rejeitado
                  </>
                )}
              </Badge>
            ) : booking.status === 'active' ? (
              <Badge variant="outline" className="shrink-0 flex items-center gap-1 text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {booking.room_type === 'auditorio' && booking.approval_status === 'approved' ? 'Aprovado' : 'Ativo'}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Cancelado
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
