import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, School, FlaskConical, DoorOpen, Lightbulb, MessageSquare } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface RoomFilterPanelProps {
  roomType: 'sala_google' | 'laboratorio' | 'sala_criativa';
  onRoomTypeChange: (roomType: 'sala_google' | 'laboratorio' | 'sala_criativa') => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  observations: string;
  onObservationsChange: (observations: string) => void;
}

export function RoomFilterPanel({
  roomType,
  onRoomTypeChange,
  selectedDate,
  onDateChange,
  observations,
  onObservationsChange,
}: RoomFilterPanelProps) {
  const roomOptions = [
    {
      value: 'sala_google' as const,
      name: "Sala Google",
      icon: School,
      description: "Sala equipada com tecnologia Google",
    },
    {
      value: 'laboratorio' as const,
      name: "Laboratório",
      icon: FlaskConical,
      description: "Laboratório de Química e Física",
    },
    {
      value: 'sala_criativa' as const,
      name: "Sala Criativa",
      icon: Lightbulb,
      description: "Espaço para atividades criativas",
    },
  ];

  const currentRoom = roomOptions.find(r => r.value === roomType) || roomOptions[0];
  const RoomIcon = currentRoom.icon;

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  return (
    <Card className="h-fit sticky top-4">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-primary" />
          Reservar Sala
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Categoria */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Categoria
          </Label>
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DoorOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Salas e Laboratórios</p>
              <p className="text-xs text-muted-foreground">Ambientes para aulas</p>
            </div>
          </div>
        </div>

        {/* Sala Específica */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Sala Específica
          </Label>
          <Select value={roomType} onValueChange={(value) => onRoomTypeChange(value as 'sala_google' | 'laboratorio' | 'sala_criativa')}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a sala" />
            </SelectTrigger>
            <SelectContent>
              {roomOptions.map((room) => {
                const Icon = room.icon;
                return (
                  <SelectItem key={room.value} value={room.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{room.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Info da sala selecionada */}
          <div className="p-3 bg-muted/50 rounded-lg mt-2">
            <div className="flex items-center gap-2 mb-1">
              <RoomIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{currentRoom.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{currentRoom.description}</p>
          </div>
        </div>

        {/* Calendário */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Selecionar Data
          </Label>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateChange(date)}
            locale={ptBR}
            disabled={(date) => isPastDate(date)}
            className="rounded-md border w-full"
          />
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Observações / Solicitações
          </Label>
          <Textarea
            placeholder="Precisa de ajuda para configurar equipamentos? Necessita de recursos especiais? Descreva aqui..."
            value={observations}
            onChange={(e) => onObservationsChange(e.target.value)}
            rows={4}
            maxLength={500}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {observations.length}/500 caracteres
          </p>
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
            💡 Use este campo para informar se precisa de suporte técnico, recursos adicionais ou qualquer outra necessidade.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}