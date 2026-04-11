-- ==========================================================
-- RPC: get_firm_summary_stats
-- Returns grand totals for financial reports.
-- ==========================================================

create or replace function public.get_firm_summary_stats(
  p_firm_id   uuid,
  p_start_date date default null,
  p_end_date   date default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_collected_today numeric(15,2);
    v_collected_range numeric(15,2);
    v_total_outstanding numeric(15,2);
    v_realized_commissions numeric(15,2);
begin
    -- 1. Today's Collections
    select coalesce(sum(amount), 0) into v_collected_today
    from payments
    where firm_id = p_firm_id and payment_date = current_date and deleted_at is null;

    -- 2. Range Collections
    if p_start_date is not null and p_end_date is not null then
        select coalesce(sum(amount), 0) into v_collected_range
        from payments
        where firm_id = p_firm_id 
          and payment_date >= p_start_date 
          and payment_date <= p_end_date
          and deleted_at is null;
    else
        v_collected_range := 0;
    end if;

    -- 3. Outstanding (Approximate sum of all-time dues - all-time paid)
    -- This is a heavy calculation, simplified for the aggregator
    select coalesce(sum(amount_due), 0) - coalesce(sum(amount), 0) into v_total_outstanding
    from payments
    where firm_id = p_firm_id and deleted_at is null;
    
    if v_total_outstanding < 0 then v_total_outstanding := 0; end if;

    -- 4. Realized Commissions
    select coalesce(sum(commission_amt), 0) into v_realized_commissions
    from foreman_commissions
    where firm_id = p_firm_id and status = 'confirmed';

    return json_build_object(
        'collectedToday', v_collected_today,
        'collectedInRange', v_collected_range,
        'totalOut', v_total_outstanding,
        'realizedCommissions', v_realized_commissions
    );
end;
$$;

grant execute on function public.get_firm_summary_stats(uuid, date, date) to authenticated;
