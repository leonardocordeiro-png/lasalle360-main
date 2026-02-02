import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, MessageSquare } from "lucide-react";
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
}

interface RoomBookingsListProps {
  bookings: RoomBooking[];
  onBookingDeleted: () => void;
  roomName: string;
}

// Função para agrupar horários consecutivos do mesmo usuário/sala/data
function groupConsecutiveBookings(bookings: RoomBooking[]): GroupedBooking[] {
  if (bookings.length === 0) return [];
  
  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    if (a.room_type !== b.room_type) return a.room_type.localeCompare(b.room_type);
    return a.start_time.localeCompare(b.start_time);
  });

  const grouped: GroupedBooking[] = [];
  let current: GroupedBooking | null = null;

  for (const booking of sorted) {
    const canGroup = current && 
      current.booking_date === booking.booking_date &&
      current.room_type === booking.room_type &&
      current.class_name === booking.class_name &&
      current.status === booking.status &&
      current.end_time === booking.start_time;

    if (canGroup && current) {
      current.ids.push(booking.id);
      current.end_time = booking.end_time;
      current.slots_count++;
      if (booking.observations?.trim()) {
        current.observations.push(booking.observations.trim());
      }
    } else {
      if (current) grouped.push(current);
      current = {
        ids: [booking.id],
        room_type: booking.room_type,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        class_name: booking.class_name,
        observations: booking.observations?.trim() ? [booking.observations.trim()] : [],
        status: booking.status,
        full_name: booking.full_name,
        slots_count: 1
      };
    }
  }
  
  if (current) grouped.push(current);
  return grouped;
}

export function RoomBookingsList({ bookings, onBookingDeleted, roomName }: RoomBookingsListProps) {
  const getRoomTypeLabel = (roomType: string) => {
    if (roomType === 'auditorio') return 'Auditório';
    if (roomType === 'laboratorio') return 'Laboratório';
    if (roomType === 'sala_criativa') return 'Sala Criativa';
    return roomType;
  };

  const getRoomTypeBadgeClass = (type: string) => {
    if (type === 'auditorio') return 'bg-blue-600 hover:bg-blue-700 text-white';
    if (type === 'laboratorio') return 'bg-purple-600 hover:bg-purple-700 text-white';
    if (type === 'sala_criativa') return 'bg-amber-600 hover:bg-amber-700 text-white';
    return 'bg-gray-600 hover:bg-gray-700 text-white';
  };

  const groupedBookings = groupConsecutiveBookings(bookings);

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
                <span className="flex items-center gap-1 text-sm font-medium">
                  <Clock className="h-3 w-3" />
                  {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                </span>
                {booking.slots_count > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {booking.slots_count} horários
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Users className="h-3 w-3" />
                <span>Turma: {booking.class_name}</span>
              </div>
              
              {hasObservations && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-start gap-1">
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{uniqueObservations.join(' | ')}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Status */}
            <Badge variant={booking.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
              {booking.status === 'active' ? 'Ativo' : 'Cancelado'}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
