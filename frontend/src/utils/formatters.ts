export interface ParsedTrial {
  subject: string;
  description: string;
  fullLabel: string;
  tags: string[];
  run: string;
}

/** Dictionary of known study display names */
const STUDY_NAME_MAP: Record<string, string> = {
  All: 'All Studies',
  ContactlessPushing: 'Contactless Pushing',
  Cornering: 'Cornering',
  FollowingAccompaniedLeader: 'Following Accompanied Leader',
  FollowingFidelity: 'Following Fidelity',
  Hysteresis: 'Hysteresis',
  ObstacleNavigation: 'Obstacle Navigation',
  OvertakingBypassing: 'Overtaking & Bypassing',
  ReadingWallIntentions: 'Reading Wall Intentions',
  SizeImpact: 'Size Impact',
  SwitchingTravelModes: 'Switching Travel Modes',
};

/** Formats PascalCase / CamelCase study names into spaced titles */
export function formatStudyName(study: string): string {
  if (STUDY_NAME_MAP[study]) return STUDY_NAME_MAP[study];
  return study.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

const KNOWN_STUDIES = [
  'contactlesspushing',
  'cornering',
  'followingaccompaniedleader',
  'followingfidelity',
  'hysteresis',
  'obstaclenavigation',
  'overtakingbypassing',
  'readingwallintentions',
  'sizeimpact',
  'switchingtravelmodes',
];

const NUMBER_WORDS: Record<string, string> = {
  one: '#1',
  two: '#2',
  three: '#3',
  four: '#4',
  five: '#5',
  six: '#6',
};

const TAG_MAP: Record<string, string> = {
  '1p': '1-Person',
  '2p': '2-Person',
  '90': '90°',
  '45': '45°',
  '135': '135°',
  '90turn': '90° Turn',
  sharpturn: 'Sharp Turn',
  slightturn: 'Slight Turn',
  downandback: 'Down & Back',
  narrowchicane: 'Narrow Chicane',
  widechicane: 'Wide Chicane',
  propperson: 'Prop Person',
  noprop: 'No Prop',
  largecart: 'Large Cart',
  smallcart: 'Small Cart',
};

/** Parses raw MoCap parquet filenames into structured human-readable metadata */
export function parseTrialMetadata(filename: string): ParsedTrial {
  const raw = filename.split('/').pop()?.replace('.parquet', '').trim() || filename;

  // 1. Extract trial ID/number suffix (e.g., -AK-21, -AA-40, _One, _1)
  let runLabel = '';
  let cleanRaw = raw;

  const codeMatch = cleanRaw.match(/-[A-Za-z]{2,3}-(\d+)$/);
  if (codeMatch) {
    runLabel = `#${codeMatch[1]}`;
    cleanRaw = cleanRaw.slice(0, codeMatch.index);
  } else {
    const wordMatch = cleanRaw.match(/_(one|two|three|four|five|\d+)$/i);
    if (wordMatch) {
      const w = wordMatch[1].toLowerCase();
      runLabel = NUMBER_WORDS[w] || `#${w}`;
      cleanRaw = cleanRaw.slice(0, wordMatch.index);
    }
  }

  // 2. Tokenize remaining segments
  const tokens = cleanRaw.split('_').filter(Boolean);

  let subject = 'General';
  let conditionTokens: string[] = [];

  if (tokens.length > 0) {
    const firstLower = tokens[0].toLowerCase();
    if (KNOWN_STUDIES.some((s) => firstLower.includes(s))) {
      // Format: Study_Subject_Condition... (e.g. ReadingWallIntentions_Ben_Cart_90)
      subject = tokens[1] || 'General';
      conditionTokens = tokens.slice(2);
    } else {
      // Format: Subject_Study_Condition... (e.g. Akash_ContactlessPushing_2p_...)
      subject = tokens[0];
      conditionTokens = tokens.slice(1).filter((t) => !KNOWN_STUDIES.some((s) => t.toLowerCase().includes(s)));
    }
  }

  // 3. Format condition tags
  const cleanTags: string[] = [];
  for (const t of conditionTokens) {
    const tLow = t.toLowerCase();
    if (tLow === 'persontoperson' || tLow === 'persontorobot') continue;
    if (TAG_MAP[tLow]) {
      cleanTags.push(TAG_MAP[tLow]);
    } else {
      cleanTags.push(t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim());
    }
  }

  const desc = cleanTags.length > 0 ? cleanTags.join(' · ') : 'Baseline';
  const descWithRun = runLabel ? `${desc} (${runLabel})` : desc;
  const fullLabel = subject !== 'General' ? `${subject} — ${descWithRun}` : descWithRun;

  return {
    subject,
    description: descWithRun,
    fullLabel,
    tags: cleanTags,
    run: runLabel,
  };
}