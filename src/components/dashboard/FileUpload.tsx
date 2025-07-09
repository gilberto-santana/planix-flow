
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, CheckCircle, AlertCircle, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile } from "@/utils/fileValidation";
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
  const { user, session, loading, initialized } = useAuth();
  const { toast } = useToast();

  console.log('🔍 FileUpload render:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading, 
    initialized
  });

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
    console.log('🔍 FileUpload: Starting file processing...', { 
      fileName: file.name, 
      fileSize: file.size,
      currentAuth: { hasUser: !!user, hasSession: !!session, loading, initialized }
    });

    // Check if auth is ready and user is authenticated
    if (!initialized || loading) {
      console.error('❌ FileUpload: Authentication not ready');
      toast({
        variant: "destructive",
        title: "Aguarde",
        description: "Aguarde a verificação de autenticação terminar."
      });
      return;
    }

    if (!user || !session) {
      console.error('❌ FileUpload: User not authenticated');
      toast({
        variant: "destructive",
        title: "Login necessário",
        description: "Você precisa estar logado para fazer upload de arquivos."
      });
      return;
    }

    // File validation
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error('❌ FileUpload: File validation failed:', validation.error);
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: validation.error
      });
      setUploadStatus('error');
      return;
    }

    console.log('✅ FileUpload: File validation passed');
    setUploadedFile(file);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Create FormData with the file
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('📤 FileUpload: Calling edge function...');
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Use supabase.functions.invoke for proper authentication
      const { data, error } = await supabase.functions.invoke('process-spreadsheet', {
        body: formData,
      });

      clearInterval(progressInterval);

      if (error) {
        console.error('❌ FileUpload: Edge function error:', error);
        throw new Error(error.message || 'Erro no processamento do arquivo');
      }

      console.log('✅ FileUpload: Edge function response:', data);
      
      // Update progress to completion
      setUploadProgress(100);
      setUploadStatus('success');
      
      toast({
        title: "Upload concluído",
        description: "Arquivo processado com sucesso!"
      });
      
      onFileUpload(file);

    } catch (error: any) {
      console.error('❌ FileUpload: Upload error:', error);
      setUploadStatus('error');
      
      // More specific error messages
      let errorMessage = "Erro ao processar arquivo";
      if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized')) {
        errorMessage = "Erro de autenticação. Tente fazer login novamente.";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "Timeout no processamento. Tente um arquivo menor.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: errorMessage
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
    if (loading || !initialized) {
      return 'Carregando autenticação...';
    }
    
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

  // Show loading state while auth is initializing
  if (loading || !initialized) {
    return (
      <Card className={cn("glass", className)}>
        <CardContent className="p-8">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Carregando</h3>
            <p className="text-muted-foreground mb-4">
              Verificando autenticação...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show authentication warning if user is not logged in
  if (!user || !session) {
    return (
      <Card className={cn("glass border-destructive/50", className)}>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Autenticação Necessária</h3>
            <p className="text-muted-foreground mb-4">
              Você precisa estar logado para fazer upload de arquivos.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Recarregar página
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

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
              <span>({((uploadedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB)</span>
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
              <div className="text-xs text-muted-foreground mb-4">
                ✅ Autenticado: {user?.email}
              </div>
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
