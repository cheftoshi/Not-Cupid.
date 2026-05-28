-- Allow the new ended_reason values from the end-match flow.
-- The original matches_status_check rejected 'ghosted' / 'not_vibing' / 'user_ended'.

alter table matches drop constraint if exists matches_status_check;

alter table matches add constraint matches_status_check
  check (status in (
    'pending',
    'both_accepted',
    'active',
    'passed',
    'ended',
    'expired',
    'matched'
  ));

alter table matches drop constraint if exists matches_ended_reason_check;

alter table matches add constraint matches_ended_reason_check
  check (
    ended_reason is null or ended_reason in (
      'expired',
      'one_passed',
      'mutual_pass',
      'completed',
      'user_deleted',
      'user_ended',
      'ghosted',
      'not_vibing',
      'user_requiz'
    )
  );
