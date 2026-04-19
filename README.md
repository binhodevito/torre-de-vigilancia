# 📚 Pilha de Leitura

Ferramenta pessoal para controle de leitura e gestão de coleção de **gibis brasileiros**.

> **Aviso importante:** Esta ferramenta é um complemento de apoio ao site [Guia dos Quadrinhos](http://www.guiadosquadrinhos.com), que é a referência definitiva de quadrinhos brasileiros. Não somos concorrentes — somos fãs! Todo crédito vai ao trabalho incrível do Guia dos Quadrinhos.

---

## O que é o Pilha de Leitura?

O **Pilha de Leitura** é um web app gratuito e pessoal para quem quer:

- Registrar quais gibis já leu, está lendo ou quer ler
- Organizar a coleção física separada da lista de leitura
- Criar listas temáticas (ex: "Turma da Mônica anos 80", "Sagas do Homem-Aranha Brasil")
- Dar notas e escrever observações pessoais sobre cada edição
- Ver estatísticas da coleção (por editora, por ano, média de notas)
- Funcionar como PWA no Android (instalar na tela inicial)

Os dados são buscados automaticamente no **Guia dos Quadrinhos** e armazenados no **Google Sheets**, que funciona como banco de dados gratuito. Cada gibi é consultado apenas uma vez e depois fica em cache para sempre — respeitando os servidores do Guia.

---

## Créditos e Filosofia

Este projeto existe graças ao trabalho monumental do **[Guia dos Quadrinhos](http://www.guiadosquadrinhos.com)**, mantido pela comunidade de fãs de quadrinhos brasileiros há décadas.

**Nosso compromisso com o Guia:**
- Cada gibi é raspado do site **apenas uma vez**
- Os dados ficam em cache permanente no Google Sheets
- Delay obrigatório de 1,5 segundos entre requisições
- Limite de 10 resultados por busca
- Link visível para o Guia em todas as telas relevantes

Se você usar o app, visite o Guia dos Quadrinhos e apoie o projeto deles!

---

## Passo a passo: Google Sheets + Apps Script

### 1. Criar a Planilha

1. Acesse [Google Sheets](https://sheets.google.com) e crie uma planilha nova
2. Renomeie-a para "Pilha de Leitura - DB"
3. Crie as seguintes abas (clique no `+` no rodapé):
   - `Colecao`
   - `Listas`
   - `ListaItens`
   - `Cache`

### 2. Configurar os cabeçalhos

**Aba `Colecao`** — linha 1:
```
id_guia | titulo | numero | editora | ano | capa_url | artistas | personagens | url_original | status | nota | data_adicao | data_leitura | notas_pessoais | fisico
```

**Aba `Listas`** — linha 1:
```
id_lista | nome | descricao | cor | icone | data_criacao
```

**Aba `ListaItens`** — linha 1:
```
id_lista | id_guia | ordem | data_adicao
```

**Aba `Cache`** — linha 1:
```
id_guia | titulo | numero | editora | ano | capa_url | artistas | personagens | url_original | data_cache
```

### 3. Instalar o Apps Script

1. Na planilha, vá em **Extensões → Apps Script**
2. Delete o código padrão e cole todo o conteúdo do arquivo `Code.gs`
3. Salve com `Ctrl+S`
4. Clique em **Implantar → Nova implantação**
5. Tipo: **App da Web**
6. Configurações:
   - Descrição: `Pilha de Leitura v1`
   - Executar como: **Eu mesmo**
   - Quem pode acessar: **Qualquer pessoa**
7. Clique em **Implantar** e autorize as permissões
8. Copie a **URL do app da web** gerada (vai parecer com `https://script.google.com/macros/s/XXXXX/exec`)

### 4. Configurar o app

Abra o arquivo `js/api.js` e substitua na linha indicada:

```javascript
const SCRIPT_URL = 'SUA_URL_AQUI';
```

---

## Passo a passo: GitHub Pages

### 1. Criar repositório

1. Acesse [github.com](https://github.com) e crie um repositório público
2. Sugestão de nome: `pilha-de-leitura`

### 2. Enviar os arquivos

```bash
git init
git add .
git commit -m "Pilha de Leitura v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/pilha-de-leitura.git
git push -u origin main
```

### 3. Ativar GitHub Pages

1. No repositório, vá em **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / pasta: `/ (root)`
4. Clique em **Save**
5. Aguarde 2-3 minutos e acesse `https://SEU_USUARIO.github.io/pilha-de-leitura`

---

## Como instalar como PWA no Android

1. Abra o app no **Chrome para Android**
2. Toque no menu (três pontos) → **Adicionar à tela inicial**
3. Confirme o nome e toque em **Adicionar**
4. O app vai aparecer na sua tela inicial como qualquer outro aplicativo
5. Funciona offline para consultar a coleção já salva

---

## Estrutura do projeto

```
/
├── index.html          ← app principal (SPA)
├── manifest.json       ← configuração PWA
├── sw.js               ← service worker (cache offline)
├── Code.gs             ← Google Apps Script (backend)
├── css/
│   └── style.css
├── js/
│   ├── app.js          ← lógica principal e roteamento
│   ├── api.js          ← comunicação com Google Sheets
│   ├── scraper.js      ← busca respeitosa no Guia dos Quadrinhos
│   └── ui.js           ← renderização de componentes
├── icons/
│   ├── icon-192.png    ← ícone PWA (você precisa criar)
│   └── icon-512.png    ← ícone PWA (você precisa criar)
└── README.md
```

---

## Como contribuir

O projeto está em beta pessoal, mas a intenção é abri-lo à comunidade gratuitamente. Se você quiser contribuir quando isso acontecer:

1. Faça um fork do repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça suas alterações e commit: `git commit -m 'Adiciona feature X'`
4. Push: `git push origin minha-feature`
5. Abra um Pull Request

**Ideias de contribuição futura:**
- Suporte a outros idiomas (PT-PT, EN)
- Integração com outros catálogos
- Temas de cores alternativos
- Exportação para formatos adicionais (CSV, Markdown)

---

## Licença

MIT — livre para uso pessoal e modificação. Compartilhe com a comunidade!

---

*Feito com ❤️ para a comunidade de fãs de quadrinhos brasileiros.*
*Em parceria e total respeito ao [Guia dos Quadrinhos](http://www.guiadosquadrinhos.com).*
