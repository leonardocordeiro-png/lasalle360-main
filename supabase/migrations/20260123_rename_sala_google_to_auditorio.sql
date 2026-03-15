-- Renomear sala_google para auditorio em todas as tabelas relevantes

-- Atualizar room_bookings
UPDATE room_bookings 
SET room_type = 'auditorio' 
WHERE room_type = 'sala_google';

-- Atualizar calendar_blocks (se existir)
UPDATE calendar_blocks 
SET resource_type = 'auditorio' 
WHERE resource_type = 'sala_google';

-- Atualizar user_module_permissions
UPDATE user_module_permissions 
SET module_name = 'auditorio' 
WHERE module_name = 'sala_google';
