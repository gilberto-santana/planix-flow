-- Fix Security Definer View issue
-- Drop the existing view and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.view_spreadsheet_summary;

-- Recreate the view without SECURITY DEFINER (uses SECURITY INVOKER by default)
CREATE VIEW public.view_spreadsheet_summary AS
SELECT 
    s.user_id,
    s.id as spreadsheet_id,
    s.file_name,
    s.created_at,
    COUNT(DISTINCT sh.id) as total_sheets,
    COUNT(sd.id) as total_cells
FROM public.spreadsheets s
LEFT JOIN public.sheets sh ON sh.spreadsheet_id = s.id
LEFT JOIN public.spreadsheet_data sd ON sd.sheet_id = sh.id
GROUP BY s.user_id, s.id, s.file_name, s.created_at;

-- Enable RLS on the view
ALTER VIEW public.view_spreadsheet_summary SET (security_invoker = true);

-- Create RLS policy for the view
CREATE POLICY "Users can view their own spreadsheet summary" 
ON public.view_spreadsheet_summary 
FOR SELECT 
USING (user_id = auth.uid());