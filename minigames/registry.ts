export type MinigameId = 'sky-roll' | 'fruit-pop' | 'memory-match';

export interface MinigameDefinition {
  id: MinigameId;
  title: string;
  subtitle: string;
  emoji: string;
  badge: string;
  ageTag: string;
  gradient: string;
  borderColor: string;
  status: 'playable' | 'coming_soon';
}

export const MINIGAMES_REGISTRY: MinigameDefinition[] = [
  {
    id: 'sky-roll',
    title: 'Fruit Sky Roll',
    subtitle:
      'Roll cute 3D Fruit Balls across sunny sky tracks, bounce over clouds, dodge windmills & collect Golden Seeds!',
    emoji: '🍊',
    badge: '3D PLAYABLE',
    ageTag: 'Ages 3–10+',
    gradient: 'from-sky-500 via-cyan-500 to-emerald-500',
    borderColor: 'border-sky-200',
    status: 'playable',
  },
  {
    id: 'fruit-pop',
    title: 'Fruit Pop Splash',
    subtitle:
      'Pop floating rainbow fruit bubbles before they drift into the clouds!',
    emoji: '🫧',
    badge: 'PLAYABLE',
    ageTag: 'Ages 3–8',
    gradient: 'from-pink-400 via-rose-400 to-amber-400',
    borderColor: 'border-pink-200',
    status: 'playable',
  },
  {
    id: 'memory-match',
    title: 'Smoothie Memory Match',
    subtitle:
      'Flip cozy wooden fruit tiles to match pairs and blend yummy smoothies!',
    emoji: '🍓',
    badge: 'PLAYABLE',
    ageTag: 'Ages 3–8',
    gradient: 'from-violet-400 via-purple-400 to-fuchsia-400',
    borderColor: 'border-violet-200',
    status: 'playable',
  },
];
