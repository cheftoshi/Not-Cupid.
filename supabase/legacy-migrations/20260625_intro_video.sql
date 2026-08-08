-- Short profile intro video (optional 15–30s clip). Stored in the existing
-- private `raffle-videos` bucket under a `profile/` prefix; this column holds
-- the stable storage reference while playback uses short-lived signed URLs.
alter table users add column if not exists intro_video_url text;
