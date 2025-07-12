export function generateUniqueFileName(originalName: string, userId: string): { fileId: string, filePath: string } {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const fileId = `${timestamp}_${randomSuffix}`;
  
  const extension = originalName.split('.').pop() || 'xlsx';
  const filePath = `${userId}/${fileId}.${extension}`;
  
  console.log("🏷️ Arquivo único gerado:", { fileId, filePath, originalName });
  
  return { fileId, filePath };
}