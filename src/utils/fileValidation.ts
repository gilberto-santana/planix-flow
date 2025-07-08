export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];

export const ALLOWED_EXTENSIONS = ['.xls', '.xlsx', '.csv'];

export function validateFileType(file: File): boolean {
  const hasValidType = ALLOWED_FILE_TYPES.includes(file.type);
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  return hasValidType && hasValidExtension;
}

export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and dangerous characters
  return fileName
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .trim();
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!validateFileSize(file)) {
    return { valid: false, error: 'Arquivo excede o tamanho máximo de 10MB' };
  }
  
  if (!validateFileType(file)) {
    return { valid: false, error: 'Tipo de arquivo não permitido. Use apenas .xls, .xlsx ou .csv' };
  }
  
  return { valid: true };
}