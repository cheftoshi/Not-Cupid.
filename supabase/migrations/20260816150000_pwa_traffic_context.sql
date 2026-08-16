-- Privacy-minimal PWA observability. Store only coarse rendering context so
-- traffic audits can distinguish installed-app use from ordinary browser use
-- and spot phone/orientation-specific funnel problems. No model, OS, raw screen
-- dimensions, user-agent, or authenticated identity is collected.
alter table public.page_views
  add column if not exists display_mode text check (display_mode in ('standalone','minimal-ui','fullscreen','browser','unknown')),
  add column if not exists device_class text check (device_class in ('phone','tablet','desktop','unknown')),
  add column if not exists orientation text check (orientation in ('portrait','landscape','unknown'));

create index if not exists page_views_display_mode_created_idx
  on public.page_views (display_mode, created_at desc);
