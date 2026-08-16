-- Add first-party milestones inside the Dating Experiment form. These remain
-- private service-role-only events and retain one row per user/stage so repeat
-- renders, retries, and back-navigation cannot inflate the funnel.
alter table public.campaign_funnel_events
  drop constraint if exists campaign_funnel_events_event_check;

alter table public.campaign_funnel_events
  add constraint campaign_funnel_events_event_check check (event in (
    'email_clicked',
    'profile_started',
    'profile_saved',
    'profile_eligible',
    'experiment_viewed',
    'rules_continued',
    'preferences_completed',
    'schedule_selected',
    'questionnaire_completed',
    'consent_completed',
    'entry_submit_attempted',
    'entry_submit_failed',
    'entry_submitted'
  ));
