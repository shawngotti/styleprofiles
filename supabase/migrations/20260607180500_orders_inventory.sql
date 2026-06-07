-- Batch 10 tickets 2-3 — orders + inventory.
-- mark_order_paid() is the single, idempotent place an order becomes 'paid':
-- it locks the order, and for stock-tracked products decrements inventory,
-- refusing to oversell. Called by confirm_order (immediate UX) and by the
-- Stripe webhook (authoritative) — both via service role; running twice is a
-- no-op because it only acts on a 'pending' order.

create or replace function public.mark_order_paid(_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _status order_status;
  _it record;
begin
  -- Lock the order row so concurrent webhook + confirm calls serialize.
  select status into _status from public.orders where id = _order_id for update;
  if _status is null then
    raise exception 'order not found';
  end if;
  if _status <> 'pending' then
    return _status::text;  -- already settled; idempotent no-op
  end if;

  -- Decrement stock-tracked inventory, refusing to oversell.
  for _it in
    select oi.product_id, oi.qty, p.inventory_qty, p.name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = _order_id
    for update of p
  loop
    if _it.inventory_qty is not null then
      if _it.inventory_qty < _it.qty then
        raise exception 'insufficient stock for %', _it.name;
      end if;
      update public.products
        set inventory_qty = inventory_qty - _it.qty
        where id = _it.product_id;
    end if;
  end loop;

  update public.orders set status = 'paid' where id = _order_id;
  return 'paid';
end;
$$;

revoke all on function public.mark_order_paid(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid) to service_role;
