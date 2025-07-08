-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create spreadsheets table to store uploaded file metadata
CREATE TABLE public.spreadsheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  processing_status TEXT NOT NULL DEFAULT 'pending',
  sheet_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sheets table to store individual sheet information
CREATE TABLE public.sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id UUID NOT NULL REFERENCES public.spreadsheets(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  sheet_index INTEGER NOT NULL,
  row_count INTEGER DEFAULT 0,
  column_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create spreadsheet_data table to store processed data
CREATE TABLE public.spreadsheet_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  column_index INTEGER NOT NULL,
  column_name TEXT,
  cell_value TEXT,
  data_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create charts table to store generated chart configurations
CREATE TABLE public.charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL,
  title TEXT NOT NULL,
  chart_config JSONB NOT NULL,
  data_config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for spreadsheets
CREATE POLICY "Users can view their own spreadsheets" 
ON public.spreadsheets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own spreadsheets" 
ON public.spreadsheets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spreadsheets" 
ON public.spreadsheets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spreadsheets" 
ON public.spreadsheets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for sheets
CREATE POLICY "Users can view their own sheets" 
ON public.sheets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spreadsheets 
    WHERE spreadsheets.id = sheets.spreadsheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create sheets for their spreadsheets" 
ON public.sheets 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spreadsheets 
    WHERE spreadsheets.id = sheets.spreadsheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

-- Create RLS policies for spreadsheet_data
CREATE POLICY "Users can view their own spreadsheet data" 
ON public.spreadsheet_data 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = spreadsheet_data.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert data for their sheets" 
ON public.spreadsheet_data 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = spreadsheet_data.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

-- Create RLS policies for charts
CREATE POLICY "Users can view their own charts" 
ON public.charts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = charts.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create charts for their sheets" 
ON public.charts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = charts.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own charts" 
ON public.charts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.sheets
    JOIN public.spreadsheets ON spreadsheets.id = sheets.spreadsheet_id
    WHERE sheets.id = charts.sheet_id 
    AND spreadsheets.user_id = auth.uid()
  )
);

-- Create storage bucket for spreadsheets
INSERT INTO storage.buckets (id, name, public) VALUES ('spreadsheets', 'spreadsheets', false);

-- Create storage policies
CREATE POLICY "Users can upload their own spreadsheets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'spreadsheets' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own spreadsheets" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'spreadsheets' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own spreadsheets" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'spreadsheets' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spreadsheets_updated_at
  BEFORE UPDATE ON public.spreadsheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charts_updated_at
  BEFORE UPDATE ON public.charts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();