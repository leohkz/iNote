/**
 * iNote Cloudflare Worker 代理
 * 部署到 Cloudflare Workers （免費方案）
 * 設置完成後把 Worker URL 善入 iNote 設置頁
 */
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch(e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { endpoint, payload, auth } = body;

    // Whitelist allowed endpoints
    const allowed = [
      'https://integrate.api.nvidia.com/v1/chat/completions',
      'https://api.openai.com/v1/chat/completions',
    ];
    if (!allowed.includes(endpoint)) {
      return new Response('Endpoint not allowed', { status: 403 });
    }

    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
        },
        body: JSON.stringify(payload),
      });

      const data = await upstream.text();
      return new Response(data, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
