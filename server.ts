import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit for PDF / contract image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to fetch series from Banco Central do Brasil SGS API with a timeout
async function fetchBCBSeries(seriesId: number, fallback: number): Promise<number> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados/ultimos/1?formato=json`;
    
    // Node.js global fetch supports AbortSignal.timeout
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) {
      throw new Error(`BCB SGS returned status ${res.status}`);
    }
    
    const data = await res.json() as any[];
    if (data && data.length > 0 && data[0].valor) {
      const val = parseFloat(data[0].valor);
      if (!isNaN(val)) {
        return val;
      }
    }
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.message?.includes("timeout") || err?.message?.includes("aborted");
    if (isTimeout) {
      console.log(`[BCB API] Series ${seriesId} fetch timed out. Using default rate ${fallback}%.`);
    } else {
      console.log(`[BCB API] Series ${seriesId} fetch was not available (${err?.message || "offline"}). Using default rate ${fallback}%.`);
    }
  }
  return fallback;
}

// 1. Get official updated indexer rates
app.get("/api/indexadores", async (req, res) => {
  console.log("[API] Fetching real-time indexer rates from Banco Central do Brasil...");
  
  // Official series IDs:
  // - Selic Meta: 432
  // - IPCA acumulado 12 meses: 13522
  // - TR acumulada mensal / referencial: 1751 (TR anualizada acumulada is usually around 1.2%)
  // - CDI (taxa anualizada): 4389
  
  const defaultSelic = 10.75;
  const defaultIPCA = 4.50;
  const defaultTR = 1.25;
  const defaultCDI = 10.65;

  const [selic, ipca, tr, cdi] = await Promise.all([
    fetchBCBSeries(432, defaultSelic),
    fetchBCBSeries(13522, defaultIPCA),
    fetchBCBSeries(1751, defaultTR),
    fetchBCBSeries(4389, defaultCDI),
  ]);

  res.json({
    CDI: cdi,
    SELIC: selic,
    IPCA: ipca,
    TR: tr,
    PRE: 0 // pre-fixed rate is base 0 (user defines interest rate directly)
  });
});

// 2. Extract contract metadata using Gemini AI
app.post("/api/analyze-contract", async (req, res) => {
  const { fileData, mimeType, fileName } = req.body;

  if (!fileData) {
    return res.status(400).json({ error: "Nenhum arquivo fornecido para análise." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return res.status(500).json({
      error: "Chave de API do Gemini não configurada no servidor. Por favor, configure a variável GEMINI_API_KEY no painel de Secrets."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    console.log(`[Gemini API] Analyzing contract "${fileName}" (${mimeType})...`);

    const imagePart = {
      inlineData: {
        data: fileData,
        mimeType: mimeType
      }
    };

    const promptText = `
Você é um especialista em análise de contratos de crédito rural, Cédulas de Produto Rural (CPR) e Demonstrativos de Evolução da Dívida rurais.
Analise o documento fornecido (que pode ser uma CPR, contrato ou um demonstrativo descritivo/evolução de dívidas do banco) e extraia de forma precisa todos os parâmetros principais e o cronograma detalhado de parcelas.

Se o documento contiver um demonstrativo ou tabela com colunas como "Principal", "Juros", "Correção Monetária/Monetária", "Outros (Multas/Tarifas/Seguros)", "Amortizado/Valor Pago", e a situação da parcela (ex: "A", "L", "Liquidada", "Aberta", "Em Aberto"), extraia esses valores de forma individual para cada parcela correspondente.

