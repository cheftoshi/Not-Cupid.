-- Quiz v2: attachment style + values, the dimensions the research says actually
-- predict compatibility (vs. HEXACO trait similarity, which doesn't).
alter table users add column if not exists attach_anxiety int;       -- 0–100
alter table users add column if not exists attach_avoidance int;     -- 0–100
alter table users add column if not exists attach_style text;        -- secure|anxious|avoidant|fearful
alter table users add column if not exists values_profile jsonb;     -- { kids, faith, politics, ambition, lifestyle, substances }
