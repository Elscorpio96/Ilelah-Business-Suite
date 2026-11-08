-- 0012: correct the details of a finished receipt: customer name / phone (any editor), and - owner only -
-- cash <-> credit, amount paid, customer and due date (e.g. a credit sale printed as cash by mistake).
-- Safe to run more than once. Does not touch existing data.
create or replace function edit_sale_details(p_sale uuid, p_details jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shop uuid := app.my_shop(); s sales%rowtype; v_tz text; v_today date; v_before jsonb;
  v_method text; v_cust uuid; v_name text; v_phone text; v_due date; v_paid numeric; v_bal numeric;
  v_money boolean;
begin
  perform app.require_member();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select * into s from sales where id = p_sale and shop_id = v_shop for update;
  if not found then raise exception 'unknown_sale'; end if;
  select timezone into v_tz from shops where id = v_shop; v_today := (now() at time zone v_tz)::date;
  if app.is_admin() then null;
  elsif app.is_manager_up() then
    if not app.can_branch(s.branch_id) then raise exception 'branch_not_allowed' using errcode = '42501'; end if;
  elsif s.cashier_id = auth.uid() and s.business_date = v_today then null;
  else raise exception 'edit_not_allowed' using errcode = '42501'; end if;
  if s.status <> 'completed' then raise exception 'sale_not_editable'; end if;

  v_method := coalesce(nullif(p_details->>'payment_method', ''), s.payment_method);
  v_cust   := case when p_details ? 'customer_id' then nullif(p_details->>'customer_id', '')::uuid else s.customer_id end;
  v_name   := case when p_details ? 'customer_name' then trim(coalesce(p_details->>'customer_name', '')) else s.customer_name end;
  v_phone  := case when p_details ? 'customer_phone' then trim(coalesce(p_details->>'customer_phone', '')) else s.customer_phone end;
  v_due    := case when p_details ? 'due_date' then nullif(p_details->>'due_date', '')::date else s.due_date end;
  v_paid   := case when p_details ? 'amount_paid' then (p_details->>'amount_paid')::numeric else s.amount_paid end;

  v_money := v_method is distinct from s.payment_method or v_cust is distinct from s.customer_id
             or v_paid is distinct from s.amount_paid or v_due is distinct from s.due_date;
  if v_money then
    if not app.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
    if exists (select 1 from refunds where sale_id = p_sale) then raise exception 'sale_not_editable'; end if;
  end if;
  if v_method not in ('cash','credit') then raise exception 'invalid_payment_method'; end if;

  if v_cust is not null then
    insert into customers(id, shop_id, name, phone) values (v_cust, v_shop, coalesce(nullif(v_name, ''), 'Customer'), coalesce(v_phone, ''))
      on conflict (id) do nothing;
    if not exists (select 1 from customers where id = v_cust and shop_id = v_shop) then raise exception 'customer_not_in_shop' using errcode = '42501'; end if;
  end if;

  if v_method = 'credit' then
    if v_cust is null then raise exception 'customer_required'; end if;
    if v_name = '' then raise exception 'customer_required'; end if;
    if v_paid < 0 or v_paid > s.total then raise exception 'invalid_deposit'; end if;
    v_bal := s.total - v_paid;
  else
    v_paid := greatest(coalesce(v_paid, s.total), s.total); v_bal := 0; v_due := null;
  end if;

  v_before := jsonb_build_object('payment_method', s.payment_method, 'customer_id', s.customer_id, 'customer_name', s.customer_name,
              'customer_phone', s.customer_phone, 'amount_paid', s.amount_paid, 'balance_due', s.balance_due, 'due_date', s.due_date);
  update sales set payment_method = v_method, customer_id = v_cust, customer_name = v_name, customer_phone = coalesce(v_phone, ''),
         due_date = v_due, amount_paid = v_paid, balance_due = v_bal, edited_at = now(), edited_by = auth.uid()
   where id = p_sale;
  perform app.audit(v_shop, 'sale.edit_details', 'sale', p_sale::text, v_before,
    jsonb_build_object('payment_method', v_method, 'customer_id', v_cust, 'customer_name', v_name, 'customer_phone', v_phone,
                       'amount_paid', v_paid, 'balance_due', v_bal, 'due_date', v_due), p_reason);
  return jsonb_build_object('payment_method', v_method, 'amount_paid', v_paid, 'balance_due', v_bal);
end $$;
revoke all on function edit_sale_details(uuid, jsonb, text) from public, anon;
grant execute on function edit_sale_details(uuid, jsonb, text) to authenticated;
