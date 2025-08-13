// js/config.js

// Продовый воркер (Cloudflare Workers)
export const PROD_WORKER = 'https://kpi-api.mariyazubareva-dev.workers.dev';

// Базовый URL API: локально — dev-сервер wrangler (8787), иначе — продовый воркер
export const API_BASE =
  (typeof location !== 'undefined' &&
   (location.hostname === '127.0.0.1' || location.hostname === 'localhost'))
    ? 'http://127.0.0.1:8787'
    : PROD_WORKER;
