# Lógica de Disponibilidade de Chromebooks

## Regra de Negócio Principal

**Múltiplos agendamentos do mesmo usuário no mesmo dia deduzem apenas a maior quantidade do estoque.**

### Exemplo

Se um usuário agendar:
- 10 Chromebooks das 08:00-09:00
- 15 Chromebooks das 10:00-11:00  
- 8 Chromebooks das 14:00-15:00

**Resultado:** Apenas **15 Chromebooks** (a maior quantidade) são deduzidos do estoque total do dia, pois o usuário pode reutilizar os mesmos equipamentos nos diferentes horários.

## Implementação

### Banco de Dados

A função `check_booking_availability()` foi atualizada para:

1. Calcular o máximo de equipamentos que cada usuário reservou no dia inteiro
2. Para cada slot de tempo, identificar quais usuários têm agendamentos naquele horário
3. Somar apenas os máximos dos usuários que têm agendamentos no slot específico

### Frontend

#### ModernCalendarView

O componente `preCalculateAvailability` calcula a disponibilidade seguindo os passos:

1. **Por dia:** Obtém todos os agendamentos do dia e calcula o máximo por usuário
2. **Por slot:** Identifica quais usuários têm agendamentos no slot
3. **Soma:** Adiciona apenas os máximos dos usuários presentes no slot

#### QuickBookingModal

O componente `fetchAvailability` calcula disponibilidade para um novo agendamento:

1. Busca todos os agendamentos do dia
2. Calcula o máximo por usuário no dia inteiro
3. Identifica usuários com agendamentos no slot específico
4. Para o usuário atual:
   - Subtrai seu máximo atual do dia
   - Mostra quanto adicional está disponível
5. Para outros usuários:
   - Soma seus máximos

### Arquivos Afetados

- `supabase/migrations/` - Função `check_booking_availability()`
- `src/components/calendar/ModernCalendarView.tsx` - Cálculo de disponibilidade
- `src/components/calendar/QuickBookingModal.tsx` - Validação de agendamento
- `src/lib/availabilityUtils.ts` - Funções auxiliares de disponibilidade

## Validação

O sistema valida automaticamente:
- Quantidade disponível considerando reutilização de equipamentos
- Máximo permitido por agendamento (configurável no painel admin)
- Sobreposição de horários
- Inventário total disponível
