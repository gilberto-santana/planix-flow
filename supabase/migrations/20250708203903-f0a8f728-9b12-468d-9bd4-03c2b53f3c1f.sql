-- Add missing UPDATE and DELETE policies for sheets table
CREATE POLICY "Users can update their own sheets" 
ON public.sheets 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.spreadsheets 
    WHERE spreadsheets.id = sheets.spreadsheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own sheets" 
ON public.sheets 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.spreadsheets 
    WHERE spreadsheets.id = sheets.spreadsheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

-- Add missing UPDATE and DELETE policies for spreadsheet_data table
CREATE POLICY "Users can update their own spreadsheet data" 
ON public.spreadsheet_data 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = spreadsheet_data.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own spreadsheet data" 
ON public.spreadsheet_data 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = spreadsheet_data.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

-- Add DELETE policy for profiles table (user account deletion)
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add DELETE policy for charts table (was missing)
CREATE POLICY "Users can delete their own charts" 
ON public.charts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = charts.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);