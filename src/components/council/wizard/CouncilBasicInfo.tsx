import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  school_year_id: z.string().min(1, "Selecione o ano letivo"),
  academic_level: z.enum(["EM", "EFII"], {
    required_error: "Selecione o nível de ensino",
  }),
  trimester: z.enum(["1", "2", "3"], {
    required_error: "Selecione o trimestre",
  }),
  grade_class: z.string().min(1, "Digite a série/turma"),
  council_date: z.date({
    required_error: "Selecione a data do conselho",
  }),
});

interface CouncilBasicInfoProps {
  data: any;
  onComplete: (data: any) => void;
}

export function CouncilBasicInfo({ data, onComplete }: CouncilBasicInfoProps) {
  const [schoolYears, setSchoolYears] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: data?.basicInfo || {
      council_date: new Date(),
    },
  });

  useEffect(() => {
    fetchSchoolYears();
  }, []);

  const fetchSchoolYears = async () => {
    const { data, error } = await supabase
      .from("school_years")
      .select("id, year")
      .order("year", { ascending: false });

    if (!error && data) {
      setSchoolYears(data);
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onComplete(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-2 sm:px-0">
        {/* Seção: Configuração Acadêmica */}
        <div className="rounded-xl border border-border/40 bg-muted/10 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <CalendarIcon className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuração Acadêmica</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="school_year_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Ano Letivo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl h-10 border-border/50 bg-background">
                        <SelectValue placeholder="Selecione o ano" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="academic_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Nível de Ensino</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl h-10 border-border/50 bg-background">
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EM">Ensino Médio (EM)</SelectItem>
                      <SelectItem value="EFII">Ensino Fundamental II (EF II)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trimester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Trimestre</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl h-10 border-border/50 bg-background">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1º Trimestre</SelectItem>
                      <SelectItem value="2">2º Trimestre</SelectItem>
                      <SelectItem value="3">3º Trimestre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seção: Turma e Data */}
        <div className="rounded-xl border border-border/40 bg-muted/10 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <CalendarIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Turma e Data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="grade_class"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Série/Turma</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 211M, 161M"
                      className="rounded-xl h-10 border-border/50 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="council_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-semibold">Data do Conselho</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "rounded-xl h-10 pl-3 text-left font-normal border-border/50 bg-background",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione a data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" className="rounded-xl h-9 px-6 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md">
            Continuar
          </Button>
        </div>
      </form>
    </Form>
  );
}