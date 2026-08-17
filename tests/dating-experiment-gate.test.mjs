import test from 'node:test';
import assert from 'node:assert/strict';
import { datingExperimentGateIssues } from '../lib/dating-experiment-gate.ts';

const ready = {
  photo: true,
  quiz: true,
  bio: true,
  interests: 3,
  age: 30,
  gender: 'f',
  orientation: 'bisexual',
  seekingGenders: ['m', 'nb'],
  ageMin: 25,
  ageMax: 40,
  availableSlotKeys: ['aug20-1830'],
  intention: 'relationship',
  energy: 'conversation',
  planningStyle: 'planned',
  conversationStarter: 'Ask me about old bookstores',
  attendanceConfirmed: true,
  termsAccepted: true,
  previewConsent: true,
  safetyAcknowledged: true,
};

test('a complete Dating Experiment entry has no UX gate issues', () => {
  assert.deepEqual(datingExperimentGateIssues(ready), []);
});

test('the UX gate reports every missing requirement in journey order', () => {
  const issues = datingExperimentGateIssues({
    ...ready,
    photo: false,
    quiz: false,
    bio: false,
    interests: 0,
    age: null,
    gender: '',
    orientation: '',
    seekingGenders: [],
    ageMin: 20,
    ageMax: 100,
    availableSlotKeys: [],
    intention: '',
    energy: '',
    planningStyle: '',
    conversationStarter: '  ',
    attendanceConfirmed: false,
    termsAccepted: false,
    previewConsent: false,
    safetyAcknowledged: false,
  });

  assert.equal(issues.length, 18);
  assert.deepEqual(issues.map((issue) => issue.targetId), [
    'experiment-cred-photo',
    'experiment-cred-quiz',
    'experiment-cred-bio',
    'experiment-cred-interests',
    'experiment-cred-age',
    'experiment-gender',
    'experiment-orientation',
    'experiment-seeking',
    'experiment-age-range',
    'experiment-schedule',
    'experiment-intention',
    'experiment-energy',
    'experiment-planning',
    'experiment-conversation',
    'experiment-attendance',
    'experiment-terms',
    'experiment-preview',
    'experiment-safety',
  ]);
});

test('the UX gate isolates exact schedule and consent blockers', () => {
  const issues = datingExperimentGateIssues({
    ...ready,
    availableSlotKeys: [],
    previewConsent: false,
  });

  assert.deepEqual(issues.map(({ key, label }) => ({ key, label })), [
    { key: 'schedule', label: 'Choose at least one dinner time' },
    { key: 'preview', label: 'Consent to the private shortlist preview' },
  ]);
});
