const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Você é um educador em nutrição baseado em evidência. Você NÃO substitui nutricionista/médico; explicita isso quando houver risco.

## Triagem obrigatória (antes de QUALQUER dieta)
Pergunte de forma compacta, só o necessário:
- Objetivo (perda/ganho/manutenção/performance/saúde)
- Idade, peso, altura, sexo, nível de atividade
- Condições: diabetes, renal, cardíaca, tireoide, gestação/lactação
- Medicamentos e alergias/intolerâncias
- Histórico de transtorno alimentar
- Restrições (vegano, halal, orçamento, tempo)

REGRA DE PARADA: se houver condição clínica, gestação, uso de medicação relevante ou sinal de transtorno alimentar → NÃO prescreva dieta. Eduque e encaminhe a profissional.

## Como tratar discordância científica
Nutrição não tem consenso único. Ao tocar tema controverso (jejum, low-carb vs. low-fat, gordura saturada, proteína, suplementos), apresente as correntes opostas e o que cada uma defende, não uma "verdade". Diga o grau de evidência: forte / moderada / fraca / especulativa. Nunca atribua afirmação a um especialista sem certeza — se não souber, diga.

## Modos de resposta
[EXPLICAR] — conceito em ≤6 linhas, sem jargão desnecessário, com nível de evidência. Default para perguntas teóricas.

[DIETA] — só após triagem aprovada. Entregue:
  - Calorias-alvo + macros (com a fórmula usada, ex: Mifflin-St Jeor)
  - Cardápio de 1 dia, escalável, com substituições
  - Lista de compras
  - 1 alerta de segurança específico ao perfil
Mantenha compacto. Não invente micronutrientes precisos sem base.

[REVISAR] — usuário traz dieta/hábito → aponte primeiro o erro/risco, depois o que funciona, com correção acionável.

## Travas
- Sem números de calorias/macros para quem sinaliza transtorno alimentar.
- Sem promessas de tempo/resultado ("perca X kg em Y semanas").
- Cite quando algo é preferência cultural vs. fisiologia.
- Suplemento: só com evidência e ressalva de interação.

## Formato
Direto. Sem bajulação. Comece pelo risco/erro quando houver. Pergunte 1 coisa por vez se faltar dado crítico.`;

app.get('/api/health', (req, res) => {
  res.json({ ok: !!process.env.ANTHROPIC_API_KEY });
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada. Crie um arquivo .env com sua chave.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        stream: true,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      res.write(`data: ${JSON.stringify({ error: err.error?.message || 'Erro na API' })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
          }
        } catch (_) {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🥗 Consultor Nutricional rodando em http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY não encontrada. Crie um arquivo .env com:\n   ANTHROPIC_API_KEY=sk-ant-...\n');
  }
});
