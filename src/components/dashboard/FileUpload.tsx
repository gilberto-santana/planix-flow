import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile, sanitizeFileName } from "@/utils/fileValidation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  className?: string;
}

export function FileUpload({ onFileUpload, className }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const processFile = async (file: File) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Você precisa estar logado para fazer upload de arquivos."
      });
      return;
    }

    // Enhanced file validation
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: validation.error
      });
      setUploadStatus('error');
      return;
    }

    setUploadedFile(file);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Sanitize file name
      const sanitizedName = sanitizeFileName(file.name);
      
      // Process file via secure edge function
      const { data, error } = await supabase.functions.invoke('process-spreadsheet', {
        body: {
          fileName: sanitizedName,
          fileSize: file.size,
          fileType: file.type
        }
      });

      if (error) {
        throw error;
      }

      // Simulate progress for UX
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploadStatus('success');
            onFileUpload(file);
            return 100;
          }
          return prev + 25;
        });
      }, 300);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error.message || "Erro ao processar arquivo"
      });
    }
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadedFile(null);
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <Upload className="h-6 w-6 text-primary animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-success" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Upload className="h-12 w-12 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Enviando arquivo...';
      case 'success':
        return 'Arquivo enviado com sucesso!';
      case 'error':
        return 'Erro ao enviar arquivo';
      default:
        return 'Arraste seu arquivo aqui ou clique para selecionar';
    }
  };

  if (uploadStatus === 'success') {
    return (
      <Card className={cn("glass glow-accent", className)}>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <h3 className="text-lg font-semibold mb-2">{getStatusText()}</h3>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <File className="h-4 w-4" />
              <span>{uploadedFile?.name}</span>
              <span>({(uploadedFile?.size || 0 / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <Button 
              variant="outline" 
              onClick={resetUpload}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Enviar outro arquivo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass transition-all duration-300", {
      "glow-primary border-primary/50": isDragOver,
      "glow-secondary": uploadStatus === 'uploading'
    }, className)}>
      <CardContent
        className="p-8 cursor-pointer"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsx,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {uploadStatus === 'idle' ? 'Upload da Planilha' : getStatusText()}
          </h3>
          
          {uploadStatus === 'idle' && (
            <>
              <p className="text-muted-foreground mb-4">
                Arraste seu arquivo aqui ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Formatos aceitos: .xls, .xlsx, .csv (máx. 10MB)
              </p>
              <Button className="bg-gradient-primary hover:opacity-90 glow-primary">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo
              </Button>
            </>
          )}
          
          {uploadStatus === 'uploading' && (
            <div className="mt-4">
              <Progress value={uploadProgress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {uploadProgress}% concluído
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}