-- Fix Security Definer View by creating a simple view without SECURITY DEFINER
DROP VIEW IF EXISTS public.view_spreadsheet_summary;

CREATE VIEW public.view_spreadsheet_summary AS
SELECT 
    s.id as spreadsheet_id,
    s.user_id,
    s.file_name,
    s.created_at,
    COUNT(DISTINCT sd.id) as total_cells,
    COUNT(DISTINCT sh.id) as total_sheets
FROM public.spreadsheets s
LEFT JOIN public.sheets sh ON s.id = sh.spreadsheet_id
LEFT JOIN public.spreadsheet_data sd ON sh.id = sd.sheet_id
GROUP BY s.id, s.user_id, s.file_name, s.created_at;

-- Enable RLS on the view
ALTER VIEW public.view_spreadsheet_summary SET (security_invoker = true);

-- Create policy for the view to ensure users only see their own data
CREATE POLICY "Users can view their own spreadsheet summary"
ON public.view_spreadsheet_summary
FOR SELECT
USING (user_id = auth.uid());