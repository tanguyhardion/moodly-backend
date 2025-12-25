export interface MoodEntry {
  id: string;
  date: string;
  metrics: {
    mood: number;
    energy: number;
    sleep: number;
    focus: number;
  };
  checkboxes: {
    [key: string]: boolean;
  };
}

export interface Insight {
  type: string;
  category: string;
  text: string;
  score: number;
  details: string;
}
