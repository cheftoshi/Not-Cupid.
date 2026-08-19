// Backward-compatible alias for the one canonical, fully paginated admin
// snapshot. Keeping a second stats implementation caused real/test filtering
// and revenue totals to disagree depending on which URL an operator opened.
export const dynamic = 'force-dynamic';
export { GET } from '../../admin-stats/route';