É fundamental que você retorne um JSON estruturado seguindo EXATAMENTE os seguintes campos:
1. "numero": Número do contrato ou da cédula (ex: C20530576-4).
2. "modalidade": Modalidade do contrato, usar uma dessas opções: "Cédula de Produto Rural (CPR)", "Cédula de Crédito Rural (CCR)", "Nota de Crédito Rural (NCR)", "Nota de Crédito à Exportação (NCE)", "Cédula de Crédito à Exportação (CCE)", ou "Outro".
3. "emitente": Nome completo do emitente / devedor (ex: JULINERE GOULART BENTOS).
3. "credor": Nome completo do credor / instituição financeira (ex: COOPERATIVA DE CREDITO POUPANCA E INVESTIMENTO VALE DO CERRADO SICREDI).
4. "dataEmissao": Data de emissão no formato ISO "YYYY-MM-DD" (ex: 2022-10-07).
5. "dataVencimento": Data de vencimento final no formato ISO "YYYY-MM-DD" (ex: 2027-10-07).
6. "valorPrincipal": Valor principal financiado ou emitido em número decimal sem moeda (ex: 2300000.00).
7. "taxaJurosAnual": Taxa de juros efetiva anual em percentual (ex: se for 3,7% a.a., retorne 3.7). Se houver apenas spread, coloque o spread fixo.
8. "indexador": Identifique o indexador principal do contrato, use uma destas strings: "CDI", "SELIC", "IPCA", "TR" ou "PRE". Se for taxa DI ou DI-Cetip, escolha "CDI". Se for prefixado, retorne "PRE".
9. "cronogramaParcelas": Uma lista contendo as parcelas identificadas no contrato, onde cada parcela tem:
   - "data": Data de vencimento da parcela no formato ISO "YYYY-MM-DD".
   - "percentualAmortizacao": O percentual de amortização do principal correspondente a essa parcela (ex: 20 para 20%). Se não houver percentual explícito mas sim valores, calcule o percentual em relação ao principal total.
   - "paga": true se a situação/status da parcela for liquidada, paga ou "L". false se for aberta, "A" ou vencida.
   - "valorAmortizadoPago": O valor total amortizado/pago correspondente a essa parcela (soma de principal, juros, correção se estiver paga).
   - "valorPrincipalManual": O valor nominal do Principal correspondente a essa parcela (ex: 460000.00).
   - "valorJurosManual": O valor de Juros correspondente a essa parcela de forma separada (ex: 83290.00).
   - "valorCorrecaoManual": O valor de Correção Monetária correspondente a essa parcela de forma separada (ex: 285410.13).
   - "valorOutrosManual": O valor correspondente a Outros/Tarifas/Seguro de forma separada (ex: 15180.30).
10. "produto": Nome do produto rural associado se houver (ex: SOJA A GRANEL).
11. "quantidade": Quantidade de sacas ou quilos se aplicável (ex: 14640.36 SACAS DE 60 KG).
12. "valorEmissao": Valor total em reais (ex: 2300000).

Certifique-se de que o JSON gerado seja válido e siga exatamente a estrutura solicitada. Não inclua comentários adicionais no JSON.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, promptText],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numero: { type: Type.STRING },
            modalidade: { type: Type.STRING, nullable: true },
            emitente: { type: Type.STRING },
            credor: { type: Type.STRING },
            dataEmissao: { type: Type.STRING, description: "Format YYYY-MM-DD" },
            dataVencimento: { type: Type.STRING, description: "Format YYYY-MM-DD" },
            valorPrincipal: { type: Type.NUMBER },
            taxaJurosAnual: { type: Type.NUMBER },
            indexador: { type: Type.STRING, description: "One of CDI, SELIC, IPCA, TR, PRE" },
            produto: { type: Type.STRING, nullable: true },
            quantidade: { type: Type.STRING, nullable: true },
            valorEmissao: { type: Type.NUMBER, nullable: true },
            cronogramaParcelas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  data: { type: Type.STRING, description: "Format YYYY-MM-DD" },
                  percentualAmortizacao: { type: Type.NUMBER, description: "Percentage of amortization, e.g. 20" },
                  paga: { type: Type.BOOLEAN, nullable: true },
                  valorAmortizadoPago: { type: Type.NUMBER, nullable: true },
                  valorPrincipalManual: { type: Type.NUMBER, nullable: true },
                  valorJurosManual: { type: Type.NUMBER, nullable: true },
                  valorCorrecaoManual: { type: Type.NUMBER, nullable: true },
                  valorOutrosManual: { type: Type.NUMBER, nullable: true }
                },
                required: ["data", "percentualAmortizacao"]
              }
            }
          },
          required: ["numero", "emitente", "credor", "dataEmissao", "dataVencimento", "valorPrincipal", "taxaJurosAnual", "indexador", "cronogramaParcelas"]
        }
      }
    });

    const resultText = response.text || "";
    const parsedData = JSON.parse(resultText);
    
    console.log("[Gemini API] Contract analysis completed successfully:", parsedData);
    res.json(parsedData);
  } catch (err: any) {
    console.error("[Gemini API] Failed to analyze contract:", err);
    res.status(500).json({ error: "Falha na análise do contrato pela inteligência artificial: " + err.message });
  }
});

