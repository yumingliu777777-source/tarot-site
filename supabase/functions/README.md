# 官方 AI 网关

`tarot-ai` 是给前台会员使用的 Supabase Edge Function。它校验本站账号余额、调用店主的 DeepSeek Key，并在成功后扣减一次额度。API Key 不会下发给浏览器。

部署时设置三个 Secrets：

```text
AI_KEY=<你的 DeepSeek API Key>
AI_ENDPOINT=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

发布函数时必须关闭 Supabase 的默认 JWT 校验，因为本站使用 `sessions` 表中的自定义登录令牌；函数内部仍会校验该令牌和额度：

```powershell
npx supabase login
npx supabase link --project-ref mkpwkjtuxsklptseemrf
npx supabase secrets set AI_KEY="你的 DeepSeek API Key" AI_ENDPOINT="https://api.deepseek.com/v1" AI_MODEL="deepseek-chat"
npx supabase functions deploy tarot-ai --no-verify-jwt
```
