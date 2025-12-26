export function formatHabit(key: string): string {
  // Convert camelCase to readable text
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase());
}

export function getHabitAction(key: string): string {
  const actions: { [key: string]: string } = {
    healthyFood: "eat healthy food",
    caffeine: "have caffeine",
    gym: "go to the gym",
    hardWork: "work hard",
    dayOff: "have a day off",
    alcohol: "drink alcohol",
    misc: "have miscellaneous entries",
  };
  return actions[key] || formatHabit(key).toLowerCase();
}
