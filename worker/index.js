import { EventEmitter } from 'node:events';

let appPromise = null;

function installBindings(env) {
  if (!env) return;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') process.env[key] = value;
  }
  process.env.CLOUDFLARE_WORKER = '1';
}

async function getApp(env) {
  installBindings(env);

  if (!appPromise) {
    appPromise = import('../server/index.js').then((m) => m.default);
  }
  return appPromise;
}

function dispatch(app, request) {
  return new Promise(async (resolve) => {
    const url = new URL(request.url);

    // Read body if present
    let body = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      } else {
        try {
          body = await request.text();
        } catch {
          body = '';
        }
      }
    }

    const headers = {};
    for (const [k, v] of request.headers.entries()) {
      headers[k.toLowerCase()] = v;
    }

    const req = new EventEmitter();
    req.method = request.method;
    req.url = url.pathname + url.search;
    req.originalUrl = url.pathname + url.search;
    req.path = url.pathname;
    req.headers = headers;
    req.query = Object.fromEntries(url.searchParams.entries());
    req.params = {};
    req.body = body;
    req._body = true;
    req.get = (name) => headers[name.toLowerCase()];
    req.header = (name) => headers[name.toLowerCase()];
    req.ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
    req.protocol = url.protocol.replace(':', '');
    req.secure = url.protocol === 'https:';
    req.socket = { remoteAddress: req.ip };
    req.connection = { remoteAddress: req.ip };

    const resHeaders = new Headers();
    let statusCode = 200;
    let completed = false;

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headersSent = false;

    res.status = function (code) {
      statusCode = code;
      res.statusCode = code;
      return res;
    };

    res.setHeader = function (name, value) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          resHeaders.delete(name);
          for (const v of value) resHeaders.append(name, String(v));
        } else {
          resHeaders.set(name, String(value));
        }
      }
      return res;
    };

    res.getHeader = function (name) {
      return resHeaders.get(name);
    };

    res.removeHeader = function (name) {
      resHeaders.delete(name);
      return res;
    };

    res.set = res.setHeader;
    res.header = res.setHeader;

    res.contentType = function (type) {
      return res.setHeader('content-type', type);
    };
    res.type = res.contentType;

    function finish(payload, defaultType) {
      if (completed) return;
      completed = true;
      res.headersSent = true;
      res.emit('finish');
      if (defaultType && !resHeaders.has('content-type')) {
        resHeaders.set('content-type', defaultType);
      }
      resolve(new Response(payload, { status: statusCode, headers: resHeaders }));
    }

    res.json = function (data) {
      resHeaders.set('content-type', 'application/json');
      finish(JSON.stringify(data), 'application/json');
    };

    res.send = function (data) {
      if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
        return res.json(data);
      }
      finish(data !== undefined && data !== null ? String(data) : '', 'text/html; charset=utf-8');
    };

    res.end = function (data) {
      finish(data !== undefined && data !== null ? String(data) : null);
    };

    try {
      app(req, res, (err) => {
        if (completed) return;
        if (err) {
          console.error('API Worker Uncaught Error:', err);
          res.status(500).json({ error: err.message || 'Internal Server Error' });
        } else {
          res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
        }
      });
    } catch (syncErr) {
      if (!completed) {
        console.error('API Worker Sync Error:', syncErr);
        res.status(500).json({ error: syncErr.message || 'Internal Server Error' });
      }
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      // Populate process.env with Worker bindings (secrets and vars) before
      // dynamically importing the Express application.
      installBindings(env);

      const url = new URL(request.url);

      // Route API requests to Express handler
      if (url.pathname.startsWith('/api')) {
        const app = await getApp(env);
        return await dispatch(app, request);
      }

      // Static assets fallback (served by Cloudflare Workers Assets)
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return await env.ASSETS.fetch(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      // Never let an application exception become Cloudflare's opaque 1101
      // page. The detailed error remains in Worker logs, while callers get a
      // valid response they can act on.
      console.error('Cellar POS Worker request failed:', error);
      const isApiRequest = new URL(request.url).pathname.startsWith('/api');
      if (isApiRequest) {
        return Response.json(
          { error: 'The POS service is temporarily unavailable. Please retry shortly.' },
          { status: 503 }
        );
      }
      return new Response('Cellar POS is temporarily unavailable. Please retry shortly.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }
  }
};
