@echo off
echo Configurando secrets do Supabase...

echo BREVO_API_KEY
npx supabase secrets set BREVO_API_KEY="BREVO_API_KEY_REMOVED" --project-ref bacqgdjiarwkgkwiqgpa

echo BREVO_SENDER_EMAIL
npx supabase secrets set BREVO_SENDER_EMAIL="leonardo.cordeiro@lasalle.org.br" --project-ref bacqgdjiarwkgkwiqgpa

echo BREVO_SENDER_NAME
npx supabase secrets set BREVO_SENDER_NAME="Sistema de Agendamentos La Salle" --project-ref bacqgdjiarwkgkwiqgpa

echo Deploy da Edge Function
npx supabase functions deploy send-approval-request-email-brevo --project-ref bacqgdjiarwkgkwiqgpa

echo Concluido!
pause
