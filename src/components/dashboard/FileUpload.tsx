
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileCheck2, AlertTriangle, File } from "lucide-react";
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
  const [dragActive, setDragActive] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = async (file: File) => {
    if (!file || !user) {
      console.error("❌ Arquivo ou usuário ausente:", { hasFile: !!file, hasUser: !!user });
      return;
    }

    console.log("📁 Processando arquivo:", {
      name: file.name,
      size: file.size,
      type: file.type,
      userId: user.id
    });

    const validation = validateFile(file);
    if (!validation.valid) {
      console.error("❌ Validação do arquivo falhou:", validation.error);
      toast({ 
        title: "Arquivo inválido", 
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    const fileId = crypto.randomUUID();
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/${fileId}.${ext}`;

    console.log("🚀 Iniciando upload:", { fileId, filePath });

    setUploadStatus('uploading');
    setUploadProgress(10);

    try {
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('spreadsheets')
        .upload(filePath, file);

      if (uploadError) {
        console.error("❌ Erro no upload do arquivo:", uploadError);
        setUploadStatus('error');
        toast({ 
          title: "Erro no upload", 
          description: uploadError.message,
          variant: "destructive"
        });
        return;
      }

      console.log("✅ Upload do arquivo concluído");
      setUploadProgress(50);

      // Trigger file processing
      setUploadProgress(100);
      setUploadStatus('success');
      setUploadedFile(file);
      
      console.log("🔄 Chamando onFileUpload...");
      onFileUpload(file, fileId, filePath);

    } catch (error) {
      console.error('❌ Erro inesperado no upload:', error);
      setUploadStatus('error');
      toast({ 
        title: "Erro no upload", 
        description: `Falha inesperada durante o upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  }, []);

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadedFile(null);
  };

  return (
    <Card className={cn("transition-all duration-200", className)}>
      <CardContent className="p-6">
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            uploadStatus === 'success' ? "border-green-500 bg-green-50" : "",
            uploadStatus === 'error' ? "border-red-500 bg-red-50" : ""
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleInputChange}
            accept=".csv,.xlsx,.xls"
            disabled={uploadStatus === 'uploading'}
          />

          <div className="space-y-4">
            {uploadStatus === 'idle' && (
              <>
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">
                    Arraste e solte sua planilha aqui
                  </h3>
                  <p className="text-muted-foreground">
                    ou clique para selecionar um arquivo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Formatos suportados: .csv, .xlsx, .xls (máx. 10MB)
                  </p>
                </div>
                <Button type="button" variant="outline">
                  <File className="w-4 h-4 mr-2" />
                  Selecionar Arquivo
                </Button>
              </>
            )}

            {uploadStatus === 'uploading' && (
              <>
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                  <Upload className="w-8 h-8 text-primary animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Processando planilha...</h3>
                  <p className="text-sm text-muted-foreground">
                    Fazendo upload e processando dados
                  </p>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              </>
            )}

            {uploadStatus === 'success' && uploadedFile && (
              <>
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <FileCheck2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-green-600">
                    Upload concluído!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {uploadedFile.name} foi processado com sucesso
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={resetUpload}
                  >
                    Enviar outro arquivo
                  </Button>
                </div>
              </>
            )}

            {uploadStatus === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-red-600">
                    Falha no processamento
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tente novamente ou escolha outro arquivo
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={resetUpload}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
