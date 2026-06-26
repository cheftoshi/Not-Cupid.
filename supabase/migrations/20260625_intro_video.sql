-- Short profile intro video (optional 15–30s clip). Stored in the existing
-- public `raffle-videos` bucket under a `profile/` prefix; this column just
-- holds the public URL.
alter table users add column if not exists intro_video_url text;
