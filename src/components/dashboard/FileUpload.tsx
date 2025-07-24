
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { validateFile } from "@/utils/validateFile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const FileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { handleFileUpload, loading, fileName } = useFileProcessing();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📁 Arquivo selecionado:", file.name, file.size, "bytes");

    const { valid, error } = validateFile(file);
    if (!valid) {
      console.error("❌ Arquivo inválido:", error);
      toast({ title: "Arquivo inválido", description: error });
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileId = crypto.randomUUID();
    const filePath = `${fileId}.${fileExt}`;

    console.log("📤 Iniciando upload para:", filePath);
    setUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from("spreadsheets")
        .upload(filePath, file, {
          contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });

      if (uploadError) {
        console.error("❌ Erro no upload:", uploadError.message);
        toast({ title: "Erro ao enviar arquivo", description: uploadError.message });
        setUploading(false);
        return;
      }

      console.log("✅ Upload concluído, iniciando processamento...");

      // Start processing the uploaded file
      await handleFileUpload(file, fileId, filePath);
    } catch (error) {
      console.error("❌ Erro inesperado no upload:", error);
      toast({ 
        title: "Erro inesperado", 
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-start space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || loading}
        className="min-w-[200px]"
      >
        {uploading || loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            {uploading ? "Fazendo upload..." : loading ? "Gerando gráficos..." : "Processando..."}
          </>
        ) : (
          "Escolher arquivo"
        )}
      </Button>
      
      {(uploading || loading) && (
        <div className="text-sm text-muted-foreground mt-2">
          {uploading ? "Enviando arquivo..." : "Analisando dados e criando visualizações..."}
        </div>
      )}

      {fileName && <span className="text-sm text-muted-foreground">📄 {fileName}</span>}
    </div>
  );
};

export default FileUpload;
