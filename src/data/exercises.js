/**
 * Extensible metadata repository for workout exercises.
 * New exercises or camera/posture detection models can be registered here.
 */
export const exercises = [
  {
    id: 'dumbbell-deadlift',
    name: 'Dumbbell Deadlift',
    category: 'Lower Body / Posterior Chain',
    targetMuscle: 'Glutes, Hamstrings, Lower Back, Core',
    description: 'A fundamental compound movement that strengthens the posterior chain, glutes, and core using dumbbells.',
    difficulty: 'Intermediate',
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 16,
    modelId: 'db_deadlift_v1',
    instructions: [
      'Stand with feet hip-width apart, holding dumbbells in front of your thighs with palms facing you.',
      'Keep your spine neutral, shoulders pulled back, and core tight.',
      'Hinge at your hips, pushing your butt back, and lower the dumbbells along the front of your legs.',
      'Lower the weights until you feel a stretch in your hamstrings (usually mid-shin level). Keep knees slightly bent.',
      'Drive through your heels and squeeze your glutes to return to the starting upright position.'
    ],
    tips: [
      'Avoid rounding your lower back at the bottom of the movement.',
      'Keep the weights close to your legs throughout the lift to protect your lower back.'
    ]
  },
  {
    id: 'dumbbell-hammer-curl',
    name: 'Dumbbell Hammer Curl',
    category: 'Arms / Pull',
    targetMuscle: 'Biceps Brachii, Brachialis, Brachioradialis (Forearms)',
    description: 'An isolation exercise that builds thickness and strength in the biceps and forearms using a neutral grip.',
    difficulty: 'Beginner',
    defaultSets: 3,
    defaultReps: 12,
    defaultWeightKg: 10,
    modelId: 'db_hammer_curl_v1',
    instructions: [
      'Stand tall with feet shoulder-width apart, holding dumbbells at your sides with palms facing each other (neutral grip).',
      'Keep your elbows pinned close to your sides.',
      'Curl the weights upward by bending at the elbows, keeping your palms facing each other.',
      'Squeeze your biceps at the peak, then slowly lower the dumbbells back to the starting position.'
    ],
    tips: [
      'Do not swing your body or use momentum to lift the weights.',
      'Keep your wrists straight and aligned with your forearms.'
    ]
  }
];
