/**
 * Supabase REST 客户端（服务端专用，使用 service_role key 直连数据库）。
 * 仅供 Vercel 后端函数使用；请把 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * 配置为 Vercel 环境变量，切勿提交到仓库。
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function request(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(prefer ? { Prefer: prefer } : {}),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Supabase ${res.status}`;
    try {
      const json = await res.json();
      message = json.message || json.msg || message;
    } catch (_) { /* 非 JSON 响应 */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** 查询多行（如 orders?order_no=eq.XXX&select=...） */
const select = (path) => request(path);

/** 更新并返回受影响行 */
const update = (path, payload) =>
  request(path, { method: "PATCH", body: payload, prefer: "return=representation" });

/** 插入并返回新行 */
const insert = (path, payload) =>
  request(path, { method: "POST", body: payload, prefer: "return=representation" });

/** 调用 RPC（SECURITY DEFINER 函数） */
const rpc = (fn, payload) =>
  request(`rpc/${fn}`, { method: "POST", body: payload });

module.exports = { select, update, insert, rpc };
