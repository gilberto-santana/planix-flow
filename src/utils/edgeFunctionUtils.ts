export async function invokeEdgeFunction<T>(
  functionName: string,
  payload: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `Erro ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Erro desconhecido" };
  }
}
