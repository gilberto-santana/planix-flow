
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileCheck2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile } from "@/utils/fileValidation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (file: File, fileId: string, filePath: string) => void;
  className?: string;
}

export function FileUpload({ onFileUpload, className }: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!validateFile(file)) {
      toast({ title: "Arquivo inválido", description: "Apenas arquivos .csv ou .xlsx são permitidos." });
      return;
    }

    const fileId = crypto.randomUUID();
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/${fileId}.${ext}`;

    setUploadStatus('uploading');
    setUploadProgress(10);

    const { error } = await supabase.storage.from('spreadsheets').upload(filePath, file);

    if (error) {
      console.error(error);
      setUploadStatus('error');
      toast({ title: "Erro no upload", description: error.message });
      return;
    }

    setUploadProgress(100);
    setUploadStatus('success');
    setUploadedFile(file);
    onFileUpload(file, fileId, filePath);
  };

  const handleButtonClick = () => {
    const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  return (
    <Card className={cn("p-4", className)}>
      <CardContent className="flex flex-col items-center gap-4">
        <label className="cursor-pointer flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-primary" />
          <span className="text-sm">Clique para selecionar uma planilha (.csv, .xlsx)</span>
          <input type="file" className="hidden" onChange={handleFileChange} />
        </label>

        {uploadStatus === 'uploading' && <Progress value={uploadProgress} className="w-full" />}
        {uploadStatus === 'success' && uploadedFile && (
          <div className="flex items-center gap-2 text-green-600">
            <FileCheck2 className="w-5 h-5" />
            <span className="text-sm">{uploadedFile.name} enviado com sucesso.</span>
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">Falha no envio. Tente novamente.</span>
          </div>
        )}
        <Button type="button" onClick={handleButtonClick}>
          Selecionar Arquivo
        </Button>
      </CardContent>
    </Card>
  );
}
