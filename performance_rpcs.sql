-- ==========================================================
-- PERFORMANCE OPTIMIZATION RPCS (V4 COMPREHENSIVE)
-- ==========================================================

-- 1. Registry Statistics (Members Page)
-- This function calculates the big numbers for the registry directory instantly.
create or replace function public.get_firm_registry_stats(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_total_people int;
    v_active_people int;
    v_active_tickets int;
begin
    -- 1. Total Persons (not trashed)
    select count(*) into v_total_people 
    from persons 
    where firm_id = p_firm_id and deleted_at is null;

    -- 2. Active People (distinct individuals with active tickets)
    select count(distinct person_id) into v_active_people
    from members
    where firm_id = p_firm_id 
      and status in ('active', 'foreman', 'defaulter')
      and deleted_at is null;

    -- 3. Active Tickets (in non-archived groups, not trashed)
    select count(m.id) into v_active_tickets 
    from members m
    join groups g on m.group_id = g.id
    where m.firm_id = p_firm_id 
      and m.deleted_at is null 
      and g.status != 'archived';

    return json_build_object(
        'activePeople', v_active_people,
        'totalPeople', v_total_people,
        'activeTickets', v_active_tickets
    );
end;
$$;

-- 2. Ledger Statistics (Payments & Cashbook Page)
-- This function calculates collection & payout totals to prevent greedy fetches.
create or replace function public.get_firm_ledger_stats(
    p_firm_id uuid,
    p_start_date date default null,
    p_end_date date default null
)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_today_coll numeric(12,2);
    v_range_coll numeric(12,2) := 0;
    v_range_payout numeric(12,2) := 0;
begin
    -- 1. Today's Collections
    select coalesce(sum(amount), 0) into v_today_coll
    from payments
    where firm_id = p_firm_id 
      and deleted_at is null 
      and payment_date = current_date;

    -- 2. Range Collections & Payouts (if dates provided)
    if p_start_date is not null and p_end_date is not null then
        -- Sum Payments (Collections)
        select coalesce(sum(amount), 0) into v_range_coll
        from payments
        where firm_id = p_firm_id 
          and deleted_at is null 
          and payment_date >= p_start_date 
          and payment_date <= p_end_date;
        
        -- Sum Settlements (Payouts)
        select coalesce(sum(total_amount), 0) into v_range_payout
        from settlements
        where firm_id = p_firm_id 
          and deleted_at is null 
          and created_at >= (p_start_date::text || ' 00:00:00')::timestamp
          and created_at <= (p_end_date::text || ' 23:59:59')::timestamp;
    end if;

    return json_build_object(
        'collectedToday', v_today_coll,
        'collectedInRange', v_range_coll,
        'payoutsInRange', v_range_payout
    );
end;
$$;

-- 3. Dashboard Statistics Aggregator
-- Returns high-level metrics for dashboard cards without fetching raw data.
create or replace function public.get_firm_dashboard_stats(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_total_chit_value numeric(15,2);
    v_defaulters_count int;
    v_active_groups_count int;
    v_total_members_count int;
begin
    -- 1. Total Chit Value (Active Groups)
    select coalesce(sum(chit_value), 0), count(*) 
    into v_total_chit_value, v_active_groups_count
    from groups 
    where firm_id = p_firm_id and status = 'active' and deleted_at is null;

    -- 2. Defaulters Count
    select count(*) into v_defaulters_count
    from members 
    where firm_id = p_firm_id and status = 'defaulter' and deleted_at is null;

    -- 3. Total Members Count
    select count(*) into v_total_members_count
    from members 
    where firm_id = p_firm_id and deleted_at is null;

    return json_build_object(
        'totalChitValue', v_total_chit_value,
        'defaulters', v_defaulters_count,
        'activeGroups', v_active_groups_count,
        'totalMembers', v_total_members_count
    );
end;
$$;

-- 4. Collection Trends (Monthly Snapshot)
-- Returns sum of collections per month for the last 6 months.
create or replace function public.get_firm_collection_trends(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
begin
    return (
        select json_agg(t) from (
            with top_groups as (
                select p.group_id, sum(p.amount) as vol
                from payments p
                join groups g on g.id = p.group_id
                where p.firm_id = p_firm_id 
                  and p.deleted_at is null 
                  and g.status = 'active'
                  and p.payment_date >= (current_date - interval '6 months')
                group by 1
                order by 2 desc
                limit 10
            )
            select 
                to_char(p.payment_date, 'YYYY-MM') as month,
                g.name as group_name,
                coalesce(sum(p.amount), 0) as actual
            from payments p
            join groups g on p.group_id = g.id
            where p.group_id in (select group_id from top_groups)
              and p.firm_id = p_firm_id 
              and p.deleted_at is null 
              and p.payment_date >= (current_date - interval '6 months')
            group by 1, 2
            order by 1, 2
        ) t
    );
end;
$$;

-- 5. Daily Collection Trends (Last 7 Days)
-- Returns sum of collections per day for the last 7 days.
create or replace function public.get_firm_daily_trends(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
begin
    return (
        select json_agg(t) from (
            select 
                to_char(d.day, 'YYYY-MM-DD') as day,
                to_char(d.day, 'Dy') as label,
                -- "Expected" is what the system recorded (Payments + Cash Commissions)
                (
                  coalesce((select sum(amount) from payments where firm_id = p_firm_id and payment_date = d.day and deleted_at is null), 0) +
                  coalesce((select sum(fc.commission_amt) from foreman_commissions fc join auctions a on fc.auction_id = a.id where fc.firm_id = p_firm_id and a.payout_date = d.day and a.payout_mode = 'Cash' and a.deleted_at is null), 0)
                ) as expected,
                -- "Actual" is what was physically counted in the cashbook
                coalesce((select sum(total) from denominations where firm_id = p_firm_id and entry_date = d.day and deleted_at is null), 0) as actual
            from (
                select (current_date - interval '1 day' * i)::date as day
                from generate_series(0, 6) i
            ) d
            group by d.day
            order by d.day asc
        ) t
    );
end;
$$;

-- 6. Group Progress Summaries
-- Returns detailed progress and latest auction info per group.
create or replace function public.get_firm_group_summaries(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
begin
    return (
        select json_agg(t) from (
            select 
                g.id,
                (select count(*) from auctions a where a.group_id = g.id and a.status = 'confirmed' and a.deleted_at is null) as auctions_done,
                (
                    select json_build_object(
                        'winner', p.name,
                        'discount', a.auction_discount,
                        'month', a.month
                    )
                    from auctions a
                    join members m on a.winner_id = m.id
                    join persons p on m.person_id = p.id
                    where a.group_id = g.id and a.status = 'confirmed' and a.deleted_at is null
                    order by a.month desc
                    limit 1
                ) as last_auction
            from groups g 
            where g.firm_id = p_firm_id 
              and g.status != 'archived' 
              and g.deleted_at is null
        ) t
    );
end;
$$;

-- 6. Winner Intelligence Insights
-- Returns summaries for the "Winner Intelligence" analytics card.
create or replace function public.get_firm_winner_insights(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_early_bird_count int;
    v_highest_bid numeric(15,2);
begin
    -- 1. Early Bird Count (Auctions in first 25% of duration)
    select count(*) into v_early_bird_count
    from auctions a
    join groups g on a.group_id = g.id
    where a.firm_id = p_firm_id 
      and a.status = 'confirmed' 
      and a.month <= (g.duration / 4);

    -- 2. Single Highest Bid
    select coalesce(max(auction_discount), 0) into v_highest_bid
    from auctions
    where firm_id = p_firm_id and status = 'confirmed' and deleted_at is null;

    return json_build_object(
        'earlyBirdCount', v_early_bird_count,
        'highestSingleDiscount', v_highest_bid,
        'topBorrower', (
            select json_build_object(
                'name', p.name,
                'totalDiscount', sum(a.auction_discount)
            )
            from auctions a
            join members m on a.winner_id = m.id
            join persons p on m.person_id = p.id
            where a.firm_id = p_firm_id 
              and a.status = 'confirmed' 
              and a.deleted_at is null
            group by p.name
            order by sum(a.auction_discount) desc
            limit 1
        )
    );
end;
$$;
