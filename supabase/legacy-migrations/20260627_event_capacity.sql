-- Optional headcount cap for Scene events (null = unlimited). Once the 'yes'
-- count hits the cap, no new 'yes' RSVPs are accepted (enforced in the rsvp route).
alter table friend_activities add column if not exists capacity int;
