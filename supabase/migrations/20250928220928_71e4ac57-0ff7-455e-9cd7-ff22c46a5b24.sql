-- Create a function to validate email domain during signup
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if the email ends with @lasalle.org.br
  IF NEW.email IS NOT NULL AND NOT NEW.email ILIKE '%@lasalle.org.br' THEN
    RAISE EXCEPTION 'Apenas emails @lasalle.org.br são permitidos no sistema';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to validate email domain
-- Note: This trigger will only work if RLS policies allow it
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate email domain
  IF NEW.email IS NOT NULL AND NOT NEW.email ILIKE '%@lasalle.org.br' THEN
    -- Log the invalid attempt
    INSERT INTO public.security_audit_log (
      action,
      user_id,
      resource_type,
      resource_id,
      additional_data
    ) VALUES (
      'invalid_email_domain_signup_attempt',
      NEW.id,
      'auth',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'attempted_domain', split_part(NEW.email, '@', 2))
    );
    
    RAISE EXCEPTION 'Apenas emails @lasalle.org.br são permitidos no sistema';
  END IF;
  
  -- Log successful domain validation
  INSERT INTO public.security_audit_log (
    action,
    user_id,
    resource_type,
    resource_id,
    additional_data
  ) VALUES (
    'valid_email_domain_signup',
    NEW.id,
    'auth',
    NEW.id,
    jsonb_build_object('email', NEW.email, 'domain', '@lasalle.org.br')
  );
  
  RETURN NEW;
END;
$$;