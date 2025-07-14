// src/components/panel/FileUpload.tsx

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

    const { valid, error } = validateFile(file);
    if (!valid) {
      toast({ title: "Arquivo inválido", description: error });
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileId = crypto.randomUUID();
    const filePath = `${fileId}.${fileExt}`;

    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("spreadsheets")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Erro ao fazer upload:", uploadError.message);
      toast({ title: "Erro ao enviar arquivo", description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("spreadsheets").getPublicUrl(filePath);
    const fileUrl = data?.publicUrl;

    if (!fileUrl) {
      toast({ title: "Erro ao obter URL do arquivo" });
      setUploading(false);
      return;
    }

    // ✅ CORRIGIDO: antes passava filePath, agora envia fileUrl corretamente
    await handleFileUpload(file, fileId, fileUrl);
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-start space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || loading}
      >
        {uploading || loading ? "Processando..." : "Selecionar Planilha"}
      </Button>

      {fileName && <span className="text-sm text-muted-foreground">📄 {fileName}</span>}
    </div>
  );
};

export default FileUpload;
