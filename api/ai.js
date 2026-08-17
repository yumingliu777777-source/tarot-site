/**
 * POST /api/ai — 店主 AI 深度解析（OpenAI 兼容）
 * 店主把 API Key 配在 Vercel 环境变量（AI_ENDPOINT / AI_MODEL / AI_KEY），
 * 用户无需自带 Key；每次调用校验登录会话 + 服务端扣 1 次账号额度。
 * 请求：{ token, prompt }  返回：{ ok, text } 或 { error }
 */
const sb = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, prompt } = req.body || {};
  if (!token || typeof prompt !== "string" || prompt.length < 10 || prompt.length > 4000) {
    res.status(400).json({ error: "参数无效" });
    return;
  }
  if (!process.env.AI_ENDPOINT || !process.env.AI_MODEL || !process.env.AI_KEY) {
    res.status(503).json({ error: "店主 AI 通道未配置（Vercel 环境变量 AI_ENDPOINT / AI_MODEL / AI_KEY）" });
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }

  // 1) 校验登录会话并查额度
  let session, account;
  try {
    const sessions = await sb.select(
      `sessions?token=eq.${encodeURIComponent(token)}&select=account_id,expires_at`
    );
    session = sessions && sessions[0];
    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: "登录已过期，请重新登录" });
      return;
    }
    const accounts = await sb.select(
      `accounts?id=eq.${encodeURIComponent(session.account_id)}&select=credits`
    );
    account = accounts && accounts[0];
    if (!account || Number(account.credits) < 1) {
      res.status(402).json({ error: "深度解析额度不足：邀请好友注册或开通会员即可获得" });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: e.message || "校验登录失败" });
    return;
  }

  // 2) 调用店主配置的 AI（OpenAI 兼容）
  let text;
  try {
    const aiRes = await fetch(
      `${process.env.AI_ENDPOINT.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          messages: [
            { role: "system", content: "你以中文提供关怀、接地气的塔罗解读，说话像朋友聊天，全程大白话，不堆砌辞藻，不声称预测绝对未来，不提供医疗、法律、投资或危机建议。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.75,
        }),
      }
    );
    if (!aiRes.ok) {
      res.status(502).json({ error: `AI 服务返回 ${aiRes.status}，请检查店主配置` });
      return;
    }
    const data = await aiRes.json();
    text = data?.choices?.[0]?.message?.content;
    if (!text) {
      res.status(502).json({ error: "AI 未返回解读内容" });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: "AI 服务暂时不可用，请稍后再试" });
    return;
  }

  // 3) 服务端扣 1 次额度（复用账号系统的安全函数）
  try {
    await sb.rpc("consume_credit_account", { p_token: token });
  } catch (e) {
    // 极端情况下扣减失败（如并发刚好用完），本次仍返回结果，避免用户白等
  }

  res.json({ ok: true, text });
};
