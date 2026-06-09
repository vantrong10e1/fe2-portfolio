export interface LeaderboardEntry {
  name: string;
  level: number;
  score: number;
  kills: number;
  bossKilled: boolean;
  date: string;
}

const LOCAL_STORAGE_KEY = 'shadow_blade_leaderboard';
const LAST_NAME_KEY = 'shadow_blade_last_player_name';

export const LeaderboardHelper = {
  /**
   * Get leaderboard entries sorted by score descending, then kills descending.
   */
  getEntries(): LeaderboardEntry[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load leaderboard from localStorage', e);
    }
    return [];
  },

  /**
   * Save a new leaderboard entry, sort by boss kills first, then score, and keep only the top 5.
   */
  saveEntry(name: string, level: number, score: number, kills: number, bossKilled: boolean = false): void {
    const trimmedName = name.trim() || 'Anh Hùng';

    // Save last used name
    try {
      localStorage.setItem(LAST_NAME_KEY, trimmedName);
    } catch (e) {
      console.error('Failed to save last used player name', e);
    }

    const entries = this.getEntries();

    // Format date as DD/MM/YYYY HH:mm
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;

    const newEntry: LeaderboardEntry = {
      name: trimmedName,
      level,
      score,
      kills,
      bossKilled,
      date: dateStr,
    };

    entries.push(newEntry);

    // Sort by boss killed (true first), then score descending, then kills descending
    entries.sort((a, b) => {
      if (b.bossKilled !== a.bossKilled) {
        return b.bossKilled ? 1 : -1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.kills - a.kills;
    });

    // Keep top 5
    const topEntries = entries.slice(0, 5);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(topEntries));
    } catch (e) {
      console.error('Failed to save leaderboard to localStorage', e);
    }
  },

  /**
   * Get the last used player name, defaulting to 'Anh Hùng'.
   */
  getLastName(): string {
    try {
      return localStorage.getItem(LAST_NAME_KEY) || 'Anh Hùng';
    } catch (e) {
      return 'Anh Hùng';
    }
  }
};
