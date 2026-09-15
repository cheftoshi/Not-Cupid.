type ActionableConnection = { status: 'chatting' | 'waiting' | 'your-move'; unread: boolean; needsStarter: boolean };
export function connectionPriority(connection: ActionableConnection): number {
  if (connection.status === 'your-move') return 0;
  if (connection.unread) return 1;
  if (connection.needsStarter) return 2;
  return connection.status === 'chatting' ? 3 : 4;
}
