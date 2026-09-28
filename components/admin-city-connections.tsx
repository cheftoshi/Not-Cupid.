type CityConnections = {
  metro: string; plans_created: number; hosting_users: number; joined_users: number;
  requested_users: number; confirmed_dates: number; conversations_started: number;
  reciprocal_conversations: number; self_reported_meetups: number; repeat_participants: number; home_viewers: number;
};
export default function AdminCityConnections({ rows }: { rows: CityConnections[] }) {
  return <section aria-label="City connection outcomes">
    <h3>Connection outcomes · last 30 days</h3>
    <p>Real activity, not a conversion cohort. Meetups are optional member reports, not verified attendance. A city is not launch-ready just because it has accounts.</p>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderSpacing: 12, fontSize: 13 }}>
      <thead><tr>{['City', 'Plans', 'Hosts', 'Joined', 'Requested dates', 'Confirmed dates', 'Chats started', 'Two-way chats', 'Meetup reports', 'Repeat participants', 'Home viewers'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.metro}>{[row.metro,row.plans_created,row.hosting_users,row.joined_users,row.requested_users,row.confirmed_dates,row.conversations_started,row.reciprocal_conversations,row.self_reported_meetups,row.repeat_participants,row.home_viewers].map((value, index) => <td key={index}>{value}</td>)}</tr>)}</tbody>
    </table></div>
    {!rows.length && <p>No measured plan activity yet. Seed real invitations before promoting a city.</p>}
  </section>;
}
