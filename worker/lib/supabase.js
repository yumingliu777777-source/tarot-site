/**
 * Supabase REST 客户端（Cloudflare Workers 版）
 * 密钥从 Worker 环境变量 env 读取（Dashboard → Settings → Variables and Secrets）
 */

export async function request(path, { method = "GET", body, prefer } = {}, env) {
  const url = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(prefer ? { Prefer: prefer } : {}),
  };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Supabase ${res.status}`;
    try { const json = await res.json(); message = json.message || json.msg || message; } catch (e) { /* 非 JSON */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const select = (path, env) => request(path, {}, env);
export const update = (path, payload, env) =>
  request(path, { method: "PATCH", body: payload, prefer: "return=representation" }, env);
export const insert = (path, payload, env) =>
  request(path, { method: "POST", body: payload, prefer: "return=representation" }, env);
export const rpc = (fn, payload, env) =>
  request(`rpc/${fn}`, { method: "POST", body: payload }, env);
