export type RecoverableMessage = { id: string; body: string; clientId?: string | null; pending?: boolean; failed?: boolean; isMe?: boolean };

/** Polls must not erase unsent text. Match acknowledgements by id, never body. */
export function reconcileMessages<T extends RecoverableMessage>(local: T[], server: T[]): T[] {
  const acknowledged = new Set(server.flatMap(message => [message.id, message.clientId].filter(Boolean)));
  return [...server, ...local.filter(message =>
    (message.pending || message.failed) && !acknowledged.has(message.clientId || message.id)
  )];
}
