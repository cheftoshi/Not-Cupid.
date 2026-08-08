-- Events can tag a specific place/venue (free text), on top of the zone/area.
-- The area drives discovery (City Pulse zones); the location is the meeting spot.
alter table friend_activities add column if not exists location text;
