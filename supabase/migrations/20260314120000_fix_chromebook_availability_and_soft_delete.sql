-- ============================================================
-- Fix 1: check_booking_availability() com lógica MAX-por-usuário
-- A versão anterior usava SUM() de todos os bookings sobrepostos,
-- ignorando que o mesmo usuário reusa os mesmos Chromebooks.
-- Correto: SUM dos MAX de cada usuário no dia inteiro.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_booking_availability(
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_quantity integer,
  p_user_id uuid DEFAULT NULL,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_inventory    integer;
  v_other_committed    integer;
  v_user_current_max   integer;
BEGIN
  -- Inventário total do dia (padrão 200 se não cadastrado)
  SELECT COALESCE(total_available, 200)
  INTO v_total_inventory
  FROM public.chromebook_inventory
  WHERE date = p_booking_date;

  v_total_inventory := COALESCE(v_total_inventory, 200);

  -- Comprometimento dos OUTROS usuários:
  -- Para cada usuário (excluindo p_user_id), pegar o MAX do dia e somar.
  SELECT COALESCE(SUM(user_max), 0)
  INTO v_other_committed
  FROM (
    SELECT user_id, MAX(quantity) AS user_max
    FROM public.chromebook_bookings
    WHERE booking_date     = p_booking_date
      AND status           = 'active'
      AND (p_user_id IS NULL OR user_id != p_user_id)
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    GROUP BY user_id
  ) t;

  -- MAX atual do usuário solicitante no dia
  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(MAX(quantity), 0)
    INTO v_user_current_max
    FROM public.chromebook_bookings
    WHERE booking_date = p_booking_date
      AND status       = 'active'
      AND user_id      = p_user_id
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);
  ELSE
    v_user_current_max := 0;
  END IF;

  -- Total comprometido = outros + MAIOR(max_atual_do_user, quantidade_pedida)
  -- Se a nova quantidade for menor que o max atual, não consome inventário extra.
  RETURN (v_other_committed + GREATEST(v_user_current_max, p_quantity)) <= v_total_inventory;
END;
$$;

-- ============================================================
-- Fix 2: Adicionar status 'returned' para soft delete de devoluções
-- Substitui o DELETE físico por uma marcação auditável.
-- ============================================================
ALTER TABLE public.chromebook_bookings
  DROP CONSTRAINT IF EXISTS chromebook_bookings_status_check;

ALTER TABLE public.chromebook_bookings
  ADD CONSTRAINT chromebook_bookings_status_check
  CHECK (status IN ('active', 'cancelled', 'returned'));

-- Garantir que bookings com status 'returned' não apareçam como disponíveis
-- (a consulta de disponibilidade já filtra por status = 'active', mas
-- é bom ter explícito para futuros relatórios).
COMMENT ON COLUMN public.chromebook_bookings.status IS
  'active = reserva ativa; cancelled = cancelado pelo usuário antes do uso; returned = devolvido após uso';
