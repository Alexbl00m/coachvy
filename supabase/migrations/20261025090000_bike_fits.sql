-- Coachvy – bikefit: mätning av sittpositionen, sparad per adept för
-- uppföljning.
--
-- En fit görs ur video (posemodell i coachens webbläsare, mätkedjan i
-- src/lib/bikefit) eller manuellt, där coachen själv för in vinklarna. Båda
-- sparar samma sak: grenens mall och band, de uppmätta vinklarna, cykelns
-- mått, coachens anteckningar och vad som ändrades – så att nästa fit kan
-- jämföras med den här.
--
-- Av videon sparas bara analysvideon (med skelett och kurva) och bilden från
-- nedre dödläget, i den privata hinken `bikefits` under
-- <adept_id>/<fit_id>/. Originalet lämnar aldrig coachens dator.
--
-- Coachen äger fiten och väljer när adepten får se den (shared_at), som med
-- AI-sammanfattningarna. Det avgör databasen, både för raden och filerna.

create table if not exists public.bike_fits (
  id uuid primary key default gen_random_uuid(),
  adept_id uuid not null references public.adepts (id) on delete cascade,
  coach_id uuid default auth.uid() references public.profiles (id) on delete set null,
  performed_on date not null default current_date,
  discipline text not null
    check (discipline in ('landsväg', 'gravel', 'tempo', 'mtb')),
  bike text check (bike is null or char_length(bike) <= 120),
  method text not null check (method in ('video', 'manuell')),
  -- Vinklarna: knee (böjning i nedre dödläget), trunk, elbow, shoulder, hip.
  angles jsonb not null default '{}'::jsonb,
  -- Banden fiten bedömdes mot: mallens, eller coachens egna.
  bands jsonb not null,
  -- Benlängder i mm och varifrån de kom (video, coach).
  legs jsonb not null default '{}'::jsonb,
  -- Cykelns mått, nyckel per mått i mallen.
  measures jsonb not null default '{}'::jsonb,
  -- Videoanalysen i korthet: bildfrekvens, sida, kontroll, kadens, varv.
  analysis jsonb,
  video_path text,
  frame_path text,
  checklist jsonb not null default '{}'::jsonb,
  notes text check (notes is null or char_length(notes) <= 4000),
  changes text check (changes is null or char_length(changes) <= 2000),
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bike_fits_adept_idx
  on public.bike_fits (adept_id, performed_on desc);

comment on table public.bike_fits is
  'Bikefit per adept: grenens band, uppmätta vinklar, cykelns mått och analysvideon. Adepten ser delade fits.';

drop trigger if exists bike_fits_updated_at on public.bike_fits;
create trigger bike_fits_updated_at
  before update on public.bike_fits
  for each row execute function public.set_updated_at();

alter table public.bike_fits enable row level security;

drop policy if exists "Coachen läser, adepten läser delade fits" on public.bike_fits;
create policy "Coachen läser, adepten läser delade fits"
  on public.bike_fits for select
  to authenticated
  using (
    public.is_adept_coach(adept_id)
    or (shared_at is not null and public.can_view_adept(adept_id))
  );

drop policy if exists "Coachen skapar fits" on public.bike_fits;
create policy "Coachen skapar fits"
  on public.bike_fits for insert
  to authenticated
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coachen ändrar fits" on public.bike_fits;
create policy "Coachen ändrar fits"
  on public.bike_fits for update
  to authenticated
  using (public.is_adept_coach(adept_id))
  with check (public.is_adept_coach(adept_id));

drop policy if exists "Coachen tar bort fits" on public.bike_fits;
create policy "Coachen tar bort fits"
  on public.bike_fits for delete
  to authenticated
  using (public.is_adept_coach(adept_id));

-- ---------------------------------------------------------------------------
-- Filerna: privat hink, sökväg <adept_id>/<fit_id>/<fil>.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'bikefits',
      'bikefits',
      false,
      52428800,
      array['video/mp4', 'video/webm', 'image/jpeg', 'image/png']
    )
    on conflict (id) do nothing;

    execute $p$
      drop policy if exists "Läs bikefitfiler som fiten får läsas" on storage.objects;
      create policy "Läs bikefitfiler som fiten får läsas"
        on storage.objects for select
        to authenticated
        using (
          bucket_id = 'bikefits'
          and exists (
            select 1 from public.bike_fits f
            where f.id::text = (storage.foldername(name))[2]
              and f.adept_id::text = (storage.foldername(name))[1]
              and (
                public.is_adept_coach(f.adept_id)
                or (f.shared_at is not null and public.can_view_adept(f.adept_id))
              )
          )
        );

      drop policy if exists "Coachen laddar upp bikefitfiler" on storage.objects;
      create policy "Coachen laddar upp bikefitfiler"
        on storage.objects for insert
        to authenticated
        with check (
          bucket_id = 'bikefits'
          and public.is_adept_coach(((storage.foldername(name))[1])::uuid)
        );

      drop policy if exists "Coachen ersätter bikefitfiler" on storage.objects;
      create policy "Coachen ersätter bikefitfiler"
        on storage.objects for update
        to authenticated
        using (
          bucket_id = 'bikefits'
          and public.is_adept_coach(((storage.foldername(name))[1])::uuid)
        );

      drop policy if exists "Coachen tar bort bikefitfiler" on storage.objects;
      create policy "Coachen tar bort bikefitfiler"
        on storage.objects for delete
        to authenticated
        using (
          bucket_id = 'bikefits'
          and public.is_adept_coach(((storage.foldername(name))[1])::uuid)
        );
    $p$;
  end if;
end
$$;
