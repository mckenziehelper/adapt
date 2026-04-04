// Exercise library with video links
// Expand this as needed — used for substitution suggestions and demo links

export type Exercise = {
  name: string
  category: 'main' | 'accessory' | 'warmup'
  muscleGroups: string[]
  videoUrl?: string
  notes?: string
}

export const EXERCISES: Exercise[] = [
  // Main lifts
  { name: 'Squat', category: 'main', muscleGroups: ['quads', 'glutes', 'core'], notes: 'Keep chest up, knees tracking toes' },
  { name: 'Deadlift', category: 'main', muscleGroups: ['hamstrings', 'glutes', 'back'], notes: 'Hinge at hips, keep bar close to shins' },
  { name: 'Bench Press', category: 'main', muscleGroups: ['chest', 'triceps', 'shoulders'], notes: 'Retract scapula, slight arch in lower back' },
  { name: 'Overhead Press', category: 'main', muscleGroups: ['shoulders', 'triceps', 'core'], notes: 'Brace core, press in a straight line' },
  { name: 'Barbell Row', category: 'main', muscleGroups: ['back', 'biceps'], notes: 'Hinge forward, pull to lower chest' },
  { name: 'Romanian Deadlift', category: 'main', muscleGroups: ['hamstrings', 'glutes'] },
  { name: 'Front Squat', category: 'main', muscleGroups: ['quads', 'core'] },

  // Accessories
  { name: 'Dumbbell Lunges', category: 'accessory', muscleGroups: ['quads', 'glutes'] },
  { name: 'Pull-ups', category: 'accessory', muscleGroups: ['back', 'biceps'] },
  { name: 'Dips', category: 'accessory', muscleGroups: ['chest', 'triceps'] },
  { name: 'Face Pulls', category: 'accessory', muscleGroups: ['rear delts', 'external rotators'] },
  { name: 'Lat Pulldown', category: 'accessory', muscleGroups: ['back', 'biceps'] },
  { name: 'Cable Row', category: 'accessory', muscleGroups: ['back', 'biceps'] },
  { name: 'Tricep Pushdowns', category: 'accessory', muscleGroups: ['triceps'] },
  { name: 'Bicep Curls', category: 'accessory', muscleGroups: ['biceps'] },
  { name: 'Leg Press', category: 'accessory', muscleGroups: ['quads', 'glutes'] },
  { name: 'Leg Curl', category: 'accessory', muscleGroups: ['hamstrings'] },
  { name: 'Calf Raises', category: 'accessory', muscleGroups: ['calves'] },
  { name: 'Plank', category: 'accessory', muscleGroups: ['core'] },
  { name: 'Ab Wheel', category: 'accessory', muscleGroups: ['core'] },

  // Warmup
  { name: 'Hip Circles', category: 'warmup', muscleGroups: ['hips'] },
  { name: 'Arm Circles', category: 'warmup', muscleGroups: ['shoulders'] },
  { name: 'Leg Swings', category: 'warmup', muscleGroups: ['hips', 'hamstrings'] },
  { name: 'Cat-Cow', category: 'warmup', muscleGroups: ['spine'] },
]
