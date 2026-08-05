export type RealmSubject = {
  is_test?: boolean | null;
};

export function isTestRealm(subject: RealmSubject | null | undefined): boolean {
  return subject?.is_test === true;
}

export function sameRealm(
  first: RealmSubject | null | undefined,
  second: RealmSubject | null | undefined,
): boolean {
  return isTestRealm(first) === isTestRealm(second);
}