app.post("/api/verify-contract", async (req, res) => {
  const { contrato } = req.body;

  if (!contrato) {
    return res.status(400).json({ error: "Dados do contrato não fornecidos." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return res.status(500).json({
      error: "Chave de API do Gemini não configurada."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    console.log(`[Gemini API] Verifying contract irregularities for "${contrato.numero}"...`);

    const promptText = `
Você é um auditor financeiro especialista em crédito rural e normas do Banco Central do Brasil (BACEN).
Analise os dados do contrato abaixo e elabore um "Laudo de Irregularidades" indicando possíveis abusos, 
taxas acima do teto estipulado pelo CMN (Conselho Monetário Nacional), cobrança indevida de multas, juros sobre juros (anatocismo) em periodicidade vedada,
ou qualquer outra irregularidade na composição das parcelas e custos do contrato.

Contrato:
${JSON.stringify(contrato, null, 2)}

Se não houver irregularidades óbvias nos dados fornecidos, indique que o contrato parece seguir os parâmetros normais, mas alerte que a análise é preliminar.
Retorne um JSON com a seguinte estrutura:
{
  "irregularidadesEncontradas": true ou false,
  "resumo": "Um resumo geral da análise de até 2 parágrafos",
  "pontosDeAtencao": ["ponto 1", "ponto 2", "ponto 3"],
  "recomendacao": "Recomendação do que o produtor rural deve fazer"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            irregularidadesEncontradas: { type: Type.BOOLEAN },
            resumo: { type: Type.STRING },
            pontosDeAtencao: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recomendacao: { type: Type.STRING }
          },
          required: ["irregularidadesEncontradas", "resumo", "pontosDeAtencao", "recomendacao"]
        }
      }
    });

    const resultText = response.text || "";
    const parsedData = JSON.parse(resultText);
    
    console.log("[Gemini API] Contract verification completed successfully.");
    res.json(parsedData);
  } catch (err: any) {
    console.error("[Gemini API] Failed to verify contract:", err);
    res.status(500).json({ error: "Falha na elaboração do laudo: " + err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, contrato, cenarios } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Mensagens não fornecidas." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return res.status(500).json({ error: "Chave de API do Gemini não configurada." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const systemPrompt = `Você é um assistente virtual especialista em crédito rural, auditoria financeira e normas do Banco Central do Brasil (BACEN).
Você está ajudando um usuário a analisar contratos rurais e encontrar divergências, abusos ou possíveis renegociações.
Os dados atuais do contrato carregados no sistema são:
${JSON.stringify(contrato, null, 2)}

Os cenários de simulação atuais são:
${JSON.stringify(cenarios, null, 2)}

O usuário pode colar dados adicionais de documentos do banco (como demonstrativo de evolução da dívida, plano de recuperação de crédito, etc.) no chat para que você cruze as informações e encontre divergências de datas, valores e taxas.

Responda sempre de forma profissional, direta e em formato Markdown. Não gere JSON, gere texto claro e compreensível para humanos. Ajude o usuário a analisar, gerar insights e eventualmente formatar o Laudo de Irregularidades com base nesses cruzamentos.`;

    const chatSession = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: systemPrompt,
      }
    });

    // We can't directly load the entire message history into chatSession if we create it this way,
    // Or we can use generateContent with the full message history.
    // generateContent approach is usually easier for passing custom message histories.
    
    // Convert generic roles to what GenAI SDK expects
    const contents = messages.map((msg: any) => {
      const parts: any[] = [];
      
      // se houver texto
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      
      // se houver anexo (antigo)
      if (msg.fileData && msg.mimeType) {
        parts.push({
          inlineData: {
            data: msg.fileData,
            mimeType: msg.mimeType
          }
        });
      }

      // se houver múltiplos anexos
      if (msg.attachments && Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att.fileData && att.mimeType) {
            parts.push({
              inlineData: {
                data: att.fileData,
                mimeType: att.mimeType
              }
            });
          }
        }
      }
      
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("[Gemini API] Failed in chat endpoint:", err);
    res.status(500).json({ error: "Falha na comunicação com o assistente: " + err.message });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite dev server in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite development middleware mounted.");
  } else {
    // Static file serving in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Production static server configured for /dist folder.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Rural Credit Renegotiation Simulator running on http://localhost:${PORT}`);
  });
}

startServer();
