// Em: supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Para desenvolvimento. Em produção, use seu domínio: 'https://planix-flow.lovable.app'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}