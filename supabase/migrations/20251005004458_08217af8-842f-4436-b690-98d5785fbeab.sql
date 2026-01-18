-- Create school planning audit log table
CREATE TABLE IF NOT EXISTS public.school_planning_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  user_name text NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name text NOT NULL, -- 'class_planning', 'complementary_programs', 'school_years', etc.
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changes jsonb, -- Detailed changes field showing before/after
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_school_planning_audit_log_user_id ON public.school_planning_audit_log(user_id);
CREATE INDEX idx_school_planning_audit_log_table_name ON public.school_planning_audit_log(table_name);
CREATE INDEX idx_school_planning_audit_log_record_id ON public.school_planning_audit_log(record_id);
CREATE INDEX idx_school_planning_audit_log_created_at ON public.school_planning_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.school_planning_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and coordinators can view audit logs
CREATE POLICY "Admins and coordinators can view school planning audit logs"
  ON public.school_planning_audit_log
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'coordinator')
  );

-- Prevent direct modifications
CREATE POLICY "Prevent direct inserts to school planning audit log"
  ON public.school_planning_audit_log
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Audit logs are immutable"
  ON public.school_planning_audit_log
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Only admins can delete audit logs"
  ON public.school_planning_audit_log
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Create function to log school planning changes
CREATE OR REPLACE FUNCTION public.log_school_planning_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_email text;
  v_user_name text;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  -- Get user information
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = auth.uid();
  
  -- Build changes object for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      IF to_jsonb(OLD)->>v_key IS DISTINCT FROM to_jsonb(NEW)->>v_key THEN
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_key,
            'new', to_jsonb(NEW)->v_key
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Insert audit log (bypassing RLS with security definer)
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id,
      user_email,
      user_name,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      changes
    ) VALUES (
      auth.uid(),
      COALESCE(v_user_email, 'unknown'),
      COALESCE(v_user_name, 'Unknown User'),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD),
      NULL,
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id,
      user_email,
      user_name,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      changes
    ) VALUES (
      auth.uid(),
      COALESCE(v_user_email, 'unknown'),
      COALESCE(v_user_name, 'Unknown User'),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_changes
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.school_planning_audit_log (
      user_id,
      user_email,
      user_name,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      changes
    ) VALUES (
      auth.uid(),
      COALESCE(v_user_email, 'unknown'),
      COALESCE(v_user_name, 'Unknown User'),
      'INSERT',
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      to_jsonb(NEW),
      NULL
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers for all school planning tables
CREATE TRIGGER audit_class_planning
  AFTER INSERT OR UPDATE OR DELETE ON public.class_planning
  FOR EACH ROW EXECUTE FUNCTION public.log_school_planning_change();

CREATE TRIGGER audit_complementary_programs
  AFTER INSERT OR UPDATE OR DELETE ON public.complementary_programs
  FOR EACH ROW EXECUTE FUNCTION public.log_school_planning_change();

CREATE TRIGGER audit_school_years
  AFTER INSERT OR UPDATE OR DELETE ON public.school_years
  FOR EACH ROW EXECUTE FUNCTION public.log_school_planning_change();

CREATE TRIGGER audit_academic_levels
  AFTER INSERT OR UPDATE OR DELETE ON public.academic_levels
  FOR EACH ROW EXECUTE FUNCTION public.log_school_planning_change();

CREATE TRIGGER audit_grade_series
  AFTER INSERT OR UPDATE OR DELETE ON public.grade_series
  FOR EACH ROW EXECUTE FUNCTION public.log_school_planning_change();