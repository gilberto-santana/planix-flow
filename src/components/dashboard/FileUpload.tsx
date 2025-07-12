import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { validateFile } from "@/utils/validateFile";
import { supabase } from "@/integrations/supabase/client";

export const FileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { handleFileUpload, loading } = useFileProcessing();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { valid, error } = validateFile(file);
    if (!valid) {
      toast({ title: "Arquivo inválido", description: error || "Tipo de arquivo não suportado." });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileId = crypto.randomUUID();
    const filePath = `${fileId}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("spreadsheets")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Erro no upload do arquivo:", uploadError);
        toast({ title: "Erro no upload", description: "Não foi possível enviar o arquivo." });
        setUploading(false);
        return;
      }

      await handleFileUpload(file, fileId, filePath);
    } catch (err) {
      console.error("Erro inesperado:", err);
      toast({ title: "Erro", description: "Erro inesperado durante o upload." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-start gap-4">
      <Input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        ref={fileInputRef}
        disabled={uploading || loading}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || loading}
      >
        {uploading || loading ? "Processando..." : "Enviar Planilha"}
      </Button>
    </div>
  );
};
