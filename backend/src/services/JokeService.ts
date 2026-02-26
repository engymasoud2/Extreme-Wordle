/**
 * ==========================================================
 *  JokeService
 * ==========================================================
 *
 * Fetches dad jokes from the icanhazdadjoke API and
 * validates player answers for the "Show Mercy" mode.
 *
 * When the external API is unreachable, a local fallback
 * set of jokes is used so the mode never breaks.
 *
 * Validation strategy:
 *  1. Exact match (after normalisation) — always accepted.
 *  2. Fuzzy match using Levenshtein distance — accepted when
 *     the edit distance is ≤ 20 % of the expected answer
 *     length.  This forgives minor typos without allowing
 *     wildly different answers.
 * ==========================================================
 */

import https from "https";

/** Shape of a joke object (question + expected answer) */
export interface DadJoke {
  question: string;
  punchline: string;
}

/**
 * Local fallback jokes used when the external API fails.
 * Each entry has a clear setup/punchline split.
 */
const FALLBACK_JOKES: DadJoke[] = [
  {
    question: "Why didn't the skeleton go to the party?",
    punchline: "Because he had no body to go with!",
  },
  {
    question: "What do you call cheese that isn't yours?",
    punchline: "Nacho cheese!",
  },
  {
    question: "Why can't a bicycle stand on its own?",
    punchline: "Because it's two-tired!",
  },
  {
    question: "What did the ocean say to the beach?",
    punchline: "Nothing, it just waved.",
  },
  {
    question: "Why did the scarecrow win an award?",
    punchline: "Because he was outstanding in his field!",
  },
  {
    question: "What do you call a fake noodle?",
    punchline: "An impasta!",
  },
  {
    question: "How do you organize a space party?",
    punchline: "You planet!",
  },
  {
    question: "Why don't eggs tell jokes?",
    punchline: "They'd crack each other up!",
  },
];

export class JokeService {
  /**
   * Fetch a random dad joke.
   *
   * Attempts the icanhazdadjoke API first.  On failure,
   * selects a random joke from the local fallback array.
   *
   * NOTE: The icanhazdadjoke API returns a single-line joke
   * (no explicit question/punchline split), so we treat the
   * entire joke as the "question" and use a simplified
   * matching strategy for the answer.  The fallback set,
   * however, has a proper split for stricter matching.
   */
  async fetchJoke(): Promise<DadJoke> {
    try {
      const joke = await this.fetchFromApi();
      return joke;
    } catch (err) {
      console.warn(
        "[JokeService] External API failed, using fallback:",
        (err as Error).message
      );
      return this.getRandomFallback();
    }
  }

  /**
   * Validate the player's answer against the expected punchline.
   *
   * Uses a two-tier strategy:
   *  1. Exact normalised match (case-insensitive, trimmed,
   *     trailing punctuation stripped).
   *  2. Fuzzy match via Levenshtein distance — the answer is
   *     accepted if the edit distance is within 20 % of the
   *     expected punchline length.  This handles typos and
   *     minor phrasing differences common with dad-joke
   *     punchlines.
   *
   * @param playerAnswer      What the player submitted
   * @param expectedPunchline The stored punchline
   * @returns `true` if the answer is accepted
   */
  validateAnswer(playerAnswer: string, expectedPunchline: string): boolean {
    const a = this.normalise(playerAnswer);
    const b = this.normalise(expectedPunchline);

    // Tier 1: exact match after normalisation
    if (a === b) return true;

    // Tier 2: fuzzy match — allow up to 20% edit distance
    const maxDistance = Math.max(1, Math.floor(b.length * 0.2));
    const distance = this.levenshtein(a, b);
    return distance <= maxDistance;
  }

  // ── Private Helpers ─────────────────────────────────────

  /**
   * Normalise a string for comparison: lowercase, trim,
   * collapse whitespace, strip trailing punctuation.
   */
  private normalise(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[!?.,:;]+$/g, "");
  }

  /**
   * Compute the Levenshtein edit distance between two strings.
   * Uses the classic dynamic-programming approach with O(min(m,n))
   * space via a single-row optimisation.
   */
  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Ensure `a` is the shorter string for space optimisation
    if (a.length > b.length) {
      [a, b] = [b, a];
    }

    const aLen = a.length;
    const bLen = b.length;

    // Previous row of distances
    let prev: number[] = Array.from({ length: aLen + 1 }, (_, i) => i);
    let curr: number[] = new Array(aLen + 1).fill(0);

    for (let j = 1; j <= bLen; j++) {
      curr[0] = j;
      for (let i = 1; i <= aLen; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[i] = Math.min(
          (prev[i] ?? 0) + 1,       // deletion
          (curr[i - 1] ?? 0) + 1,   // insertion
          (prev[i - 1] ?? 0) + cost  // substitution
        );
      }
      // Swap rows
      [prev, curr] = [curr, prev];
    }

    return prev[aLen] ?? 0;
  }

  /**
   * Call the icanhazdadjoke API over HTTPS.
   */
  private fetchFromApi(): Promise<DadJoke> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "icanhazdadjoke.com",
        path: "/",
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "ExtremeWordle (https://github.com/extreme-wordle)",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as { joke: string };
            // The API returns a single string; we split on "?"
            // to create a question/punchline pair when possible.
            const qMark = parsed.joke.indexOf("?");
            if (qMark > 0) {
              resolve({
                question: parsed.joke.substring(0, qMark + 1).trim(),
                punchline: parsed.joke.substring(qMark + 1).trim(),
              });
            } else {
              // No "?" — try splitting on the last comma so
              // the setup and punchline are distinct.
              const lastComma = parsed.joke.lastIndexOf(",");
              if (lastComma > 0 && lastComma < parsed.joke.length - 1) {
                resolve({
                  question: parsed.joke.substring(0, lastComma + 1).trim(),
                  punchline: parsed.joke.substring(lastComma + 1).trim(),
                });
              } else {
                // No useful delimiter — fall back to a local joke
                // that has a proper question/punchline split.
                resolve(this.getRandomFallback());
              }
            }
          } catch {
            reject(new Error("Failed to parse joke API response"));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(3000, () => {
        req.destroy(new Error("Joke API request timed out"));
      });
      req.end();
    });
  }

  /**
   * Generate a shuffled array of 4 choices: the correct
   * punchline + 3 wrong ones from other fallback jokes.
   *
   * If the correct punchline already exists in the fallback
   * set, it is excluded from the wrong-answer pool to avoid
   * duplicates.
   */
  generateChoices(correctPunchline: string): string[] {
    const normalised = this.normalise(correctPunchline);

    // Collect wrong punchlines (exclude the correct one)
    const pool = FALLBACK_JOKES
      .map((j) => j.punchline)
      .filter((p) => this.normalise(p) !== normalised);

    // Shuffle and take 3
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const wrong = shuffled.slice(0, 3);

    // Combine and shuffle
    const choices = [...wrong, correctPunchline].sort(
      () => Math.random() - 0.5
    );
    return choices;
  }

  /**
   * Pick a random joke from the local fallback array.
   */
  private getRandomFallback(): DadJoke {
    const idx = Math.floor(Math.random() * FALLBACK_JOKES.length);
    return FALLBACK_JOKES[idx]!;
  }
}
