// js/config.js
export const PROD_WORKER = 'https://kpi-api.mariyazubareva-dev.workers.dev';

export const API_BASE =
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    ? 'http://127.0.0.1:8787'
    : PROD_WORKER;
