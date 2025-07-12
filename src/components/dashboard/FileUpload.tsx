import React, { useRef, useState } from "react";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { validateFile } from "@/utils/validateFile";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { v4 as uuidv4 } from "uuid";

export default function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { handleFileUpload, loading, fileName } = useFileProcessing();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast({ title: "Arquivo inválido", description: validation.error || "Tipo de arquivo não suportado." });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Nenhum arquivo selecionado", description: "Selecione um arquivo para upload." });
      return;
    }

    const fileId = crypto.randomUUID();
    const filePath = `${fileId}/${selectedFile.name}`;

    const { data, error } = await uploadFileToStorage(selectedFile, filePath);

    if (error) {
      toast({ title: "Erro ao fazer upload", description: error });
      return;
    }

    await handleFileUpload(selectedFile, fileId, filePath);
  };

  const uploadFileToStorage = async (file: File, filePath: string) => {
    try {
      const response = await fetch(`/functions/v1/generate-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath }),
      });

      if (!response.ok) throw new Error("Falha ao obter URL de upload");

      const { url } = await response.json();
      const upload = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!upload.ok) throw new Error("Erro ao subir arquivo");

      return { data: true, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="upload">Selecione um arquivo</Label>
      <Input
        id="upload"
        type="file"
        accept=".xls,.xlsx"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={loading}
      />
      <Button onClick={handleUpload} disabled={loading || !selectedFile}>
        {loading ? "Processando..." : fileName ? "Reenviar" : "Fazer Upload"}
      </Button>
    </div>
  );
}
