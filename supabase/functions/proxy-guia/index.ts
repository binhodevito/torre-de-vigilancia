// supabase/functions/proxy-guia/index.ts
// Edge Function — proxy respeitoso para o Guia dos Quadrinhos

const ALLOWED_ORIGIN = '*';
const BASE_GUIA      = 'http://www.guiadosquadrinhos.com';

Deno.serve(async (req) => {
// CORS preflight
if (req.method === 'OPTIONS') {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

try {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response(JSON.stringify({ error: 'Parâmetro "path" obrigatório' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }

  // Só permite URLs do Guia dos Quadrinhos
  const urlAlvo = `${BASE_GUIA}${path.startsWith('/') ? path : '/' + path}`;
  if (!urlAlvo.startsWith(BASE_GUIA)) {
    return new Response(JSON.stringify({ error: 'URL não permitida' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }

  const resposta = await fetch(urlAlvo, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TorreDeVigilancia/1.0)',
      'Accept':     'text/html,application/xhtml+xml,image/*,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resposta.ok) {
    return new Response(JSON.stringify({ error: `Guia retornou ${resposta.status}` }), {
      status: resposta.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }

  // Imagens: retorna binário direto
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path.split('?')[0])) {
    const buf = await resposta.arrayBuffer();
    const ct  = resposta.headers.get('content-type') || 'image/jpeg';
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type':                ct,
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Cache-Control':               'public, max-age=86400',
      },
    });
  }

  // HTML: retorna JSON com campo contents
  const html = await resposta.text();

  return new Response(JSON.stringify({ contents: html }), {
    status: 200,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control':               'public, max-age=3600',
    },
  });

} catch (err) {
  return new Response(JSON.stringify({ error: err.message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
  });
}
});
