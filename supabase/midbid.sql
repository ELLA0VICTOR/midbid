create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.midbid_auctions (
  id text primary key,
  title text not null,
  brief text not null default '',
  reserve text not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  creator_account text,
  settlement_account text not null,
  manifest_hash text not null,
  protocol_version text not null default 'midbid-sealed-v1',
  privacy text not null default 'private-note',
  image_data_url text not null default '',
  image_name text not null default '',
  vault_kind text not null default 'wallet',
  status text not null default 'pending',
  winner jsonb,
  revealed_at timestamptz,
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint midbid_auctions_status_check check (status in ('pending', 'revealed'))
);

alter table public.midbid_auctions
add column if not exists bid_public_key jsonb;

alter table public.midbid_auctions
add column if not exists creator_account text;

create table if not exists public.midbid_bid_receipts (
  id text primary key,
  auction_id text not null references public.midbid_auctions(id) on delete cascade,
  commitment text not null,
  encrypted_payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.midbid_auctions enable row level security;
alter table public.midbid_bid_receipts enable row level security;

drop policy if exists "midbid auctions are publicly readable" on public.midbid_auctions;
create policy "midbid auctions are publicly readable"
on public.midbid_auctions
for select
to anon
using (true);

drop policy if exists "midbid auctions can be created from the app" on public.midbid_auctions;
create policy "midbid auctions can be created from the app"
on public.midbid_auctions
for insert
to anon
with check (
  status = 'pending'
  and winner is null
  and revealed_at is null
);

drop policy if exists "midbid bid receipts are publicly readable" on public.midbid_bid_receipts;
create policy "midbid bid receipts are publicly readable"
on public.midbid_bid_receipts
for select
to anon
using (true);

drop policy if exists "midbid bid receipts can be created from the app" on public.midbid_bid_receipts;
create policy "midbid bid receipts can be created from the app"
on public.midbid_bid_receipts
for insert
to anon
with check (true);

drop function if exists public.reveal_midbid_auction(text, text, jsonb);
drop function if exists public.reveal_midbid_auction(text, text, text, jsonb);

create or replace function public.reveal_midbid_auction(
  p_auction_id text,
  p_edit_token text,
  p_actor_account text,
  p_winner jsonb
)
returns public.midbid_auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.midbid_auctions;
begin
  update public.midbid_auctions
  set
    winner = p_winner,
    revealed_at = now(),
    status = 'revealed',
    updated_at = now()
  where id = p_auction_id
    and edit_token_hash = encode(extensions.digest(p_edit_token, 'sha256'), 'hex')
    and coalesce(creator_account, settlement_account) = p_actor_account
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'invalid auction edit token';
  end if;

  return updated_row;
end;
$$;

grant execute on function public.reveal_midbid_auction(text, text, text, jsonb) to anon;

drop function if exists public.delete_midbid_auction(text, text);
drop function if exists public.delete_midbid_auction(text, text, text);

create or replace function public.delete_midbid_auction(
  p_auction_id text,
  p_edit_token text,
  p_actor_account text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id text;
begin
  delete from public.midbid_auctions
  where id = p_auction_id
    and edit_token_hash = encode(extensions.digest(p_edit_token, 'sha256'), 'hex')
    and coalesce(creator_account, settlement_account) = p_actor_account
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'invalid auction edit token';
  end if;

  return deleted_id;
end;
$$;

grant execute on function public.delete_midbid_auction(text, text, text) to anon;

notify pgrst, 'reload schema';
