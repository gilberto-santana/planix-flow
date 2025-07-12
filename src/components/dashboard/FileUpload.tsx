// src/components/FileUpload.tsx

import React, { useRef, useState } from "react";
import { Upload, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { validateFile } from "@/utils/validateFile";
import { generateFilePath } from "@/utils/storageUtils";
import { supabase } from "@/integrations/supabase/client";

export const FileUpload: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { handleFileUpload, loading, fileName } = useFileProcessing();
  const [uploading, setUploading] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { valid, error } = validateFile(file);
    if (!valid) {
      alert(error);
      return;
    }

    const filePath = generateFilePath(file.name);
    setUploading(true);

    const { data, error: uploadError } = await supabase.storage
      .from("spreadsheets")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    setUploading(false);

    if (uploadError || !data) {
      console.error("Erro no upload do arquivo:", uploadError);
      alert("Erro ao fazer upload do arquivo.");
      return;
    }

    await handleFileUpload(file, data.path.split("/")[0], data.path);
  };

  return (
    <Card className="p-4 flex flex-col items-center justify-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={onFileChange}
        style={{ display: "none" }}
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading || uploading}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Enviando..." : loading ? "Processando..." : "Selecionar arquivo"}
      </Button>
      {fileName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileCheck className="h-4 w-4 text-green-500" />
          {fileName}
        </div>
      )}
    </Card>
  );
};
