type SupabasePage<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

export const SUPABASE_PAGE_SIZE = 1000;

/**
 * Fetch every row from a server-only Supabase query without relying on the
 * project's Data API row ceiling. Callers are responsible for applying a
 * deterministic order before range() so concurrent inserts cannot reshuffle
 * pages that have already been read.
 */
export async function fetchAllSupabaseRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error('Supabase page size must be a positive integer');
  }

  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message || 'Supabase paginated query failed');

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
