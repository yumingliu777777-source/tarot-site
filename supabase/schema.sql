-- ============================================================
-- 星夜塔罗 · 会员收款 + 推广返利（Supabase 免费档）
-- 用法：supabase.com 注册 → New project → SQL Editor → New query
--       → 把本文件全部内容粘贴进去 → Run
-- 以后改返利比例/首单立减：Table Editor → settings 表直接改数值，不用再跑 SQL
-- ============================================================

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
create table if not exists referrers (
  code text primary key,
  nickname text,
  payout_type text not null default 'cash' check (payout_type in ('cash','credit')),
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

-- ============================================================
-- 网站调用的安全函数（SECURITY DEFINER = 以管理员身份执行，绕过 RLS）
-- ============================================================

-- 报价：买家点"下一步"时显示应付金额（含首单立减）
create or replace function quote_order(p_plan text, p_referrer text, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_name text; v_discount numeric := 0; v_ref text; v_paid int; v_self int;
begin
  select v_price, v_name from plan_price(p_plan) into v_price, v_name;
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
  select v_price, v_name from plan_price(p_plan) into v_price, v_name;
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
  if v_plan = 'single' then v_credits := 1; v_days := 7;
  elsif v_plan = 'light' then v_credits := 10; v_days := 30;
  else v_credits := 30; v_days := 30;
  end if;
  v_expires := now() + v_days * interval '1 day';
  update vip_codes set status = 'used', used_by = p_device, activated_at = now(), expires_at = v_expires
  where code = v_code and status = 'unused';
  if not found then raise exception '激活码不存在或已被使用'; end if;
  return json_build_object('plan', v_plan, 'credits', v_credits, 'expires_at', v_expires);
end $$;

-- 查询本设备已激活且未过期的会员（换浏览器/清缓存后自动恢复）
create or replace function my_entitlement(p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare v_result json;
begin
  select coalesce(json_agg(x), '[]'::json) into v_result from (
    select plan,
           case plan when 'single' then 1 when 'light' then 10 else 30 end as credits,
           expires_at
    from vip_codes
    where used_by = p_device and expires_at > now()
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

-- 查看自己的推广收益（不含收款账号，保护隐私）
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

-- 把 1 次解读额度兑换到本机（服务端扣减，防止刷额度）
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
revoke execute on function valid_referrer(text)    from public, anon, authenticated;
revoke execute on function generate_codes(int,text) from public, anon, authenticated;
revoke execute on function on_order_paid()         from public, anon, authenticated;
