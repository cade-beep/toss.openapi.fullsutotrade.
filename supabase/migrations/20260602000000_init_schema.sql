-- Ensure UUID extension is initialized under extensions schema safely
create extension if not exists "uuid-ossp" schema extensions;

-- 1. Portfolio Table (Stores Cash Balance)
create table if not exists public.portfolio (
  user_id uuid references auth.users on delete cascade primary key,
  cash_balance bigint not null default 10000000 check (cash_balance >= 0),
  updated_at timestamptz not null default now()
);

-- 2. Positions Table (Stores Active Holdings)
create table if not exists public.positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol varchar(10) not null,
  qty integer not null check (qty > 0),
  avg_buy_price integer not null check (avg_buy_price >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

-- 3. Watchlist Table (Stores Tracked Symbols)
create table if not exists public.watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol varchar(10) not null,
  name varchar(50) not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

-- 4. Orders Log Table (Stores Execution History)
create table if not exists public.orders_log (
  id varchar(50) primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol varchar(10) not null,
  side varchar(10) not null check (side in ('BUY', 'SELL')),
  type varchar(10) not null check (type in ('MARKET', 'LIMIT')),
  qty integer not null check (qty > 0),
  price integer not null check (price >= 0),
  status varchar(20) not null check (status in ('PENDING', 'FILLED', 'REJECTED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

-- Enable RLS on all tables
alter table public.portfolio enable row level security;
alter table public.positions enable row level security;
alter table public.watchlist enable row level security;
alter table public.orders_log enable row level security;

-- Idempotent Policy Creation Strategy
-- Portfolio Policies
drop policy if exists "Users can view their own portfolio" on public.portfolio;
create policy "Users can view their own portfolio"
  on public.portfolio for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own portfolio" on public.portfolio;
create policy "Users can insert their own portfolio"
  on public.portfolio for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own portfolio" on public.portfolio;
create policy "Users can update their own portfolio"
  on public.portfolio for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Positions Policies
drop policy if exists "Users can view their own positions" on public.positions;
create policy "Users can view their own positions"
  on public.positions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own positions" on public.positions;
create policy "Users can insert their own positions"
  on public.positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own positions" on public.positions;
create policy "Users can update their own positions"
  on public.positions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own positions" on public.positions;
create policy "Users can delete their own positions"
  on public.positions for delete
  using (auth.uid() = user_id);

-- Watchlist Policies
drop policy if exists "Users can view their own watchlist" on public.watchlist;
create policy "Users can view their own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own watchlist" on public.watchlist;
create policy "Users can insert their own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own watchlist" on public.watchlist;
create policy "Users can update their own watchlist"
  on public.watchlist for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own watchlist" on public.watchlist;
create policy "Users can delete their own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

-- Orders Log Policies
drop policy if exists "Users can view their own orders" on public.orders_log;
create policy "Users can view their own orders"
  on public.orders_log for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own orders" on public.orders_log;
create policy "Users can insert their own orders"
  on public.orders_log for insert
  with check (auth.uid() = user_id);

-- --- EXECUTE TRADE TRANSACTIONAL RPC FUNCTION ---
create or replace function public.execute_trade(
  p_order_id varchar(50),
  p_symbol varchar(10),
  p_side varchar(10),
  p_qty integer,
  p_price integer
)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_total_cost bigint;
  v_cash_balance bigint;
  v_current_qty integer := 0;
  v_avg_buy_price integer := 0;
  v_new_qty integer;
  v_new_avg_buy_price integer;
  v_position_id uuid;
begin
  -- 1. Retrieve the authenticated user's ID
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized: Authentication required.';
  end if;

  v_total_cost := p_qty::bigint * p_price::bigint;

  -- 2. Lock portfolio row for update to enforce concurrency safeties
  select cash_balance into v_cash_balance
  from public.portfolio
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Portfolio record not initialized for user.';
  end if;

  -- 3. Execute Buy / Sell Logic
  if p_side = 'BUY' then
    -- Balance safety checks
    if v_cash_balance < v_total_cost then
      raise exception 'Insufficient balance: cash balance is %, purchase cost is %.', v_cash_balance, v_total_cost;
    end if;

    -- Deduct portfolio cash balance
    update public.portfolio
    set cash_balance = cash_balance - v_total_cost,
        updated_at = now()
    where user_id = v_user_id;

    -- Query position for lock and compute average pricing
    select id, qty, avg_buy_price into v_position_id, v_current_qty, v_avg_buy_price
    from public.positions
    where user_id = v_user_id and symbol = p_symbol
    for update;

    if found then
      v_new_qty := v_current_qty + p_qty;
      v_new_avg_buy_price := round((v_current_qty::numeric * v_avg_buy_price::numeric + v_total_cost::numeric) / v_new_qty::numeric);

      update public.positions
      set qty = v_new_qty,
          avg_buy_price = v_new_avg_buy_price,
          updated_at = now()
      where id = v_position_id;
    else
      insert into public.positions (user_id, symbol, qty, avg_buy_price)
      values (v_user_id, p_symbol, p_qty, p_price);
    end if;

  elsif p_side = 'SELL' then
    -- Query holdings for check
    select id, qty into v_position_id, v_current_qty
    from public.positions
    where user_id = v_user_id and symbol = p_symbol
    for update;

    if not found or v_current_qty < p_qty then
      raise exception 'Insufficient shares: owned %, requested sale quantity is %.', v_current_qty, p_qty;
    end if;

    -- Add funds back to cash balance
    update public.portfolio
    set cash_balance = cash_balance + v_total_cost,
        updated_at = now()
    where user_id = v_user_id;

    v_new_qty := v_current_qty - p_qty;

    if v_new_qty > 0 then
      update public.positions
      set qty = v_new_qty,
          updated_at = now()
      where id = v_position_id;
    else
      -- Clean position completely if sold out
      delete from public.positions
      where id = v_position_id;
    end if;

  else
    raise exception 'Invalid trade side specification.';
  end if;

  -- 4. Record the filled order execution in log
  insert into public.orders_log (id, user_id, symbol, side, type, qty, price, status)
  values (p_order_id, v_user_id, p_symbol, p_side, 'MARKET', p_qty, p_price, 'FILLED');

  return json_build_object(
    'success', true,
    'order_id', p_order_id,
    'side', p_side,
    'qty', p_qty,
    'price', p_price
  );
exception
  when others then
    -- Implicit transaction rollback is executed on exception triggers
    raise;
end;
$$;
