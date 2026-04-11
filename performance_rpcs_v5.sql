-- ============================================================
-- RPC: get_person_financial_summaries
-- Aggregates total due, paid, and balance for a slice of persons.
-- Optimized for Egress - returns 1 summary row per person.
-- ============================================================

create or replace function public.get_person_financial_summaries(
  p_firm_id   uuid,
  p_person_ids bigint[]
)
returns table (
  person_id       bigint,
  overall_balance  numeric(12,2),
  overall_due      numeric(12,2),
  overall_paid     numeric(12,2),
  is_overdue       boolean,
  ticket_counts    jsonb
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with group_auctions as (
    -- Get latest month for each relevant group
    select 
      a.group_id, 
      count(*) as auctions_done, 
      coalesce(sum(a.dividend), 0) as total_dividends
    from auctions a
    where a.firm_id = p_firm_id and a.status = 'confirmed' and a.deleted_at is null
    group by 1
  ),
  member_summaries as (
    -- Calculate per-member financial health
    select 
      m.id as member_id,
      m.person_id,
      g.id as group_id,
      g.name as group_name,
      g.auction_scheme,
      g.monthly_contribution,
      coalesce(ga.auctions_done, 0) as auctions_done,
      -- currentDueMonth = latest + 1
      (coalesce(ga.auctions_done, 0) + 1) as due_months_count,
      -- Payments for this specific member
      (select coalesce(sum(p.amount), 0) from payments p where p.member_id = m.id and p.deleted_at is null) as total_paid,
      -- Aggregated dividends (Only for DIVIDEND scheme)
      case 
        when g.auction_scheme = 'DIVIDEND' then coalesce(ga.total_dividends, 0)
        else 0 
      end as total_dividends
    from members m
    join groups g on m.group_id = g.id
    left join group_auctions ga on g.id = ga.group_id
    where m.person_id = any(p_person_ids) 
      and m.firm_id = p_firm_id 
      and m.deleted_at is null
      and g.deleted_at is null
  ),
  member_calculated as (
    -- Apply the scheme math
    select 
      ms.person_id,
      ms.member_id,
      ms.group_name,
      ms.total_paid,
      case 
        when ms.auction_scheme = 'ACCUMULATION' then (ms.monthly_contribution * ms.due_months_count)
        else (ms.monthly_contribution * ms.due_months_count) - ms.total_dividends
      end as total_due
    from member_summaries ms
  )
  select 
    mc.person_id,
    sum(greatest(0, mc.total_due - mc.total_paid)) as overall_balance,
    sum(mc.total_due) as overall_due,
    sum(mc.total_paid) as overall_paid,
    bool_or((mc.total_due - mc.total_paid) > 1.00) as is_overdue, -- Loose definition of overdue for list view
    jsonb_object_agg(mc.group_name, (mc.total_due - mc.total_paid)) as ticket_counts
  from member_calculated mc
  group by mc.person_id;
end;
$$;

grant execute on function public.get_person_financial_summaries(uuid, bigint[]) to authenticated;
