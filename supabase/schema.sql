-- ============================================================
-- 星夜塔罗 · 数据库全量脚本（可重复执行：create or replace / if not exists）
-- 用法：supabase.com 注册 → New project → SQL Editor → New query
--       → 把本文件全部内容粘贴进去 → Run
-- 版本记录：schema_migrations 表会记录当前已应用的版本（Table Editor 可查）
-- ============================================================

-- ---------- 版本追踪 ----------
create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  note text
);
insert into schema_migrations (version, note) values
  ('4', '账号找回(邮箱绑定/忘记密码/改密踢设备) + 占卜记录跟账号 + 额度账本 + 管理员日志'),
  ('3', '账号系统 + 店主后台 + 防刷 + 登录墙 + 微信收款 + 拉新返利')
on conflict (version) do nothing;

-- ---------- 0. 配置表 ----------
create table if not exists settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values
  ('rebate_rate', '0.30'),   -- 现金返利比例：好友订单金额的 30%
  ('discount',    '0.50')    -- 好友首单立减金额（元）
on conflict (key) do nothing;

-- ---------- 1. 会员激活码（卡密） ----------
create table if not exists vip_codes (
  code text primary key,
  plan text not null check (plan in ('single','light','plus')),
  status text not null default 'unused' check (status in ('unused','used','revoked')),
  used_by text,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_vip_codes_status  on vip_codes(status);
create index if not exists idx_vip_codes_usedby on vip_codes(used_by);

-- ---------- 2. 订单 ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  plan text not null,
  plan_name text not null,
  price numeric(10,2) not null,
  pay_method text not null check (pay_method in ('wechat','alipay')),
  referrer text,
  device_id text not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_orders_device on orders(device_id);
create index if not exists idx_orders_status on orders(status);
-- 自动化支付（易支付回调）确认到账后，由后端预先生成并写入的激活码，
-- 买家无需手动输入即可自动到账；同时用于回调幂等（防止重复发码）
alter table orders add column if not exists issued_code text;

-- ---------- 3. 推荐人 ----------
-- 推广优先：默认额度返利（每拉 1 人 +1 次深度解析，自动到账）；想拿现金可自己在推广页切换
create table if not exists referrers (
  code text primary key,
  nickname text,
  payout_type text not null default 'credit' check (payout_type in ('cash','credit')),
  payout_account text,
  device_id text,
  credits integer not null default 0,
  total_reward numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 4. 返利台账 ----------
create table if not exists rebates (
  id uuid primary key default gen_random_uuid(),
  order_no text,
  referrer text,
  kind text not null check (kind in ('cash','credit')),
  amount numeric(10,2),
  status text not null default 'pending' check (status in ('pending','paid','skipped')),
  note text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists idx_rebates_referrer on rebates(referrer);
create index if not exists idx_rebates_status   on rebates(status);

-- ---------- 5. 行级安全：匿名用户不能直接读写任何表，只能调下面的安全函数 ----------
alter table settings  enable row level security;
alter table vip_codes enable row level security;
alter table orders    enable row level security;
alter table referrers enable row level security;
alter table rebates   enable row level security;
-- （不建任何 anon 策略 = 匿名访问全部拒绝；店主在后台/仪表盘用 service key 不受影响）

-- ============================================================
-- 账号系统（真实注册/登录，深度解析额度跟账号走，跨设备可用）
-- 用户名 + 密码（bcrypt 加密存储）；注册时若带邀请码，双方各 +1 次深度解析
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,              -- 登录名（小写，字母数字下划线）
  nickname text not null,                     -- 显示昵称
  password_hash text not null,                -- bcrypt（pgcrypto crypt）
  ref_code text unique not null,              -- 该账号自己的邀请码
  referrer text,                              -- 注册时来自谁的邀请码（不可改）
  credits integer not null default 0,         -- 深度解析额度（服务端记账）
  device_id text,                             -- 注册设备（用于防刷）
  client_ip text,                             -- 注册 IP（用于防刷，取 x-forwarded-for）
  is_banned boolean not null default false,   -- 封禁标记（店主后台可封号）
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_accounts_ref on accounts(ref_code);
-- 注：idx_accounts_ip 在下方补列语句之后创建（老库需要先补列才能建索引）

create table if not exists sessions (
  token text primary key,                     -- 随机会话令牌（仅存前端 localStorage）
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_sessions_account on sessions(account_id);

alter table accounts enable row level security;
alter table sessions enable row level security;
-- （不建 anon 策略：匿名只能通过下面的安全函数注册/登录，不能直接读写表）

-- 管理员标记：把某个账号设为店主管理员（在 SQL Editor 里执行，见 SETUP.md）
alter table accounts add column if not exists is_admin boolean not null default false;
-- 老库升级：补齐防刷/封号相关列（新建库时 create table 已包含，这里保证老库也有）
alter table accounts add column if not exists client_ip text;
alter table accounts add column if not exists is_banned boolean not null default false;
create index if not exists idx_accounts_ip on accounts(client_ip);
-- 老库升级：订单绑定账号（必须等 accounts 表存在后再加外键）
alter table orders add column if not exists account_id uuid references accounts(id) on delete set null;
create index if not exists idx_orders_account on orders(account_id);

-- ============================================================
-- 内部工具（不给网站调用，仅内部函数使用）
-- ============================================================
create or replace function plan_price(p_plan text)
returns table(v_price numeric, v_name text)
language plpgsql stable set search_path = public as $$
begin
  if p_plan = 'single' then v_price := 0.99;  v_name := '深度解读';
  elsif p_plan = 'light' then v_price := 6.90; v_name := '轻会员';
  elsif p_plan = 'plus'  then v_price := 12.90; v_name := '星夜会员';
  else raise exception '未知方案';
  end if;
  return next;
end $$;

create or replace function valid_referrer(p_ref text)
returns boolean language sql immutable set search_path = public as $$
  select p_ref ~ '^[A-Z0-9]{4,8}$';
$$;

-- 统一映射：方案 → 深度解析次数（全库唯一来源，杜绝各处不一致）
create or replace function plan_credits(p_plan text)
returns int language sql immutable set search_path = public as $$
  select case p_plan when 'single' then 1 when 'light' then 10 when 'plus' then 30 else 1 end;
$$;

-- ============================================================
-- 网站调用的安全函数（SECURITY DEFINER = 以管理员身份执行，绕过 RLS）
-- ============================================================

-- ---------- 账号系统 ----------
-- 内部：按会话令牌取账号 id（不给匿名调用）
create or replace function session_account(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select account_id into v_id from sessions where token = p_token and expires_at > now();
  return v_id;
end $$;

-- 注册（带邀请码 → 双方各 +1 次深度解析，服务端记账）
-- 防刷：同一设备 24h 最多 3 个号；同一 IP 24h 最多 6 个号；不能用自己号当推荐人；
--       同一设备只能被同一邀请码计一次拉新
create or replace function register_account(p_username text, p_password text, p_nickname text, p_referrer text, p_device text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text; v_nick text; v_ref text; v_id uuid; v_token text;
  v_ref_ok boolean := false; v_credits int := 0; v_code text;
  v_headers text; v_ip text; v_ip_count int;
begin
  v_username := lower(trim(coalesce(p_username,'')));
  if v_username !~ '^[a-z0-9_]{4,20}$' then raise exception '用户名需为 4-20 位字母、数字或下划线'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception '密码至少 6 位'; end if;
  if exists (select 1 from accounts where username = v_username) then raise exception '该用户名已被注册'; end if;
  v_nick := nullif(trim(coalesce(p_nickname,'')), '');
  if v_nick is null then v_nick := v_username; end if;
  if length(v_nick) > 20 then raise exception '昵称最多 20 个字'; end if;
  v_ref := upper(trim(coalesce(p_referrer,'')));
  if v_ref <> '' and not valid_referrer(v_ref) then raise exception '邀请码格式不对'; end if;
  -- 设备维度防刷
  if length(coalesce(p_device,'')) >= 8 then
    if (select count(*) from accounts where device_id = p_device and created_at > now() - interval '24 hours') >= 3 then
      raise exception '注册太频繁，请稍后再试';
    end if;
  end if;
  -- IP 维度防刷（取 x-forwarded-for / x-real-ip；取不到就跳过，不影响正常注册）
  v_headers := coalesce(current_setting('request.headers', true), '');
  v_ip := substring(v_headers from '"x-forwarded-for"\s*:\s*"([^"]+)"');
  if v_ip is null or v_ip = '' then
    v_ip := substring(v_headers from '"x-real-ip"\s*:\s*"([^"]+)"');
  end if;
  if v_ip is not null and v_ip <> '' then
    v_ip := split_part(v_ip, ',', 1);
    select count(*) into v_ip_count from accounts
      where client_ip = v_ip and created_at > now() - interval '24 hours';
    if v_ip_count >= 6 then raise exception '注册太频繁，请稍后再试'; end if;
  end if;
  if v_ref <> '' then
    select true into v_ref_ok from accounts where ref_code = v_ref;
    v_ref_ok := coalesce(v_ref_ok, false);
    if not v_ref_ok then raise exception '邀请码不存在，请核对'; end if;
    -- 自荐防护：不能用自己设备注册的号当推荐人
    if exists (select 1 from accounts where ref_code = v_ref and device_id = p_device) then
      raise exception '不能使用自己的邀请码注册';
    end if;
    -- 同一设备只能被同一邀请码计一次拉新（防止小号互相刷）
    if exists (select 1 from accounts where referrer = v_ref and device_id = p_device) then
      raise exception '该设备已被此邀请码计过一次拉新';
    end if;
  end if;
  v_code := 'X' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
  insert into accounts (username, nickname, password_hash, ref_code, referrer, credits, device_id, client_ip)
  values (v_username, v_nick, crypt(p_password, gen_salt('bf', 10)), v_code,
          case when v_ref_ok then v_ref else null end,
          0,
          nullif(p_device,''), nullif(v_ip,''))
  returning id into v_id;
  if v_ref_ok then
    perform add_credit(v_id, 1, 'register', '新人注册奖励');
    perform add_credit((select id from accounts where ref_code = v_ref), 1, 'invite', '邀请 ' || v_username || ' 注册');
    v_credits := 1;
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into sessions (token, account_id, expires_at) values (v_token, v_id, now() + interval '30 days');
  return json_build_object('token', v_token, 'username', v_username, 'nickname', v_nick,
                           'credits', v_credits, 'ref_code', v_code);
end $$;

-- 登录（带失败次数锁定，防暴力破解）
create or replace function login_account(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text; v_user accounts%rowtype; v_token text;
begin
  v_username := lower(trim(coalesce(p_username,'')));
  select * into v_user from accounts where username = v_username;
  if v_user.id is null then raise exception '用户名或密码错误'; end if;
  if v_user.is_banned then raise exception '该账号已被封禁，请联系店主'; end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then
    raise exception '尝试次数过多，请 15 分钟后再试';
  end if;
  if v_user.password_hash is null or crypt(p_password, v_user.password_hash) <> v_user.password_hash then
    update accounts set failed_attempts = failed_attempts + 1 where id = v_user.id;
    if (select failed_attempts from accounts where id = v_user.id) >= 8 then
      update accounts set locked_until = now() + interval '15 minutes', failed_attempts = 0 where id = v_user.id;
      raise exception '尝试次数过多，账号已锁定 15 分钟';
    end if;
    raise exception '用户名或密码错误';
  end if;
  update accounts set failed_attempts = 0 where id = v_user.id;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into sessions (token, account_id, expires_at) values (v_token, v_user.id, now() + interval '30 days');
  return json_build_object('token', v_token, 'username', v_user.username, 'nickname', v_user.nickname,
                           'credits', v_user.credits, 'ref_code', v_user.ref_code);
end $$;

-- 登出
create or replace function logout_account(p_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  delete from sessions where token = p_token;
  return json_build_object('ok', true);
end $$;

-- 当前账号信息（含额度、邀请码、邀请人）
create or replace function me(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user accounts%rowtype;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  select * into v_user from accounts where id = v_id;
  return json_build_object('ok', true, 'username', v_user.username, 'nickname', v_user.nickname,
                           'credits', v_user.credits, 'ref_code', v_user.ref_code,
                           'referrer', v_user.referrer, 'created_at', v_user.created_at,
                           'is_admin', v_user.is_admin, 'email', v_user.email,
                           'email_verified', v_user.email_verified);
end $$;

-- 消耗 1 次深度解析（服务端扣减）
create or replace function consume_credit_account(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_left int;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  v_left := add_credit(v_id, -1, 'ai', 'AI 深度解读消耗');
  if v_left = -1 then return json_build_object('ok', false, 'reason', 'no_credit'); end if;
  return json_build_object('ok', true, 'credits_left', v_left);
end $$;

-- 我的推广数据：已拉新人数 + 可用深度解析
create or replace function my_referrals(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_new int; v_credits int;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  select ref_code, credits into v_code, v_credits from accounts where id = v_id;
  select count(*) into v_new from accounts where referrer = v_code;
  return json_build_object('ok', true, 'new_users', v_new, 'credits', v_credits, 'ref_code', v_code);
end $$;

-- 修改昵称
create or replace function update_profile(p_token text, p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nick text;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  v_nick := nullif(trim(coalesce(p_nickname,'')), '');
  if v_nick is null or length(v_nick) > 20 then raise exception '昵称不能为空且最多 20 字'; end if;
  update accounts set nickname = v_nick where id = v_id;
  return json_build_object('ok', true, 'nickname', v_nick);
end $$;

-- 修改密码
create or replace function change_password(p_token text, p_old text, p_new text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_hash text;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  if length(coalesce(p_new,'')) < 6 then raise exception '新密码至少 6 位'; end if;
  select password_hash into v_hash from accounts where id = v_id;
  if v_hash is null or crypt(p_old, v_hash) <> v_hash then raise exception '原密码不正确'; end if;
  update accounts set password_hash = crypt(p_new, gen_salt('bf', 10)) where id = v_id;
  delete from sessions where account_id = v_id and token <> p_token;   -- 其他设备强制退出
  return json_build_object('ok', true);
end $$;

revoke execute on function session_account(text) from public, anon, authenticated;

-- ============================================================
-- 店主后台（管理员 API）：所有函数都先校验会话是否为管理员（accounts.is_admin）
-- 启用方法：用普通账号注册后，在 SQL Editor 执行
--   update accounts set is_admin = true where username = '你的用户名';
-- ============================================================

-- 内部：管理员会话 → 返回账号 id，否则 null（不给匿名直接调用）
create or replace function admin_account(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_admin boolean;
begin
  v_id := session_account(p_token);
  if v_id is null then return null; end if;
  select is_admin into v_admin from accounts where id = v_id;
  return case when coalesce(v_admin, false) then v_id else null end;
end $$;

-- 概览统计
create or replace function admin_stats(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select json_build_object(
    'total_users',    (select count(*) from accounts),
    'users_today',    (select count(*) from accounts where created_at > now() - interval '1 day'),
    'referred_users', (select count(*) from accounts where referrer is not null),
    'paid_orders',    (select count(*) from orders where status = 'paid'),
    'pending_orders', (select count(*) from orders where status = 'pending'),
    'revenue',        (select coalesce(sum(price), 0) from orders where status = 'paid'),
    'pending_rebates',(select count(*) from rebates where status = 'pending'),
    'unused_codes',   (select count(*) from vip_codes where status = 'unused')
  ) into v;
  return v;
end $$;

-- 用户列表（不含密码）
create or replace function admin_list_accounts(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select username, nickname, ref_code, referrer, credits, is_admin, is_banned,
           device_id, client_ip, created_at,
           (select count(*) from accounts where referrer = a.ref_code) as referred
    from accounts a
    limit 300
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

-- 封禁 / 解封账号（封禁后无法登录）
create or replace function admin_set_banned(p_token text, p_username text, p_banned boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  update accounts set is_banned = p_banned where username = lower(trim(p_username));
  if not found then return json_build_object('ok', false, 'reason', 'no_user'); end if;
  if p_banned then
    delete from sessions where account_id = (select id from accounts where username = lower(trim(p_username)));
  end if;
  perform log_admin(v_id, case when p_banned then 'ban' else 'unban' end, p_username, '');
  return json_build_object('ok', true);
end $$;

-- 调整用户额度（p_delta 可为负数；每笔写入额度账本并记录管理员日志）
create or replace function admin_set_credits(p_token text, p_username text, p_delta int)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_acct uuid; v_left int;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select id into v_acct from accounts where username = lower(trim(p_username));
  if v_acct is null then return json_build_object('ok', false, 'reason', 'no_user'); end if;
  v_left := add_credit(v_acct, p_delta, 'admin', '管理员手动调整');
  if v_left = -1 then return json_build_object('ok', false, 'reason', 'insufficient'); end if;
  perform log_admin(v_id, 'set_credits', p_username, '额度 ' || p_delta || ' → 余额 ' || v_left);
  return json_build_object('ok', true, 'credits_left', v_left);
end $$;

-- 订单列表（p_status 传空 = 全部）
create or replace function admin_list_orders(p_token text, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select order_no, plan_name, price, pay_method, referrer, status, created_at, paid_at, issued_code
    from orders
    where (p_status is null or p_status = '' or status = p_status)
    limit 300
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

create or replace function admin_set_order_status(p_token text, p_order_no text, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_cur text; v_plan text; v_device text; v_code text; v_days int;
  v_acct uuid; v_plan_credits int;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  if p_status not in ('pending','paid','cancelled') then raise exception '未知状态'; end if;
  select status, plan, device_id into v_cur, v_plan, v_device from orders where order_no = p_order_no;
  if v_cur is null then return json_build_object('ok', false, 'reason', 'no_order'); end if;
  if v_cur = p_status then return json_build_object('ok', true); end if; -- 幂等
  v_plan_credits := plan_credits(v_plan);
  if p_status = 'paid' then
    if exists (select 1 from orders where order_no = p_order_no and issued_code is not null) then
      update orders set status = 'paid', paid_at = coalesce(paid_at, now()) where order_no = p_order_no;
    else
      -- 优先绑定账号发额度（购买入账本）；否则发设备卡密
      select id into v_acct from accounts where device_id = v_device order by created_at desc limit 1;
      if v_acct is not null then
        update orders set status = 'paid', paid_at = coalesce(paid_at, now()), issued_code = 'acct:' || v_acct::text
        where order_no = p_order_no;
        perform add_credit(v_acct, v_plan_credits, 'purchase', '购买会员订单 ' || p_order_no);
      else
        v_days := case when v_plan = 'single' then 7 else 30 end;
        v_code := 'X' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 11));
        update orders set status = 'paid', paid_at = coalesce(paid_at, now()), issued_code = v_code
        where order_no = p_order_no;
        insert into vip_codes (code, plan, status, used_by, activated_at, expires_at)
        values (v_code, v_plan, 'used', v_device, now(), now() + v_days * interval '1 day');
      end if;
    end if;
    perform log_admin(v_id, 'order_paid', p_order_no, '标记已支付');
  elsif p_status = 'cancelled' and v_cur = 'paid' then
    -- 退款：撤销账号额度（记 refund）或撤销卡密
    select issued_code into v_code from orders where order_no = p_order_no;
    if v_code is not null and v_code like 'acct:%' then
      perform add_credit(substr(v_code, 6)::uuid, -v_plan_credits, 'refund', '退款订单 ' || p_order_no);
      update orders set issued_code = null where order_no = p_order_no;
    elsif v_code is not null then
      update vip_codes set status = 'revoked' where code = v_code;
      update orders set issued_code = null where order_no = p_order_no;
    end if;
    update orders set status = 'cancelled' where order_no = p_order_no;
    perform log_admin(v_id, 'order_cancelled', p_order_no, '退款/取消');
  else
    update orders set status = p_status where order_no = p_order_no;
    perform log_admin(v_id, 'order_cancelled', p_order_no, '状态改 ' || p_status);
  end if;
  return json_build_object('ok', true);
end $$;

-- 旧订单补发：把订单绑定到指定账号；若订单已支付且未发过权益，则按方案补发额度（幂等）
create or replace function admin_set_order_account(p_token text, p_order_no text, p_username text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cur text; v_plan text; v_icode text; v_acct uuid; v_plan_credits int;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select status, plan, issued_code into v_cur, v_plan, v_icode from orders where order_no = p_order_no;
  if v_cur is null then return json_build_object('ok', false, 'reason', 'no_order'); end if;
  select id into v_acct from accounts where username = lower(trim(p_username));
  if v_acct is null then return json_build_object('ok', false, 'reason', 'no_user'); end if;
  if v_icode is not null then return json_build_object('ok', false, 'reason', 'already_issued'); end if;
  update orders set account_id = v_acct where order_no = p_order_no;
  if v_cur = 'paid' then
    v_plan_credits := plan_credits(v_plan);
    perform add_credit(v_acct, v_plan_credits, 'purchase', '补发订单 ' || p_order_no);
    update orders set issued_code = 'acct:' || v_acct::text where order_no = p_order_no;
  end if;
  perform log_admin(v_id, 'order_account', p_order_no, '绑定账号 ' || p_username);
  return json_build_object('ok', true);
end $$;

-- 返利台账
create or replace function admin_list_rebates(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select id, order_no, referrer, kind, amount, status, note, created_at, settled_at
    from rebates
    limit 300
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

-- 结算返利（paid=已转账 / skipped=不返）
create or replace function admin_set_rebate_status(p_token text, p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  if p_status not in ('pending','paid','skipped') then raise exception '未知状态'; end if;
  update rebates set status = p_status,
    settled_at = case when p_status in ('paid','skipped') then coalesce(settled_at, now()) else settled_at end
  where id = p_id;
  perform log_admin(v_id, 'rebate_status', p_id::text, p_status);
  return json_build_object('ok', true);
end $$;

-- 读取/修改配置
create or replace function admin_get_settings(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_object_agg(key, value), '{}'::json) into v from settings;
  return json_build_object('ok', true, 'settings', v);
end $$;

create or replace function admin_set_setting(p_token text, p_key text, p_value text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  if p_key not in ('rebate_rate','discount') then raise exception '未知设置项'; end if;
  if p_value !~ '^[0-9]+(\.[0-9]+)?$' then raise exception '请输入数字'; end if;
  insert into settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
  perform log_admin(v_id, 'set_setting', p_key, p_value);
  return json_build_object('ok', true);
end $$;

-- 生成卡密（管理员包装 generate_codes）
create or replace function admin_generate_codes(p_token text, p_count int, p_plan text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x), '[]'::json) into v from (
    select generate_codes.code from generate_codes(p_count, p_plan)
  ) x;
  return json_build_object('ok', true, 'codes', v);
end $$;

-- 卡密列表（p_status 传空 = 全部）
create or replace function admin_list_codes(p_token text, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select code, plan, status, used_by, activated_at, expires_at, created_at
    from vip_codes
    where (p_status is null or p_status = '' or status = p_status)
    limit 300
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

revoke execute on function admin_account(text) from public, anon, authenticated;

-- 报价：买家点"下一步"时显示应付金额（含首单立减）
create or replace function quote_order(p_plan text, p_referrer text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_name text; v_discount numeric := 0; v_ref text; v_paid int; v_self int;
begin
  select f.v_price, f.v_name from plan_price(p_plan) f into v_price, v_name;
  v_ref := upper(trim(coalesce(p_referrer, '')));
  if v_ref <> '' and valid_referrer(v_ref) and length(coalesce(p_device,'')) >= 8 then
    select count(*) into v_paid from orders where device_id = p_device and status = 'paid';
    select count(*) into v_self from referrers where code = v_ref and device_id = p_device;
    if v_paid = 0 and v_self = 0 then
      select value::numeric into v_discount from settings where key = 'discount';
      v_discount := coalesce(v_discount, 0.50);
      v_discount := least(v_discount, v_price - 0.01);
    end if;
  end if;
  return json_build_object('plan', p_plan, 'plan_name', v_name,
                           'price', round(v_price - v_discount, 2),
                           'discount', round(v_discount, 2));
end $$;

-- 创建订单：金额在服务端计算，买家无法改价；返回订单号
create or replace function create_order(p_plan text, p_method text, p_referrer text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_name text; v_discount numeric := 0; v_ref text;
  v_paid int; v_self int; v_recent int; v_order_no text;
begin
  if p_method not in ('wechat','alipay') then raise exception '未知支付方式'; end if;
  if length(coalesce(p_device,'')) < 8 then raise exception '设备标识无效'; end if;
  select f.v_price, f.v_name from plan_price(p_plan) f into v_price, v_name;
  v_ref := upper(trim(coalesce(p_referrer, '')));
  if v_ref <> '' and valid_referrer(v_ref) then
    select count(*) into v_recent from orders
      where device_id = p_device and status = 'pending' and created_at > now() - interval '6 hours';
    if v_recent >= 3 then raise exception '订单创建太频繁，请稍后再试'; end if;
    select count(*) into v_paid from orders where device_id = p_device and status = 'paid';
    select count(*) into v_self from referrers where code = v_ref and device_id = p_device;
    if v_paid = 0 and v_self = 0 then
      select value::numeric into v_discount from settings where key = 'discount';
      v_discount := coalesce(v_discount, 0.50);
      v_discount := least(v_discount, v_price - 0.01);
    else
      v_ref := '';  -- 老客复购或自荐：不记推荐人、不给立减
    end if;
  end if;
  v_order_no := 'T' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  insert into orders (order_no, plan, plan_name, price, pay_method, referrer, device_id, status)
  values (v_order_no, p_plan, v_name, round(v_price - v_discount, 2), p_method,
          nullif(v_ref, ''), p_device, 'pending');
  return json_build_object('order_no', v_order_no, 'plan', p_plan,
                           'price', round(v_price - v_discount, 2));
end $$;

-- 登录账号创建订单：复用安全计价逻辑，并把订单直接绑定账号
create or replace function create_account_order(p_token text, p_plan text, p_method text, p_referrer text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_order json; v_no text;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  v_order := create_order(p_plan, p_method, p_referrer, p_device);
  v_no := v_order->>'order_no';
  update orders set account_id = v_id where order_no = v_no;
  return (v_order::jsonb || json_build_object('ok', true))::json;
end $$;

-- 激活会员卡密：服务端校验一次性使用，写入权益有效期
create or replace function activate_code(p_code text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_plan text; v_credits int; v_days int; v_expires timestamptz; v_code text;
begin
  if length(coalesce(p_device,'')) < 8 then raise exception '设备标识无效'; end if;
  v_code := upper(trim(coalesce(p_code,'')));
  select plan into v_plan from vip_codes where code = v_code and status = 'unused';
  if v_plan is null then raise exception '激活码不存在或已被使用'; end if;
  v_credits := plan_credits(v_plan);
  v_days := case when v_plan = 'single' then 7 else 30 end;
  v_expires := now() + v_days * interval '1 day';
  update vip_codes set status = 'used', used_by = p_device, activated_at = now(), expires_at = v_expires
  where code = v_code and status = 'unused';
  if not found then raise exception '激活码不存在或已被使用'; end if;
  return json_build_object('plan', v_plan, 'credits', v_credits, 'expires_at', v_expires);
end $$;

-- 登录账号激活卡密：额度直接进入账号账本，不再只存在设备
create or replace function activate_code_account(p_token text, p_code text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_plan text; v_credits int; v_code text; v_left int;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  v_code := upper(trim(coalesce(p_code,'')));
  select plan into v_plan from vip_codes where code = v_code and status = 'unused';
  if v_plan is null then raise exception '激活码不存在或已被使用'; end if;
  v_credits := plan_credits(v_plan);
  update vip_codes set status = 'revoked', used_by = p_device, activated_at = now(), expires_at = now()
  where code = v_code and status = 'unused';
  if not found then raise exception '激活码不存在或已被使用'; end if;
  v_left := add_credit(v_id, v_credits, 'purchase', '激活会员卡密 ' || v_code);
  return json_build_object('ok', true, 'plan', v_plan, 'credits', v_credits, 'credits_left', v_left);
end $$;

-- 查询本设备已激活且未过期的会员（换浏览器/清缓存后自动恢复）
create or replace function my_entitlement(p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json;
begin
  select coalesce(json_agg(x), '[]'::json) into v_result from (
    select plan,
           plan_credits(plan) as credits,
           expires_at
    from vip_codes
    where used_by = p_device and status = 'used' and expires_at > now()
    order by activated_at desc
  ) x;
  return v_result;
end $$;

-- 保存/更新推荐人的返利设置（自选现金或解读额度）
create or replace function set_referrer(p_code text, p_nickname text, p_payout_type text, p_payout_account text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  v_code := upper(trim(coalesce(p_code,'')));
  if not valid_referrer(v_code) then raise exception '推荐码格式不对'; end if;
  if p_payout_type not in ('cash','credit') then raise exception '返利方式不对'; end if;
  insert into referrers (code, nickname, payout_type, payout_account, device_id)
  values (v_code, nullif(trim(coalesce(p_nickname,'')), ''), p_payout_type,
          nullif(trim(coalesce(p_payout_account,'')), ''), p_device)
  on conflict (code) do update set
    nickname = excluded.nickname,
    payout_type = excluded.payout_type,
    payout_account = excluded.payout_account,
    device_id = excluded.device_id;
  return json_build_object('ok', true);
end $$;

-- 查看自己的推广收益（旧版设备推荐，仅供兼容旧链接；新推广数据见 my_referrals）
create or replace function my_referrer(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_out json;
begin
  v_code := upper(trim(coalesce(p_code,'')));
  select coalesce(to_jsonb(r), '{}'::jsonb) into v_out from (
    select code, nickname, payout_type, credits, total_reward, created_at
    from referrers where code = v_code
  ) r;
  return v_out;
end $$;

-- 把 1 次解读额度兑换到本机（旧版设备推荐，仅供兼容旧链接）
create or replace function redeem_credit(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_left int;
begin
  v_code := upper(trim(coalesce(p_code,'')));
  update referrers set credits = credits - 1 where code = v_code and credits >= 1 returning credits into v_left;
  if v_left is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'credits_left', v_left);
end $$;

-- 公开配置：网站用来展示当前返利比例/首单立减（不含任何敏感信息）
create or replace function pub_settings()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select json_build_object(
    'rebate_rate', coalesce((select value::numeric from settings where key = 'rebate_rate'), 0.30),
    'discount',    coalesce((select value::numeric from settings where key = 'discount'), 0.50)
  ) into v;
  return v;
end $$;

-- 我的订单：买家在「我的」页查看自己设备最近的订单状态（仅返回订单号/方案/金额/状态）
create or replace function my_orders(p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select order_no, plan_name, price, pay_method, status, created_at, paid_at
    from orders
    where device_id = p_device
    limit 50
  ) x;
  return v;
end $$;

-- ============================================================
-- 返利自动入账：店主把订单标记为 paid 时触发
--   现金返利 → rebates 记一笔 pending，店主人工转账后改 status=paid
--   额度返利 → 自动 +1 额度并记为已发放
-- ============================================================
create or replace function on_order_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric; v_amount numeric; v_ref record;
begin
  v_rate := coalesce((select value::numeric from settings where key = 'rebate_rate'), 0.30);
  if new.status = 'paid' and new.referrer is not null and new.referrer <> '' then
    v_amount := round(new.price * v_rate, 2);
    select * into v_ref from referrers where code = new.referrer;
    if v_ref.code is not null and v_ref.payout_type = 'credit' then
      update referrers set credits = credits + 1 where code = new.referrer;
      insert into rebates (order_no, referrer, kind, status, note)
      values (new.order_no, new.referrer, 'credit', 'paid', '已自动发放 1 次解读额度');
    else
      insert into rebates (order_no, referrer, kind, amount, status, note)
      values (new.order_no, new.referrer, 'cash', v_amount, 'pending',
              case when v_ref.code is null then '推荐人还没绑定返利设置，记得找 TA 确认收款账号' else '' end);
    end if;
    if v_ref.code is not null and v_ref.payout_type = 'cash' then
      update referrers set total_reward = total_reward + v_amount where code = new.referrer;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_order_paid on orders;
create trigger trg_order_paid
after update of status on orders
for each row when (new.status = 'paid')
execute function on_order_paid();

-- ============================================================
-- 店主工具：批量生成激活码（在 SQL Editor 里执行，例如生成 20 个轻会员码）
--   select * from generate_codes(20, 'light');
--   生成的码只有你自己能看到，发给买家即可
-- ============================================================
create or replace function generate_codes(p_count int, p_plan text)
returns table(code text)
language plpgsql security definer set search_path = public as $$
begin
  if p_plan not in ('single','light','plus') then raise exception '方案不对'; end if;
  if p_count < 1 or p_count > 200 then raise exception '数量 1-200'; end if;
  for i in 1..p_count loop
    code := 'X' || upper(substr(md5(random()::text), 1, 11));
    insert into vip_codes (code, plan) values (code, p_plan);
    return next;
  end loop;
end $$;

-- ---------- 权限收口：工具函数/触发器函数不对匿名用户开放 ----------
revoke execute on function plan_price(text)        from public, anon, authenticated;
revoke execute on function plan_credits(text)      from public, anon, authenticated;
revoke execute on function valid_referrer(text)    from public, anon, authenticated;
revoke execute on function generate_codes(int,text) from public, anon, authenticated;
revoke execute on function on_order_paid()         from public, anon, authenticated;

-- ============================================================
-- 第二阶段：账号找回 + 占卜记录 + 额度账本 + 管理员日志
-- ============================================================

-- ---------- 6. 账号找回：邮箱绑定 / 忘记密码 ----------
alter table accounts add column if not exists email text;
alter table accounts add column if not exists email_verified boolean not null default false;
alter table accounts add column if not exists reset_token text;
alter table accounts add column if not exists reset_expires timestamptz;
create unique index if not exists idx_accounts_email on accounts(email) where email is not null;

-- 绑定邮箱（可选；本阶段为自助绑定，未接邮件服务则标记"未验证"）
create or replace function bind_email(p_token text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  v_email := lower(trim(coalesce(p_email,'')));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception '邮箱格式不对'; end if;
  if exists (select 1 from accounts where email = v_email and id <> v_id) then raise exception '该邮箱已被其他账号绑定'; end if;
  update accounts set email = v_email, email_verified = false where id = v_id;
  return json_build_object('ok', true, 'email', v_email);
end $$;

-- 申请找回码：用户名+邮箱必须匹配才返回一次性找回码（30 分钟有效）
-- 说明：本阶段未接入邮件服务，找回码直接显示在申请页面上（如实告知）
create or replace function request_password_reset(p_username text, p_email text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_user accounts%rowtype; v_code text;
begin
  select * into v_user from accounts
    where username = lower(trim(p_username)) and lower(coalesce(email,'')) = lower(trim(coalesce(p_email,'')));
  if v_user.id is null then raise exception '用户名与邮箱不匹配'; end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update accounts set reset_token = v_code, reset_expires = now() + interval '30 minutes' where id = v_user.id;
  return json_build_object('ok', true, 'code', v_code, 'expires_min', 30);
end $$;

-- 用找回码重置密码（重置后所有设备强制退出）
create or replace function reset_password(p_username text, p_code text, p_new text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if length(coalesce(p_new,'')) < 6 then raise exception '新密码至少 6 位'; end if;
  select id into v_id from accounts
    where username = lower(trim(p_username))
      and reset_token = upper(trim(coalesce(p_code,'')))
      and reset_expires > now();
  if v_id is null then raise exception '找回码无效或已过期'; end if;
  update accounts set password_hash = crypt(p_new, gen_salt('bf', 10)),
    reset_token = null, reset_expires = null, failed_attempts = 0, locked_until = null
  where id = v_id;
  delete from sessions where account_id = v_id;
  return json_build_object('ok', true);
end $$;

-- ---------- 7. 占卜记录：跟账号走，跨设备 ----------
create table if not exists readings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  spread text not null,
  question text,
  cards jsonb not null,              -- [{name, reversed}, ...]
  report_html text,                  -- 免费报告快照（重新查看时原样展示）
  ai_report text,                    -- AI 深度解读文本
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_readings_account on readings(account_id);
alter table readings enable row level security;

create or replace function save_reading(p_token text, p_spread text, p_question text, p_cards jsonb, p_report_html text, p_ai_report text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rid uuid;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  insert into readings (account_id, spread, question, cards, report_html, ai_report)
  values (v_id, p_spread, p_question, p_cards, p_report_html, p_ai_report)
  returning id into v_rid;
  return json_build_object('ok', true, 'id', v_rid);
end $$;

create or replace function my_readings(p_token text, p_fav_only boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select id, spread, question, cards, favorite,
           (ai_report is not null and ai_report <> '') as has_ai, created_at
    from readings
    where account_id = v_id and (not coalesce(p_fav_only, false) or favorite)
    limit 100
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

create or replace function get_reading(p_token text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v readings%rowtype;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  select * into v from readings where id = p_id and account_id = v_id;
  if v.id is null then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  return json_build_object('ok', true, 'spread', v.spread, 'question', v.question,
                           'cards', v.cards, 'report_html', v.report_html,
                           'ai_report', v.ai_report, 'created_at', v.created_at);
end $$;

create or replace function delete_reading(p_token text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  delete from readings where id = p_id and account_id = v_id;
  return json_build_object('ok', true);
end $$;

create or replace function toggle_favorite(p_token text, p_id uuid, p_fav boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  update readings set favorite = p_fav where id = p_id and account_id = v_id;
  return json_build_object('ok', true);
end $$;

create or replace function update_ai_report(p_token text, p_id uuid, p_ai text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  update readings set ai_report = p_ai where id = p_id and account_id = v_id;
  return json_build_object('ok', true);
end $$;

-- ---------- 8. 额度账本：每一笔加减都有记录 ----------
create table if not exists credit_ledger (
  id bigserial primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  delta int not null,                -- 正=增加 负=消耗
  reason text not null,              -- register / invite / admin / purchase / ai / refund
  note text,
  balance_after int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_account on credit_ledger(account_id);
alter table credit_ledger enable row level security;

-- 内部：原子加/减额度并记账（余额不足拒绝负向操作），返回操作后余额，-1 表示失败
create or replace function add_credit(p_account_id uuid, p_delta int, p_reason text, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  update accounts set credits = credits + p_delta
  where id = p_account_id and (p_delta >= 0 or credits + p_delta >= 0)
  returning credits into v_left;
  if v_left is null then return -1; end if;
  insert into credit_ledger (account_id, delta, reason, note, balance_after)
  values (p_account_id, p_delta, coalesce(p_reason,'misc'), p_note, v_left);
  return v_left;
end $$;

-- 我的额度明细
create or replace function my_ledger(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select delta, reason, note, balance_after, created_at
    from credit_ledger where account_id = v_id
    limit 100
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

-- 管理员查任意用户账本（p_username 传空 = 全部）
create or replace function admin_list_ledger(p_token text, p_username text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select a.username, l.delta, l.reason, l.note, l.balance_after, l.created_at
    from credit_ledger l join accounts a on a.id = l.account_id
    where (coalesce(p_username,'') = '' or a.username = lower(trim(p_username)))
    limit 200
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

-- ---------- 9. 管理员操作日志 ----------
create table if not exists admin_logs (
  id bigserial primary key,
  admin_username text not null,
  action text not null,              -- set_credits / order_paid / order_cancelled / ban / unban / set_setting / rebate_status
  target text,
  detail text,
  created_at timestamptz not null default now()
);
alter table admin_logs enable row level security;

-- 内部：写日志
create or replace function log_admin(p_admin_id uuid, p_action text, p_target text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select username into v_name from accounts where id = p_admin_id;
  insert into admin_logs (admin_username, action, target, detail)
  values (coalesce(v_name,'?'), p_action, p_target, p_detail);
end $$;

create or replace function admin_list_logs(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v json;
begin
  v_id := admin_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'forbidden'); end if;
  select coalesce(json_agg(x order by created_at desc), '[]'::json) into v from (
    select admin_username, action, target, detail, created_at from admin_logs limit 200
  ) x;
  return json_build_object('ok', true, 'list', v);
end $$;

revoke execute on function add_credit(uuid,int,text,text)   from public, anon, authenticated;
revoke execute on function log_admin(uuid,text,text,text)    from public, anon, authenticated;

-- 设备权益合并到账号：登录后把该设备名下有效卡密额度并入账号余额（一次性，幂等）
create or replace function merge_device_entitlement(p_token text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_credits int;
begin
  v_id := session_account(p_token);
  if v_id is null then return json_build_object('ok', false, 'reason', 'login_expired'); end if;
  if length(coalesce(p_device,'')) < 8 then return json_build_object('ok', true, 'merged', 0); end if;
  select coalesce(sum(plan_credits(plan)), 0) into v_credits from (
    select plan from vip_codes
    where used_by = p_device and status = 'used' and expires_at > now()
  ) t;
  if v_credits > 0 then
    perform add_credit(v_id, v_credits, 'purchase', 'VIP权益合并（设备卡密自动并入账号）');
    update vip_codes set status = 'revoked'
    where used_by = p_device and status = 'used' and expires_at > now();
  end if;
  return json_build_object('ok', true, 'merged', v_credits);
end $$;
