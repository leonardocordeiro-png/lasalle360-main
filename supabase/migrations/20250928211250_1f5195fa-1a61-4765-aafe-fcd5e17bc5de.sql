-- Tornar leonardo.cordeiro@lasalle.org.br um administrador
UPDATE profiles 
SET is_admin = true 
WHERE email = 'leonardo.cordeiro@lasalle.org.br';