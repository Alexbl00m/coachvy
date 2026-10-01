-- Coachvy – när adepten bjöds in till appen.
--
-- Appen skickar inga mejl själv; coachen kopierar inbjudan och skickar den.
-- Tidpunkten sätts när coachen kopierar texten eller öppnar mejlet, så att
-- adeptlistan kan visa vem som fått en inbjudan och vem som inte hörts av.
-- Kontot och samtycket syns redan i profilen – det här är bara kontakten.

alter table public.adepts
  add column if not exists invited_at timestamptz;

comment on column public.adepts.invited_at is
  'Senast coachen kopierade eller mejlade inbjudan till appen.';
