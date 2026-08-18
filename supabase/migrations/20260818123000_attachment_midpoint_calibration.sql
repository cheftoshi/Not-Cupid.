-- The attachment scores use a 0..100 scale where 50 is neutral. The original
-- categorical projection treated the neutral midpoint as "high", which made
-- neutral/neutral profiles fearful-avoidant and overstated a second dimension
-- when either score landed exactly on 50. Keep stored labels aligned with the
-- corrected application projection for existing profiles.
update public.users
set attach_style = case
  when attach_anxiety > 50 and attach_avoidance > 50 then 'fearful'
  when attach_anxiety > 50 then 'anxious'
  when attach_avoidance > 50 then 'avoidant'
  else 'secure'
end
where attach_anxiety is not null
  and attach_avoidance is not null
  and attach_style is distinct from case
    when attach_anxiety > 50 and attach_avoidance > 50 then 'fearful'
    when attach_anxiety > 50 then 'anxious'
    when attach_avoidance > 50 then 'avoidant'
    else 'secure'
  end;
