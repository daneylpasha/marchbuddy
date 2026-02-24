export type TriggerTheme =
  | 'health_scare'
  | 'photo_moment'
  | 'family'
  | 'event'
  | 'feeling'
  | 'inspiration'
  | 'fed_up'
  | 'other';

export type FailureTheme =
  | 'busy'
  | 'bored'
  | 'injury'
  | 'too_hard'
  | 'no_results'
  | 'life_event'
  | 'no_accountability'
  | 'other';

const TRIGGER_KEYWORDS: Record<Exclude<TriggerTheme, 'other'>, string[]> = {
  health_scare: [
    'doctor', 'health', 'diagnosis', 'blood pressure', 'cholesterol',
    'test results', 'checkup', 'hospital', 'medication', 'warning', 'medical',
  ],
  photo_moment: [
    'photo', 'picture', 'mirror', 'reflection', 'saw myself', "didn't recognize",
    'didnt recognize', 'shocked', 'image', 'video', 'camera',
  ],
  family: [
    'kids', 'children', 'son', 'daughter', 'family', 'keep up',
    'play with', 'grandkids', 'wife', 'husband', 'partner', 'baby',
  ],
  event: [
    'wedding', 'reunion', 'vacation', 'trip', 'birthday', 'holiday',
    'summer', 'beach', 'event', 'anniversary', 'graduation',
  ],
  feeling: [
    'tired', 'exhausted', 'low energy', 'sluggish', 'unhealthy',
    "hate how i feel", "don't feel", 'awful', 'miserable', 'drained',
    'lethargic', 'depressed', 'down',
  ],
  inspiration: [
    'friend', 'colleague', 'saw someone', 'inspired', 'coworker',
    'neighbor', 'watched', 'instagram', 'youtube',
  ],
  fed_up: [
    'enough', 'sick of', 'fed up', 'frustrated', "can't keep",
    'done with', 'had it', 'tired of being', 'over it',
  ],
};

const FAILURE_KEYWORDS: Record<Exclude<FailureTheme, 'other'>, string[]> = {
  busy: [
    'busy', 'time', 'schedule', 'work', 'no time', 'too busy',
    'crazy', 'hectic', 'overwhelmed', 'commitments',
  ],
  bored: [
    'bored', 'boring', 'lost interest', 'same thing', 'repetitive',
    'tedious', 'monoton', 'dull',
  ],
  injury: [
    'injury', 'hurt', 'pain', 'knee', 'back', 'ankle', 'injured',
    'strain', 'sprain', 'pulled', 'sore', 'physical',
  ],
  too_hard: [
    'too hard', "couldn't keep up", 'discouraged', 'impossible',
    'failed', 'overwhelming', 'too much', 'too intense', 'gave up',
  ],
  no_results: [
    'no results', "didn't see", "wasn't working", 'waste',
    'nothing changed', 'pointless', 'plateau', 'not working',
  ],
  life_event: [
    'moved', 'baby', 'job', 'divorce', 'death', 'loss',
    'life happened', 'circumstances', 'covid', 'pandemic', 'relationship',
  ],
  no_accountability: [
    'alone', 'no one', 'accountability', 'forgot', 'slipped',
    'just stopped', 'drifted', 'no support', 'by myself',
  ],
};

function detectTheme<T extends string>(
  text: string,
  keywords: Record<string, string[]>,
  fallback: T,
): T {
  const lower = text.toLowerCase();
  for (const [theme, words] of Object.entries(keywords)) {
    if (words.some((w) => lower.includes(w))) {
      return theme as T;
    }
  }
  return fallback;
}

export function detectTriggerTheme(text: string): TriggerTheme {
  return detectTheme(text, TRIGGER_KEYWORDS, 'other');
}

export function detectFailureTheme(text: string): FailureTheme {
  return detectTheme(text, FAILURE_KEYWORDS, 'other');
}

export type FearTheme =
  | 'failing_again'
  | 'being_seen'
  | 'physical_inability'
  | 'quitting'
  | 'age_weight'
  | 'injury'
  | 'judgment'
  | 'other';

const FEAR_KEYWORDS: Record<Exclude<FearTheme, 'other'>, string[]> = {
  failing_again: [
    'fail', 'again', 'another', 'quit again', 'give up',
    "won't stick", 'wont stick', "can't commit", 'cant commit',
    'same as before', 'like always',
  ],
  being_seen: [
    'see me', 'people', 'embarrassed', 'laugh', 'look at me',
    'public', 'outside', 'others',
  ],
  physical_inability: [
    "can't do it", 'cant do it', 'too unfit', 'not able',
    "body can't", "body cant", 'physically', "won't be able",
    'wont be able', 'incapable', 'too weak',
  ],
  quitting: [
    'quit', 'stop', 'give up', "won't finish", 'wont finish',
    'halfway', 'drop out', 'abandon',
  ],
  age_weight: [
    'too old', 'too fat', 'too heavy', 'my age', 'overweight',
    'out of shape', 'my weight', 'my size',
  ],
  injury: [
    'hurt', 'injury', 'pain', 'knees', 'back', 'joints',
    'damage', 'make it worse',
  ],
  judgment: [
    'judge', 'think of me', 'opinions', 'what people',
    'others think', 'embarrassing',
  ],
};

export function detectFearTheme(text: string): FearTheme {
  return detectTheme(text, FEAR_KEYWORDS, 'other');
}

export type AnchorTheme =
  | 'kids'
  | 'partner'
  | 'parents'
  | 'family_general'
  | 'future_self'
  | 'self_only'
  | 'other';

const ANCHOR_KEYWORDS: Record<Exclude<AnchorTheme, 'other'>, string[]> = {
  kids: [
    'kids', 'children', 'son', 'daughter', 'child', 'keep up with them',
    'play with', 'grandkids', 'grandchildren', 'little ones',
  ],
  partner: [
    'wife', 'husband', 'partner', 'spouse', 'girlfriend', 'boyfriend',
    'relationship', 'marriage',
  ],
  parents: [
    'mom', 'dad', 'mother', 'father', 'parents', 'parent',
  ],
  family_general: [
    'family', 'loved ones', 'everyone', 'people who', 'those who care',
  ],
  future_self: [
    'future', 'older', 'years from now', 'when im', 'down the road',
    'later in life', 'future me', 'future self',
  ],
  self_only: [
    'just me', 'only me', 'no one else', 'just for me', 'myself only',
  ],
};

export function detectAnchorTheme(text: string): AnchorTheme {
  return detectTheme(text, ANCHOR_KEYWORDS, 'other');
}
