create extension if not exists pgcrypto;

create table if not exists public.resumes (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    summary text not null,
    file_name text not null,
    file_url text not null,
    storage_path text not null,
    preview_image_url text,
    preview_storage_path text,
    mime_type text not null default 'application/pdf',
    file_size bigint not null default 0 check (file_size >= 0),
    is_active boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.resumes
    add column if not exists preview_image_url text,
    add column if not exists preview_storage_path text;

create or replace function public.handle_resumes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists set_resumes_updated_at on public.resumes;
create trigger set_resumes_updated_at
before update on public.resumes
for each row
execute function public.handle_resumes_updated_at();

with duplicate_active_resumes as (
    select id,
           row_number() over (order by updated_at desc, created_at desc, id desc) as row_num
    from public.resumes
    where is_active = true
)
update public.resumes
set is_active = false
where id in (
    select id
    from duplicate_active_resumes
    where row_num > 1
);

create unique index if not exists resumes_single_active_idx
on public.resumes (is_active)
where is_active = true;

create index if not exists resumes_updated_at_idx
on public.resumes (updated_at desc);

create or replace function public.set_active_resume(p_resume_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1
        from public.resumes
        where id = p_resume_id
    ) then
        raise exception 'Resume not found';
    end if;

    update public.resumes
    set is_active = (id = p_resume_id)
    where is_active = true or id = p_resume_id;
end;
$$;

revoke all on function public.set_active_resume(uuid) from public;
grant execute on function public.set_active_resume(uuid) to authenticated;
grant execute on function public.set_active_resume(uuid) to service_role;

alter table public.resumes enable row level security;

drop policy if exists "Public can read active resumes" on public.resumes;
create policy "Public can read active resumes"
on public.resumes
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can manage resumes" on public.resumes;
create policy "Authenticated users can manage resumes"
on public.resumes
for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'resumes',
    'resumes',
    true,
    10485760,
    array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read resume files" on storage.objects;
create policy "Public can read resume files"
on storage.objects
for select
to anon
using (bucket_id = 'resumes');

drop policy if exists "Authenticated users can upload resume files" on storage.objects;
create policy "Authenticated users can upload resume files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'resumes');

drop policy if exists "Authenticated users can update resume files" on storage.objects;
create policy "Authenticated users can update resume files"
on storage.objects
for update
to authenticated
using (bucket_id = 'resumes')
with check (bucket_id = 'resumes');

drop policy if exists "Authenticated users can delete resume files" on storage.objects;
create policy "Authenticated users can delete resume files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'resumes');
