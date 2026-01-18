-- Update the handle_new_user function to correctly capture Google profile picture
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'picture', NEW.raw_user_meta_data ->> 'avatar_url')
  );
  RETURN NEW;
END;
$function$;

-- Update existing profiles with missing avatar_url from Google users
UPDATE public.profiles 
SET avatar_url = (
  SELECT COALESCE(au.raw_user_meta_data ->> 'picture', au.raw_user_meta_data ->> 'avatar_url')
  FROM auth.users au 
  WHERE au.id = profiles.user_id
)
WHERE avatar_url IS NULL 
  AND EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = profiles.user_id 
      AND au.raw_user_meta_data ->> 'picture' IS NOT NULL
  );