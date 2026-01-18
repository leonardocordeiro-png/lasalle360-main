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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ArrowRightLeft, User, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChromebookBooking {
  id: string;
  class_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  quantity: number;
  full_name: string;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface ChromebookTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: ChromebookBooking | null;
  onTransferComplete: () => void;
}

export function ChromebookTransferDialog({
  open,
  onOpenChange,
  booking,
  onTransferComplete,
}: ChromebookTransferDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser(null);
    }
  }, [open]);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('user_id', booking?.user_id || '') // Excluir o usuário atual
          .limit(5);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, booking?.user_id]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setSearchQuery(user.full_name);
    setSearchResults([]);
  };

  const handleTransfer = async () => {
    if (!booking || !selectedUser) return;

    setIsTransferring(true);
    try {
      const { error } = await supabase
        .from('chromebook_bookings')
        .update({
          user_id: selectedUser.user_id,
          full_name: selectedUser.full_name,
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Transferência realizada!",
        description: `O agendamento foi transferido para ${selectedUser.full_name}.`,
      });

      onTransferComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error transferring booking:', error);
      toast({
        title: "Erro na transferência",
        description: error.message || "Não foi possível transferir o agendamento",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir Agendamento
          </DialogTitle>
          <DialogDescription>
            Transfira este agendamento de Chromebooks para outro usuário cadastrado no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações do Agendamento */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Agendamento Atual</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <strong>Solicitante:</strong> {booking.full_name}
              </p>
              <p className="text-sm">
                <strong>Turma:</strong> {booking.class_name}
              </p>
              <p className="text-sm">
                <strong>Data:</strong> {format(parse(booking.booking_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-sm">
                <strong>Horário:</strong> {booking.start_time} - {booking.end_time}
              </p>
              <p className="text-sm">
                <strong>Quantidade:</strong> {booking.quantity} Chromebooks
              </p>
            </div>
          </div>

          {/* Busca de Usuário */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Novo Solicitante</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário por nome..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedUser && e.target.value !== selectedUser.full_name) {
                    setSelectedUser(null);
                  }
                }}
                className="pl-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {selectedUser && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>

            {/* Resultados da Busca */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                    onClick={() => handleSelectUser(user)}
                  >
                    <Avatar className="h-8 w-8 border">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                      Cadastrado
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Nenhum resultado */}
            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && !selectedUser && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum usuário encontrado
              </p>
            )}
          </div>

          {/* Usuário Selecionado */}
          {selectedUser && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <h4 className="font-medium text-sm text-emerald-700 dark:text-emerald-300 mb-2">
                Transferir para:
              </h4>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-emerald-300">
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback className="text-sm bg-emerald-100 text-emerald-700">
                    {getInitials(selectedUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isTransferring}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUser || isTransferring}
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Confirmar Transferência
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}