
import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 [AI-CHARTS] Função iniciada");
    console.log("📋 [AI-CHARTS] Method:", req.method);
    console.log("📋 [AI-CHARTS] URL:", req.url);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("❌ [AI-CHARTS] Chave API do Gemini não configurada")
      return new Response(JSON.stringify({ 
        error: "Chave API do Gemini não configurada",
        chartConfig: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    console.log("✅ [AI-CHARTS] Chave API encontrada");

    // Read request body with better error handling
    let requestData: any;
    try {
      const bodyText = await req.text();
      console.log("📨 [AI-CHARTS] Body raw length:", bodyText.length);
      console.log("📨 [AI-CHARTS] Body preview:", bodyText.substring(0, 200));
      
      if (!bodyText || bodyText.trim() === '') {
        console.error("❌ [AI-CHARTS] Body vazio recebido");
        
        // Generate fallback charts when no data
        const fallbackCharts = [{
          type: 'bar',
          title: 'Dados de Exemplo',
          data: [
            { label: 'Item 1', value: 10 },
            { label: 'Item 2', value: 20 },
            { label: 'Item 3', value: 15 }
          ]
        }];

        return new Response(JSON.stringify({ 
          chartConfig: fallbackCharts,
          source: 'fallback',
          message: 'Dados não recebidos, usando exemplo'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      requestData = JSON.parse(bodyText);
      console.log("✅ [AI-CHARTS] JSON parseado com sucesso");
      console.log("📊 [AI-CHARTS] Data keys:", Object.keys(requestData));
      
    } catch (parseError) {
      console.error("❌ [AI-CHARTS] Erro ao fazer parse do JSON:", parseError);
      
      // Generate fallback charts on parse error
      const fallbackCharts = [{
        type: 'bar',
        title: 'Erro na Leitura dos Dados',
        data: [
          { label: 'Erro', value: 1 }
        ]
      }];

      return new Response(JSON.stringify({ 
        chartConfig: fallbackCharts,
        source: 'fallback',
        error: 'Erro no parse do JSON'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const sheetData = requestData.data || requestData.rows || requestData;
    console.log("📊 [AI-CHARTS] Sheet data type:", typeof sheetData);
    console.log("📊 [AI-CHARTS] Sheet data is array:", Array.isArray(sheetData));
    console.log("📊 [AI-CHARTS] Sheet data length:", sheetData?.length);

    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
      console.error("❌ [AI-CHARTS] Dados inválidos:", { 
        hasData: !!sheetData, 
        isArray: Array.isArray(sheetData), 
        length: sheetData?.length 
      });

      // Generate fallback charts with sample data
      const fallbackCharts = [{
        type: 'pie',
        title: 'Distribuição de Exemplo',
        data: [
          { label: 'Categoria A', value: 30 },
          { label: 'Categoria B', value: 45 },
          { label: 'Categoria C', value: 25 }
        ]
      }];

      return new Response(JSON.stringify({ 
        chartConfig: fallbackCharts,
        source: 'fallback',
        message: 'Dados inválidos, usando exemplo'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    console.log("📊 [AI-CHARTS] Dados válidos recebidos:", {
      totalRows: sheetData.length,
      sampleRow: sheetData[0]
    });

    // Process spreadsheet data
    const columnMap = new Map<string, any[]>();
    const rowMap = new Map<number, Record<string, any>>();

    sheetData.forEach((cell: any, index: number) => {
      try {
        const col = cell.column_name || `Coluna ${cell.column_index || index}`;
        const rowIdx = cell.row_index || index;
        const val = cell.value || cell.cell_value || '';

        if (!columnMap.has(col)) columnMap.set(col, []);
        if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, {});
        
        columnMap.get(col)!.push(val);
        rowMap.get(rowIdx)![col] = val;
      } catch (cellError) {
        console.warn(`⚠️ [AI-CHARTS] Erro processando célula ${index}:`, cellError);
      }
    });

    const columns = Array.from(columnMap.keys());
    const rows = Array.from(rowMap.values()).slice(0, 50);

    console.log("📊 [AI-CHARTS] Processamento concluído:", {
      totalColumns: columns.length,
      totalRows: rows.length,
      columns: columns.slice(0, 5)
    });

    if (columns.length === 0 || rows.length === 0) {
      console.error("❌ [AI-CHARTS] Nenhuma coluna ou linha válida");
      
      const fallbackCharts = [{
        type: 'line',
        title: 'Tendência de Exemplo',
        data: [
          { label: 'Jan', value: 100 },
          { label: 'Feb', value: 120 },
          { label: 'Mar', value: 140 },
          { label: 'Apr', value: 110 }
        ]
      }];

      return new Response(JSON.stringify({ 
        chartConfig: fallbackCharts,
        source: 'fallback',
        message: 'Dados não processáveis, usando exemplo'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Create structured data for AI
    const structuredData = {
      total_columns: columns.length,
      total_rows: rows.length,
      columns: columns,
      data: rows.map(row => {
        const clean: Record<string, any> = {};
        columns.forEach(col => clean[col] = row[col] ?? '');
        return clean;
      }),
      column_summaries: columns.map(col => {
        const values = columnMap.get(col) || [];
        const nonEmptyValues = values.filter(v => v && v.toString().trim() !== '');
        const isNumeric = nonEmptyValues.some(v => !isNaN(Number(v)));
        return {
          name: col,
          type: isNumeric ? 'numeric' : 'categorical',
          sample_values: nonEmptyValues.slice(0, 3),
          unique_count: new Set(nonEmptyValues).size
        };
      })
    };

    console.log("📊 [AI-CHARTS] Dados estruturados para IA:", {
      totalColumns: structuredData.total_columns,
      totalRows: structuredData.total_rows,
      sampleColumns: structuredData.columns.slice(0, 3)
    });

    // Try to generate charts with AI
    let chartConfig: any[] = [];
    
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Analise os dados da planilha e gere 2-3 gráficos relevantes. 

DADOS:
${JSON.stringify(structuredData, null, 2)}

INSTRUÇÕES:
1. Use nomes reais das colunas, não genéricos
2. Retorne APENAS um JSON válido no formato:
[
  {
    "type": "bar",
    "title": "Título Real",
    "data": [
      {"label": "Item1", "value": 123},
      {"label": "Item2", "value": 456}
    ]
  }
]

3. Tipos permitidos: "bar", "line", "pie"
4. Use dados reais da planilha
5. Não adicione texto explicativo, apenas o JSON`;

      console.log("🤖 [AI-CHARTS] Enviando para Gemini...");

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = await response.text();

      console.log("📝 [AI-CHARTS] Resposta do Gemini:", responseText.slice(0, 300));

      // Clean and parse AI response
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^[{]*/, '')
        .replace(/[^}\]]*$/, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);
      chartConfig = Array.isArray(parsed) ? parsed : [parsed];

      // Validate chart structure
      chartConfig = chartConfig.filter(chart => 
        chart && 
        chart.type && 
        chart.title && 
        Array.isArray(chart.data) && 
        chart.data.length > 0
      );

      console.log("✅ [AI-CHARTS] Gráficos gerados pela IA:", chartConfig.length);

    } catch (aiError) {
      console.error("❌ [AI-CHARTS] Erro na IA:", aiError);
      console.log("🔄 [AI-CHARTS] Gerando gráficos de fallback...");
      
      // Generate fallback charts based on actual data
      chartConfig = generateFallbackCharts(structuredData);
    }

    if (chartConfig.length === 0) {
      console.log("🔄 [AI-CHARTS] Nenhum gráfico válido, usando fallback final...");
      chartConfig = generateFallbackCharts(structuredData);
    }

    console.log("🎯 [AI-CHARTS] Retornando gráficos:", chartConfig.length);

    return new Response(JSON.stringify({ 
      chartConfig,
      totalGenerated: chartConfig.length,
      source: 'ai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("❌ [AI-CHARTS] Erro geral:", error);
    
    // Return fallback charts even on general error
    const fallbackCharts = [{
      type: 'bar',
      title: 'Dados de Demonstração',
      data: [
        { label: 'Produto A', value: 150 },
        { label: 'Produto B', value: 220 },
        { label: 'Produto C', value: 180 }
      ]
    }];

    return new Response(JSON.stringify({ 
      chartConfig: fallbackCharts,
      source: 'fallback',
      error: error.message,
      message: 'Erro geral, usando dados de demonstração'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});

function generateFallbackCharts(structuredData: any): any[] {
  const charts: any[] = [];
  
  try {
    const numericColumns = structuredData.column_summaries?.filter((col: any) => col.type === 'numeric') || [];
    const categoricalColumns = structuredData.column_summaries?.filter((col: any) => col.type === 'categorical') || [];

    console.log("📊 [FALLBACK] Colunas disponíveis:", {
      numeric: numericColumns.length,
      categorical: categoricalColumns.length
    });

    if (numericColumns.length > 0 && categoricalColumns.length > 0) {
      const categoryCol = categoricalColumns[0].name;
      const valueCol = numericColumns[0].name;

      // Group data
      const groupedData = new Map<string, number>();
      structuredData.data?.forEach((row: any) => {
        const category = String(row[categoryCol] || 'Sem categoria');
        const value = Number(row[valueCol]) || 0;
        groupedData.set(category, (groupedData.get(category) || 0) + value);
      });

      if (groupedData.size > 0) {
        // Create bar chart
        charts.push({
          type: 'bar',
          title: `${valueCol} por ${categoryCol}`,
          data: Array.from(groupedData.entries()).map(([label, value]) => ({
            label,
            value
          }))
        });

        // Create pie chart if reasonable number of categories
        if (groupedData.size <= 8 && groupedData.size > 1) {
          charts.push({
            type: 'pie',
            title: `Distribuição de ${valueCol}`,
            data: Array.from(groupedData.entries()).map(([label, value]) => ({
              label,
              value
            }))
          });
        }
      }
    } else if (numericColumns.length > 0) {
      // Simple numeric chart
      const col = numericColumns[0];
      const values = structuredData.data
        ?.map((row: any, index: number) => ({ 
          label: `Item ${index + 1}`, 
          value: Number(row[col.name]) || 0 
        }))
        .filter((item: any) => item.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 10);

      if (values?.length > 0) {
        charts.push({
          type: 'bar',
          title: `Top 10 - ${col.name}`,
          data: values
        });
      }
    }

    // Always ensure at least one chart
    if (charts.length === 0) {
      charts.push({
        type: 'bar',
        title: 'Dados de Exemplo',
        data: [
          { label: 'Janeiro', value: 100 },
          { label: 'Fevereiro', value: 150 },
          { label: 'Março', value: 120 },
          { label: 'Abril', value: 180 }
        ]
      });
    }

    console.log("✅ [FALLBACK] Gráficos gerados:", charts.length);
    return charts;

  } catch (error) {
    console.error("❌ [FALLBACK] Erro:", error);
    
    // Ultimate fallback
    return [{
      type: 'bar',
      title: 'Dados de Demonstração',
      data: [
        { label: 'Categoria 1', value: 50 },
        { label: 'Categoria 2', value: 75 },
        { label: 'Categoria 3', value: 60 }
      ]
    }];
  }
}
