import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Loader2 
} from "lucide-react";
import { format, parseISO, isToday, isFuture } from "date-fns";
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

interface CurrentRoomBookingsListProps {
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
  
  for (const booking of sorted) {
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
    
    // Apenas incluir agendamentos de hoje ou futuros
    if (!isToday(bookingDateTime) && !isFuture(bookingDateTime)) {
      continue;
    }

    const existingGroup = grouped.find(g => 
      g.room_type === booking.room_type &&
      g.booking_date === booking.booking_date &&
      g.class_name === booking.class_name &&
      g.full_name === booking.full_name &&
      g.end_time === booking.start_time
    );

    if (existingGroup) {
      existingGroup.ids.push(booking.id);
      existingGroup.end_time = booking.end_time;
      existingGroup.slots_count++;
      if (booking.observations && !existingGroup.observations.includes(booking.observations)) {
        existingGroup.observations.push(booking.observations);
      }
    } else {
      grouped.push({
        ids: [booking.id],
        room_type: booking.room_type,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        class_name: booking.class_name,
        observations: booking.observations ? [booking.observations] : [],
        status: booking.status,
        full_name: booking.full_name,
        slots_count: 1,
        approval_status: booking.approval_status
      });
    }
  }

  return grouped;
}

export function CurrentRoomBookingsList({ 
  bookings, 
  onBookingDeleted, 
  roomName 
}: CurrentRoomBookingsListProps) {
  const groupedBookings = groupConsecutiveBookings(bookings);

  if (groupedBookings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {groupedBookings.map((booking) => {
        const bookingDate = parseISO(booking.booking_date);
        const isBookingToday = isToday(bookingDate);
        const isBookingFuture = isFuture(bookingDate);
        const hasObservations = booking.observations.length > 0;
        
        // Status visual baseado na data
        const getStatusVariant = () => {
          if (isBookingToday) return "default";
          if (isBookingFuture) return "secondary";
          return "outline";
        };

        const getStatusText = () => {
          if (isBookingToday) return "Hoje";
          if (isBookingFuture) return "Futuro";
          return "Passado";
        };

        return (
          <Card 
            key={booking.ids[0]} 
            className={`border-0 shadow-md transition-all hover:shadow-lg ${
              isBookingToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' : 
              isBookingFuture ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' :
              'bg-white dark:bg-slate-800'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header com data e horário */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      isBookingToday ? 'bg-blue-100 dark:bg-blue-900' :
                      isBookingFuture ? 'bg-green-100 dark:bg-green-900' :
                      'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <Calendar className={`h-4 w-4 ${
                        isBookingToday ? 'text-blue-600 dark:text-blue-400' :
                        isBookingFuture ? 'text-green-600 dark:text-green-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {format(bookingDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(bookingDate, "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant()} className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {booking.start_time} - {booking.end_time}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getStatusText()}
                      </Badge>
                      {booking.slots_count > 1 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                          {booking.slots_count} horários
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Detalhes */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Turma: {booking.class_name}
                    </span>
                    <span className="text-xs">• {booking.full_name?.split(' ')[0]}</span>
                  </div>
                  
                  {/* Observações */}
                  {hasObservations && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-start gap-1">
                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{booking.observations.join(' | ')}</span>
                      </div>
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
                    {booking.approval_status === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {booking.approval_status === 'rejected' && <XCircle className="h-3 w-3" />}
                    {booking.approval_status === 'expired' && <XCircle className="h-3 w-3" />}
                    {booking.approval_status === 'pending' ? 'Aguardando' : 
                     booking.approval_status === 'rejected' ? 'Rejeitado' : 
                     booking.approval_status === 'expired' ? 'Expirado' : booking.approval_status}
                  </Badge>
                ) : (
                  <Badge 
                    variant={booking.status === 'active' ? 'default' : 'secondary'} 
                    className={`shrink-0 flex items-center gap-1 ${
                      booking.approval_status === 'approved' && booking.room_type === 'auditorio' 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : ''
                    }`}
                  >
                    {booking.approval_status === 'approved' && booking.room_type === 'auditorio' && (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {booking.approval_status === 'approved' && booking.room_type === 'auditorio' 
                      ? 'Aprovado' 
                      : booking.status === 'active' 
                        ? 'Ativo' 
                        : 'Inativo'
                    }
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
