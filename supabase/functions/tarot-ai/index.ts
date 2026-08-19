// 星夜塔罗官方 AI 网关。部署为 Supabase Edge Function，并以 --no-verify-jwt 发布：
// 本站使用自定义 sessions 表校验账号，DeepSeek Key 仅保存在 Supabase Secrets。
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://yumingliu777777-source.github.io",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders });

async function db(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new Error("数据库服务未配置");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`数据库服务返回 ${response.status}`);
  return response.status === 204 ? null : response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { error: "Method Not Allowed" });

  const aiKey = Deno.env.get("AI_KEY");
  const aiEndpoint = Deno.env.get("AI_ENDPOINT") || "https://api.deepseek.com/v1";
  const aiModel = Deno.env.get("AI_MODEL") || "deepseek-chat";
  if (!aiKey) return reply(503, { error: "店主 AI 通道未配置" });

  let token = "", prompt = "";
  try {
    const body = await request.json();
    token = String(body?.token || "");
    prompt = String(body?.prompt || "");
  } catch { return reply(400, { error: "参数无效" }); }
  if (!token || prompt.length < 10 || prompt.length > 4000) return reply(400, { error: "参数无效" });

  try {
    const sessions = await db(`sessions?token=eq.${encodeURIComponent(token)}&select=account_id,expires_at`);
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session || new Date(session.expires_at).getTime() < Date.now()) return reply(401, { error: "登录已过期，请重新登录" });
    const accounts = await db(`accounts?id=eq.${encodeURIComponent(session.account_id)}&select=credits`);
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account || Number(account.credits) < 1) return reply(402, { error: "深度解析额度不足：邀请好友注册或开通会员即可获得" });
  } catch (error) { return reply(500, { error: error instanceof Error ? error.message : "账号校验失败" }); }

  let text = "";
  try {
    const upstream = await fetch(`${aiEndpoint.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: "你以中文提供关怀、接地气的塔罗解读，说话像朋友聊天，全程大白话，不堆砌辞藻，不声称预测绝对未来，不提供医疗、法律、投资或危机建议。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
      }),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) return reply(502, { error: `AI 服务返回 ${upstream.status}` });
    text = data?.choices?.[0]?.message?.content || "";
    if (!text) return reply(502, { error: "AI 未返回解读内容" });
  } catch { return reply(502, { error: "AI 服务暂时不可用，请稍后再试" }); }

  try { await db("rpc/consume_credit_account", { method: "POST", body: JSON.stringify({ p_token: token }) }); }
  catch { /* 生成已完成，不因账本写入失败丢弃回答 */ }
  return reply(200, { ok: true, text });
});
