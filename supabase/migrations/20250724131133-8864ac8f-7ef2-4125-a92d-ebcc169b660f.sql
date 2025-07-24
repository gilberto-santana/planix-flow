-- Fix Security Definer View by creating a simple view without SECURITY DEFINER and policies
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
WHERE s.user_id = auth.uid()  -- Filter directly in the view
GROUP BY s.id, s.user_id, s.file_name, s.created_at;