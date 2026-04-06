-- Migration: 005_auction_draft_edit.sql
-- Goal: Add status column and support editing of existing auctions

-- 1. Add status columns
alter table auctions add column if not exists status text default 'confirmed';
alter table foreman_commissions add column if not exists status text default 'confirmed';

-- 2. Add constraints
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'auctions_status_chk') then
    alter table auctions add constraint auctions_status_chk check (status in ('draft','confirmed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fc_status_chk') then
    alter table foreman_commissions add constraint fc_status_chk check (status in ('draft','confirmed'));
  end if;
end $$;

-- 3. Update record_auction_with_commission RPC
create or replace function public.record_auction_with_commission(
  p_group_id      bigint,
  p_month         int,
  p_auction_date  date,
  p_winner_id     bigint,
  p_bid_amount    numeric,
  p_foreman_member_id bigint default null,
  p_notes         text default null,
  p_status        text default 'confirmed',
  p_auction_id    bigint default null  -- Added for editing existing records
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  g            groups%rowtype;
  v_calc       jsonb;
  v_auction_id bigint;
  v_old_auction auctions%rowtype;
  v_firm_id    uuid;
begin
  if not is_firm_owner() then
    raise exception 'Owner access required to record auctions';
  end if;

  select * into g from groups where id = p_group_id and firm_id = my_firm_id();
  if not found then raise exception 'Group not found'; end if;

  v_firm_id := my_firm_id();

  -- Get full calculation (also validates bid range)
  v_calc := public.calculate_auction(p_group_id, p_bid_amount);

  -- Handle Existing Auction (Edit Mode)
  if p_auction_id is not null then
    select * into v_old_auction from auctions where id = p_auction_id and firm_id = v_firm_id;
    if not found then raise exception 'Original auction record not found'; end if;

    -- Reverse old confirmed impact if present
    if v_old_auction.status = 'confirmed' and g.auction_scheme = 'ACCUMULATION' then
        update groups 
        set accumulated_surplus = accumulated_surplus - v_old_auction.bid_amount
        where id = p_group_id;
    end if;

    -- Update existing auction
    update auctions set
      auction_date = p_auction_date,
      winner_id = p_winner_id,
      bid_amount = p_bid_amount,
      total_pot = g.chit_value,
      dividend = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      status = p_status,
      updated_at = now()
    where id = p_auction_id;
    
    v_auction_id := p_auction_id;

    -- Update or Delete Foreman Commission
    -- We can just delete and let it recreate to ensure all fields are fresh
    delete from foreman_commissions where auction_id = v_auction_id;
  else
    -- Standard Insert Mode
    insert into auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout, status)
    values (
      v_firm_id, p_group_id, p_month, p_auction_date, p_winner_id,
      p_bid_amount, g.chit_value, (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status
    )
    returning id into v_auction_id;
  end if;

  -- Insert foreman commission record (Fresh row)
  insert into foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, bid_amount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div,
    paid_to, foreman_member_id, notes, status
  ) values (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, p_bid_amount, (v_calc->>'discount')::numeric,
    (v_calc->>'commission_type')::text,
    (v_calc->>'commission_rate')::numeric,
    (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric,
    (v_calc->>'per_member_div')::numeric,
    g.commission_recipient,
    p_foreman_member_id,
    p_notes,
    p_status
  );

  -- Apply confirmed impact if status is confirmed
  if p_status = 'confirmed' and g.auction_scheme = 'ACCUMULATION' then
     update groups 
     set accumulated_surplus = accumulated_surplus + p_bid_amount
     where id = p_group_id;
  end if;

  return v_calc || jsonb_build_object('auction_id', v_auction_id);
end;
$$;
