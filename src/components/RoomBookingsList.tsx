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

// Função para agrupar todos os horários do mesmo usuário/sala/data com mesmas observações
function groupBookingsByDay(bookings: RoomBooking[]): GroupedBooking[] {
  if (bookings.length === 0) return [];
  
  const sorted = [...bookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date);
    if (a.room_type !== b.room_type) return a.room_type.localeCompare(b.room_type);
    return a.start_time.localeCompare(b.start_time);
  });

  // Agrupar por data, sala, usuário, turma E observações
  const groups: Record<string, RoomBooking[]> = {};
  
  for (const booking of sorted) {
    // Normalizar observações para comparação (remover espaços extras e null)
    const normalizedObservations = booking.observations?.trim().toLowerCase() || '';
    const key = `${booking.booking_date}-${booking.room_type}-${booking.full_name}-${booking.class_name}-${normalizedObservations}`;
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
    <div className="space-y-3">
      {groupedBookings.map((booking) => {
        const uniqueObservations = [...new Set(booking.observations)];
        const hasObservations = uniqueObservations.length > 0;
        
        return (
          <div 
            key={booking.ids.join('-')} 
            className={`relative overflow-hidden rounded-xl border bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-md ${
              booking.status !== 'active' ? 'opacity-60' : ''
            }`}
          >
            {/* Header com informações principais */}
            <div className="p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                {/* Informações do agendamento */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    {/* Badge da sala */}
                    <Badge className={`${getRoomTypeBadgeClass(booking.room_type)} shrink-0`}>
                      {getRoomTypeLabel(booking.room_type)}
                    </Badge>
                    
                    {/* Data */}
                    <span className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(booking.booking_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  
                  {/* Horários - Display inteligente */}
                  <div className="flex items-center gap-2 mb-2">
                    {booking.slots_count === 1 ? (
                      <span className="flex items-center gap-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                        <Clock className="h-4 w-4 text-blue-500" />
                        {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-base font-semibold text-blue-600">
                            <Clock className="h-4 w-4" />
                            {booking.slots_count} {booking.slots_count === 1 ? 'horário' : 'horários'}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            ({booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)})
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md inline-block">
                          ✓ Agendamentos consolidados
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Usuário e turma */}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{booking.full_name}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{booking.class_name}</span>
                  </div>
                </div>
                
                {/* Status */}
                <div className="shrink-0">
                  {booking.room_type === 'auditorio' && booking.approval_status && booking.approval_status !== 'approved' ? (
                    <Badge 
                      variant={booking.approval_status === 'pending' ? 'secondary' : 'destructive'} 
                      className={`flex items-center gap-1 ${
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
                    <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600 bg-green-50">
                      <CheckCircle2 className="h-3 w-3" />
                      {booking.room_type === 'auditorio' && booking.approval_status === 'approved' ? 'Aprovado' : 'Ativo'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Cancelado
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Observações - Seção destacada */}
            {hasObservations && (
              <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                      Observações:
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {uniqueObservations.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Indicador visual para múltiplos agendamentos */}
            {booking.slots_count > 1 && (
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
