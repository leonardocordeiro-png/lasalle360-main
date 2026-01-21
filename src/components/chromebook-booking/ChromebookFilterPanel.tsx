import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { Filter, Chrome, Laptop, GraduationCap } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface ChromebookFilterPanelProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  classGroupName: string;
  onClassNameChange: (className: string) => void;
  totalInventory: number;
}

export function ChromebookFilterPanel({
  selectedDate,
  onDateChange,
  quantity,
  onQuantityChange,
  classGroupName,
  onClassNameChange,
  totalInventory,
}: ChromebookFilterPanelProps) {
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

  const maxQuantity = Math.min(50, totalInventory);

  return (
    <Card className="h-fit sticky top-4 overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-primary" />
          Agendar Chromebooks
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
              <Chrome className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Chromebooks</p>
              <p className="text-xs text-muted-foreground">Equipamentos para aulas</p>
            </div>
          </div>
        </div>

        {/* Turma - Moved up for visibility */}
        <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/10 shadow-sm">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Turma *
          </Label>
          <Input
            placeholder="Ex: 9º Ano A"
            value={classGroupName}
            onChange={(e) => onClassNameChange(e.target.value)}
            maxLength={50}
            className="bg-background border-primary/20 focus-visible:ring-primary"
          />
          <p className="text-[10px] text-muted-foreground italic">
            Campo obrigatório para continuar a reserva
          </p>
        </div>

        {/* Informações do Equipamento */}
        <div className="space-y-2">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Laptop className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-foreground">Equipamento de Aluno</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Chromebook para uso pedagógico em sala.
            </p>
          </div>
        </div>

        {/* Calendário */}
        <div className="space-y-2 w-full max-w-full overflow-hidden">
          <Label className="text-sm font-medium text-muted-foreground">
            Selecionar Data
          </Label>
          <div className="w-full max-w-full overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              locale={ptBR}
              disabled={(date) => isWeekend(date) || isPastDate(date)}
              className="rounded-md border p-2 w-full max-w-full [&_table]:w-full [&_table]:table-fixed"
              classNames={{
                months: "flex flex-col w-full",
                month: "space-y-3 w-full",
                caption: "flex justify-center pt-1 relative items-center px-6",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input hover:bg-accent hover:text-accent-foreground",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse table-fixed",
                head_row: "flex w-full justify-between",
                head_cell: "text-muted-foreground rounded-md w-[14.28%] font-normal text-[0.7rem] text-center",
                row: "flex w-full mt-1 justify-between",
                cell: "w-[14.28%] text-center text-sm p-0 relative flex items-center justify-center",
                day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center text-xs",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
                day_hidden: "invisible",
              }}
            />
          </div>
        </div>

        {/* Quantidade */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            <span>Quantidade de Chromebooks</span>
            <span className="text-primary font-bold">{quantity}</span>
          </Label>
          <Slider
            value={[quantity]}
            onValueChange={(value) => onQuantityChange(value[0])}
            min={1}
            max={maxQuantity}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>{maxQuantity}</span>
          </div>
        </div>

        {/* Dica */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            💡 <strong>Dica:</strong> Selecione os horários desejados na grade ao lado e confirme sua reserva no painel de resumo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}