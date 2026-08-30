export function getExerciseCategory(name = '') {
  const value = name.toLowerCase()

  const explicitLeg = [
    'bed hamstring curl',
    'crunch machine',
    'crunches',
    'leg press',
    'manchester hamstring curl',
    'reverse leg press',
    'leg extensions',
    'sitting calf raises',
    'inside leg',
    'outside leg',
    'squat',
    'hamstring',
    'calf',
    'lunge',
  ]

  if (explicitLeg.some((entry) => value.includes(entry))) {
    return 'leg'
  }

  if (/(cable tricep pull[- ]?down(?:s)?|tricep pull[- ]?down(?:s)?|single arm tricep pulldown(?:s)?|straight bar tricep pulldown(?:s)?)/i.test(value)) {
    return 'push'
  }

  if (/(rear delt|rear delts|pull|row|lat|curl|shrug|pulldown|pull up|bicep)/i.test(value)) {
    return 'pull'
  }

  if (/(bench|press|shoulder|chest|tricep|push|dip|fly|incline|dumbbell bench|smith bench|machine bench|machine push press|dumbbell shoulder press|machine shoulder press|cable machine shoulder press|delt cable flys|delt machine flys)/i.test(value)) {
    return 'push'
  }

  if (/(leg|squat|hamstring|calf|extension|lunge)/i.test(value)) {
    return 'leg'
  }

  return 'general'
}
