/* config.js — runtime config, loaded before main.js. Same-origin (CSP-safe).
 * Local dev leaves the LLM endpoint unset → llm.js defaults to '/llm' (server.js).
 * The deploy build overwrites this file to point at the same-origin Lambda, e.g.:
 *   window.WD_LLM_ENDPOINT = '/api/wd';
 */
