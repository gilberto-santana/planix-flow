
import { useState } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { ChartData } from "@/utils/chartGeneration";
import { uploadFileToStorage, verifyFileInStorage, testFileAccess } from "@/utils/fileUploadUtils";
import { callParseUploadedSheetFunction } from "@/utils/edgeFunctionUtils";
import { loadAndGenerateCharts } from "@/utils/databaseDataUtils";

export function useFileProcessing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: File, fileId: string, filePath: string) => {
    if (!user) {
      console.error("❌ Usuário não autenticado");
      toast({ 
        title: "Erro", 
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setFileName(file.name);

    try {
      // Step 1: Upload file to storage
      const uploadResult = await uploadFileToStorage(file, filePath, user.id);
      if (!uploadResult.success) {
        toast({ 
          title: "Erro no upload", 
          description: uploadResult.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Step 2: Verify file exists in storage
      const verifyResult = await verifyFileInStorage(filePath, user.id);
      if (!verifyResult.success) {
        toast({ 
          title: "Erro no upload", 
          description: verifyResult.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Step 3: Test file accessibility
      const accessResult = await testFileAccess(filePath);
      if (!accessResult.success) {
        toast({ 
          title: "Erro no upload", 
          description: accessResult.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Step 4: Call edge function to process the file
      const processResult = await callParseUploadedSheetFunction({
        filePath,
        fileId,
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      if (!processResult.success) {
        toast({ 
          title: "Erro no processamento", 
          description: processResult.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Step 5: Load data and generate charts
      const dataResult = await loadAndGenerateCharts(fileId);
      if (!dataResult.success) {
        toast({ 
          title: "Erro ao carregar dados", 
          description: dataResult.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      setCharts(dataResult.charts || []);
      setLoading(false);

      toast({
        title: "Planilha processada com sucesso!",
        description: `${dataResult.charts?.length || 0} gráficos foram gerados a partir de ${dataResult.sheetsCount || 0} aba(s).`
      });

    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      toast({ 
        title: "Erro", 
        description: `Erro ao processar planilha: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return {
    loading,
    charts,
    fileName,
    handleFileUpload,
  };
}
