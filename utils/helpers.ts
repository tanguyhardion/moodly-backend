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

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string | null;
}

/**
 * Calculate streak information from entry dates
 * @param dates - Array of date strings (ISO format: YYYY-MM-DD), should be sorted descending
 * @returns Object containing current and longest streak
 */
export function calculateStreak(dates: string[]): StreakData {
  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastEntryDate: null,
    };
  }

  // Sort dates descending to ensure proper order
  const sortedDates = [...dates].sort((a, b) => b.localeCompare(a));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Check if streak is active (entry today or yesterday)
  const latestDate = sortedDates[0];
  const isStreakActive = latestDate === todayStr || latestDate === yesterdayStr;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Calculate current streak (if active)
  if (isStreakActive) {
    let expectedDate = new Date(today);
    if (latestDate === yesterdayStr) {
      expectedDate = yesterday;
    }

    for (const dateStr of sortedDates) {
      const entryDate = new Date(dateStr);
      entryDate.setHours(0, 0, 0, 0);
      const expectedStr = expectedDate.toISOString().split("T")[0];

      if (dateStr === expectedStr) {
        currentStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let expectedDate = new Date(sortedDates[0]);
  expectedDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const entryDate = new Date(dateStr);
    entryDate.setHours(0, 0, 0, 0);
    const expectedStr = expectedDate.toISOString().split("T")[0];

    if (dateStr === expectedStr) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      // Reset and start new streak from current date
      tempStreak = 1;
      expectedDate = new Date(entryDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastEntryDate: sortedDates[0],
  };
}
