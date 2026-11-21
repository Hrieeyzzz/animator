/**
 * A browsable catalog of what Mixamo offers, so a file's purpose can be
 * recognised at a glance and so nothing mixes up "Walking" with "Walking Back".
 *
 * IMPORTANT: Mixamo animations are licensed under Adobe's terms and are not
 * redistributable from here — the app never ships the motion data. This list is
 * only naming/classification metadata, and the link opens mixamo.com where the
 * user downloads the animations to their own machine.
 */

export const MIXAMO_URL = 'https://www.mixamo.com/#/';

/** Search links point at the real site; there is no public Mixamo API. */
export function mixamoSearchUrl(term) {
  return MIXAMO_URL;
}

export const CATEGORIES = [
  'All',
  'Locomotion',
  'Idle',
  'Combat',
  'Dance',
  'Sports',
  'Gestures',
  'Facial',
  'Falls',
];

/**
 * name — as it appears on Mixamo (used for matching uploaded files)
 * cat  — category
 * loop — whether it is designed to loop
 */
export const CATALOG = [
  // Locomotion
  { name: 'Idle', cat: 'Idle', loop: true },
  { name: 'Breathing Idle', cat: 'Idle', loop: true },
  { name: 'Standing Idle', cat: 'Idle', loop: true },
  { name: 'Happy Idle', cat: 'Idle', loop: true },
  { name: 'Bored Idle', cat: 'Idle', loop: true },
  { name: 'Walking', cat: 'Locomotion', loop: true },
  { name: 'Walk With Loop', cat: 'Locomotion', loop: true },
  { name: 'Walking Backwards', cat: 'Locomotion', loop: true },
  { name: 'Walk Stop', cat: 'Locomotion', loop: false },
  { name: 'Walk Turn Left', cat: 'Locomotion', loop: false },
  { name: 'Walk Turn Right', cat: 'Locomotion', loop: false },
  { name: 'Running', cat: 'Locomotion', loop: true },
  { name: 'Run To Stop', cat: 'Locomotion', loop: false },
  { name: 'Jogging', cat: 'Locomotion', loop: true },
  { name: 'Sprinting', cat: 'Locomotion', loop: true },
  { name: 'Walking In Circle', cat: 'Locomotion', loop: true },
  { name: 'Climbing', cat: 'Locomotion', loop: true },
  { name: 'Crouch Walk', cat: 'Locomotion', loop: true },
  { name: 'Crouched Sprint', cat: 'Locomotion', loop: true },
  { name: 'Swimming', cat: 'Locomotion', loop: true },
  { name: 'Crawl', cat: 'Locomotion', loop: true },
  { name: 'Jump', cat: 'Locomotion', loop: false },
  { name: 'Jumping', cat: 'Locomotion', loop: true },
  { name: 'Running Jump', cat: 'Locomotion', loop: false },
  { name: 'Falling', cat: 'Locomotion', loop: true },
  { name: 'Landing', cat: 'Locomotion', loop: false },

  // Combat
  { name: 'Sword Slash', cat: 'Combat', loop: false },
  { name: 'Sword And Shield Slash', cat: 'Combat', loop: false },
  { name: 'Sword And Shield Attack', cat: 'Combat', loop: false },
  { name: 'Punch', cat: 'Combat', loop: false },
  { name: 'Jab', cat: 'Combat', loop: false },
  { name: 'Cross Punch', cat: 'Combat', loop: false },
  { name: 'Hook Punch', cat: 'Combat', loop: false },
  { name: 'Boxing', cat: 'Combat', loop: true },
  { name: 'Kick', cat: 'Combat', loop: false },
  { name: 'Roundhouse Kick', cat: 'Combat', loop: false },
  { name: 'Flying Knee', cat: 'Combat', loop: false },
  { name: 'Punching Bag', cat: 'Combat', loop: true },
  { name: 'Hit Reaction', cat: 'Combat', loop: false },
  { name: 'Death', cat: 'Combat', loop: false },
  { name: 'Dying', cat: 'Combat', loop: false },
  { name: 'Shooting', cat: 'Combat', loop: true },
  { name: 'Reloading', cat: 'Combat', loop: false },
  { name: 'Aiming', cat: 'Combat', loop: true },
  { name: 'Block', cat: 'Combat', loop: true },
  { name: 'Dodge', cat: 'Combat', loop: false },
  { name: 'Roll', cat: 'Combat', loop: false },

  // Dance
  { name: 'Salsa Dancing', cat: 'Dance', loop: true },
  { name: 'Samba Dancing', cat: 'Dance', loop: true },
  { name: 'Hip Hop Dancing', cat: 'Dance', loop: true },
  { name: 'Breakdance', cat: 'Dance', loop: true },
  { name: 'Breakdance Freeze', cat: 'Dance', loop: false },
  { name: 'Robot Dance', cat: 'Dance', loop: true },
  { name: 'Moonwalk', cat: 'Dance', loop: true },
  { name: 'Gangnam Style', cat: 'Dance', loop: true },
  { name: 'Flair', cat: 'Dance', loop: true },
  { name: 'Capoeira', cat: 'Dance', loop: true },
  { name: 'Twist Dance', cat: 'Dance', loop: true },
  { name: 'Snake Hip Hop Dance', cat: 'Dance', loop: true },
  { name: 'Northern Soul Floor Combo', cat: 'Dance', loop: true },
  { name: 'Dancing Twerk', cat: 'Dance', loop: true },
  { name: 'Swing Dancing', cat: 'Dance', loop: true },

  // Sports
  { name: 'Soccer Penalty Kick', cat: 'Sports', loop: false },
  { name: 'Soccer Tackle', cat: 'Sports', loop: false },
  { name: 'Basketball Dribble', cat: 'Sports', loop: true },
  { name: 'Basketball Shoot', cat: 'Sports', loop: false },
  { name: 'Golf Driving', cat: 'Sports', loop: false },
  { name: 'Baseball Batting', cat: 'Sports', loop: false },
  { name: 'Tennis Forehand', cat: 'Sports', loop: false },
  { name: 'Push Up', cat: 'Sports', loop: true },
  { name: 'Sit Up', cat: 'Sports', loop: true },
  { name: 'Jumping Jacks', cat: 'Sports', loop: true },
  { name: 'Burpee', cat: 'Sports', loop: true },
  { name: 'Weightlifting', cat: 'Sports', loop: false },
  { name: 'Rowing', cat: 'Sports', loop: true },
  { name: 'Skateboarding', cat: 'Sports', loop: true },

  // Gestures
  { name: 'Waving', cat: 'Gestures', loop: true },
  { name: 'Greeting', cat: 'Gestures', loop: false },
  { name: 'Agreeing', cat: 'Gestures', loop: false },
  { name: 'Disagreeing', cat: 'Gestures', loop: false },
  { name: 'Head Nod', cat: 'Gestures', loop: false },
  { name: 'Shrugging', cat: 'Gestures', loop: false },
  { name: 'Thumbs Up', cat: 'Gestures', loop: false },
  { name: 'Clapping', cat: 'Gestures', loop: true },
  { name: 'Pointing', cat: 'Gestures', loop: false },
  { name: 'Salute', cat: 'Gestures', loop: false },
  { name: 'Thinking', cat: 'Gestures', loop: true },
  { name: 'Sitting', cat: 'Gestures', loop: true },
  { name: 'Sitting To Stand', cat: 'Gestures', loop: false },
  { name: 'Typing', cat: 'Gestures', loop: true },
  { name: 'Look Around', cat: 'Gestures', loop: true },

  // Facial (comes as separate morph-target FBX files from Mixamo)
  { name: 'Talking', cat: 'Facial', loop: true },
  { name: 'Laughing', cat: 'Facial', loop: true },
  { name: 'Smiling', cat: 'Facial', loop: true },
  { name: 'Angry', cat: 'Facial', loop: true },

  // Falls
  { name: 'Falling Idle', cat: 'Falls', loop: true },
  { name: 'Falling Back', cat: 'Falls', loop: false },
  { name: 'Standing Up', cat: 'Falls', loop: false },
  { name: 'Getting Up', cat: 'Falls', loop: false },
  { name: 'Stumble Backwards', cat: 'Falls', loop: false },
];

/**
 * Guess a catalog entry for a filename such as "mixamo.com_Walking.fbx".
 * Returns {entry, confidence}.
 */
export function describeFile(filename) {
  const clean = filename
    .replace(/\.[^.]+$/, '')
    .replace(/mixamo\.com_?/i, '')
    .replace(/^.*[|]/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = clean.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const entry of CATALOG) {
    const e = entry.name.toLowerCase();
    let score = 0;
    if (lower === e) score = 3;
    else if (lower.includes(e) || e.includes(lower)) score = 2;
    else {
      const words = e.split(' ').filter((w) => w.length > 3);
      const hits = words.filter((w) => lower.includes(w)).length;
      if (words.length && hits === words.length) score = 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return { title: clean, entry: best, confidence: bestScore };
}
