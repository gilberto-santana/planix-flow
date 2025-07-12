// src/utils/validateFile.ts

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  const maxSizeMB = 5;
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
  ];

  if (!file) {
    return { valid: false, error: "Nenhum arquivo foi selecionado." };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Tipo de arquivo não suportado. Envie um arquivo .xlsx, .xls ou .csv.",
    };
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `O arquivo excede o limite de ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}
