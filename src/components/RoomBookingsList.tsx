import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, FileText } from "lucide-react";
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

interface RoomBookingsListProps {
  bookings: RoomBooking[];
  onBookingDeleted: () => void;
  roomName: string;
}

export function RoomBookingsList({ bookings, onBookingDeleted, roomName }: RoomBookingsListProps) {
  const getRoomTypeLabel = (roomType: string) => {
    return roomType === 'sala_google' ? 'Sala Google' : 'Laboratório';
  };

  if (bookings.length === 0) {
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
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {getRoomTypeLabel(booking.room_type)}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(parseISO(booking.booking_date), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
              <Badge variant={booking.status === 'active' ? 'default' : 'secondary'}>
                {booking.status === 'active' ? 'Ativo' : 'Cancelado'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Turma: {booking.class_name}</span>
            </div>
            {booking.observations && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-muted-foreground">Observações:</p>
                  <p className="mt-1">{booking.observations}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
