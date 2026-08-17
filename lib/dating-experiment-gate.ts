export type DatingExperimentGateInput = {
  photo: boolean;
  quiz: boolean;
  bio: boolean;
  interests: number;
  age: number | null;
  gender: string;
  orientation: string;
  seekingGenders: string[];
  ageMin: number;
  ageMax: number;
  availableSlotKeys: string[];
  intention: string;
  energy: string;
  planningStyle: string;
  conversationStarter: string;
  attendanceConfirmed: boolean;
  termsAccepted: boolean;
  previewConsent: boolean;
  safetyAcknowledged: boolean;
};

export type DatingExperimentGateIssue = {
  key: string;
  label: string;
  targetId: string;
  group: 'profile' | 'preferences' | 'questionnaire' | 'consent';
};

export function datingExperimentGateIssues(input: DatingExperimentGateInput): DatingExperimentGateIssue[] {
  const validAgeRange = Number.isInteger(input.ageMin)
    && Number.isInteger(input.ageMax)
    && input.ageMin >= 21
    && input.ageMin <= 99
    && input.ageMax >= input.ageMin
    && input.ageMax <= 99;

  return [
    !input.photo && { key: 'photo', label: 'Add a profile photo', targetId: 'experiment-cred-photo', group: 'profile' as const },
    !input.quiz && { key: 'quiz', label: 'Complete the personality quiz', targetId: 'experiment-cred-quiz', group: 'profile' as const },
    !input.bio && { key: 'bio', label: 'Add a short bio', targetId: 'experiment-cred-bio', group: 'profile' as const },
    input.interests < 3 && { key: 'interests', label: 'Add at least 3 interests', targetId: 'experiment-cred-interests', group: 'profile' as const },
    (input.age == null || input.age < 21) && { key: 'age', label: 'Confirm your age is 21+', targetId: 'experiment-cred-age', group: 'profile' as const },
    !input.gender && { key: 'gender', label: 'Choose how you identify', targetId: 'experiment-gender', group: 'preferences' as const },
    !input.orientation && { key: 'orientation', label: 'Choose an orientation label', targetId: 'experiment-orientation', group: 'preferences' as const },
    input.seekingGenders.length === 0 && { key: 'seeking', label: 'Choose at least one gender you want to meet', targetId: 'experiment-seeking', group: 'preferences' as const },
    !validAgeRange && { key: 'age-range', label: 'Choose a valid age range from 21 to 99', targetId: 'experiment-age-range', group: 'preferences' as const },
    input.availableSlotKeys.length === 0 && { key: 'schedule', label: 'Choose at least one dinner time', targetId: 'experiment-schedule', group: 'preferences' as const },
    !input.intention && { key: 'intention', label: 'Choose what you’re hoping for', targetId: 'experiment-intention', group: 'questionnaire' as const },
    !input.energy && { key: 'energy', label: 'Choose your ideal dinner energy', targetId: 'experiment-energy', group: 'questionnaire' as const },
    !input.planningStyle && { key: 'planning', label: 'Choose how you like plans to happen', targetId: 'experiment-planning', group: 'questionnaire' as const },
    input.conversationStarter.trim().length < 3 && { key: 'conversation', label: 'Add a conversation starter', targetId: 'experiment-conversation', group: 'questionnaire' as const },
    !input.attendanceConfirmed && { key: 'attendance', label: 'Confirm your age, location, and availability', targetId: 'experiment-attendance', group: 'consent' as const },
    !input.termsAccepted && { key: 'terms', label: 'Accept the Dating Experiment Terms', targetId: 'experiment-terms', group: 'consent' as const },
    !input.previewConsent && { key: 'preview', label: 'Consent to the private shortlist preview', targetId: 'experiment-preview', group: 'consent' as const },
    !input.safetyAcknowledged && { key: 'safety', label: 'Acknowledge the safety notice', targetId: 'experiment-safety', group: 'consent' as const },
  ].filter((issue): issue is DatingExperimentGateIssue => Boolean(issue));
}
