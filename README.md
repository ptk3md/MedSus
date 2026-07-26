# SisMed Médico — reprodução funcional em TypeScript

Reprodução independente do painel de visitante mostrado em `dashboard.php?visitante=1`, implementada em TypeScript sem framework e sem dependências de runtime.

## O que está implementado

- Painel responsivo inspirado no layout fornecido.
- Troca e criação de unidade ativa.
- Notificações e perfil local.
- Nova Receita com múltiplos medicamentos, pré-visualização, cópia, exportação JSON e impressão/PDF.
- Novo Exame com seleção de exames, indicação e prioridade.
- Novo Atestado com período, finalidade, texto e controle de consentimento para CID.
- Atendimento IA com:
  - organizador local que não inventa dados clínicos;
  - suporte opcional a endpoint HTTP próprio;
  - formatos estruturado, SOAP e resumo.
- Documentos Médicos: relatório, encaminhamento, declaração de comparecimento e resumo de alta.
- AIH, APAC e LME com formulários estruturados, pré-visualização e impressão.
- Minhas Prescrições com busca, duplicação, visualização e exclusão.
- Condutas do Plantão com busca local, filtros por área e importação de catálogo JSON.
- Persistência em `localStorage` no modo visitante.
- Interface adaptada para desktop, tablet e celular.

## Limites técnicos

Um navegador ou `wget` recebe somente HTML, CSS, JavaScript, imagens e respostas públicas de API. Código PHP, banco de dados, sessões, prompts privados, chaves e regras internas do servidor não podem ser extraídos por espelhamento.

Esta implementação reproduz os fluxos visíveis e fornece contratos para conectar seu backend. Ela não contém o banco clínico ou farmacológico original e não deve ser usada em produção sem validação técnica, jurídica, clínica e de segurança.

## Executar

Requisitos: Node.js 18 ou superior.

```bash
npm install
npm run build
python3 -m http.server 8080 --directory dist
```

Abra:

```text
http://localhost:8080/#/dashboard
```

Durante desenvolvimento:

```bash
npm run build
```

## Estrutura

```text
src/
  icons.ts       SVGs usados pela interface
  main.ts        rotas, telas, formulários e interações
  storage.ts     persistência local e dados iniciais
  types.ts       modelos TypeScript
  utils.ts       utilitários de segurança e exportação
  styles.css     layout responsivo
scripts/
  copy-static.mjs
mirror.sh        comando wget solicitado
```

## Endpoint de IA

O módulo aceita opcionalmente um endpoint configurável. A aplicação envia:

```json
{
  "text": "texto digitado pelo usuário",
  "format": "structured"
}
```

O endpoint deve responder com um objeto de seções:

```json
{
  "sections": {
    "Queixa e história": "...",
    "Exame físico": "...",
    "Avaliação": "...",
    "Conduta": "..."
  }
}
```

Também é aceito o objeto diretamente, sem a chave `sections`.

## Importação de condutas

Formato JSON esperado:

```json
[
  {
    "id": "conduta-001",
    "area": "Clínica médica",
    "title": "Título da ficha",
    "keywords": ["termo 1", "termo 2"],
    "summary": "Resumo revisado pela equipe",
    "sourceNote": "Fonte, versão e data de revisão"
  }
]
```

## Impressão e PDF

O botão **Imprimir / PDF** abre o diálogo nativo do navegador. Para gerar PDF, selecione a opção de salvar como PDF disponível no sistema operacional ou navegador.

## Segurança

- Entradas do usuário são escapadas antes de aparecerem em HTML.
- Dados do visitante permanecem no navegador.
- Nenhuma chave de API deve ser colocada no frontend.
- Autenticação, autorização, auditoria, criptografia, LGPD e armazenamento clínico devem ser implementados no backend.
