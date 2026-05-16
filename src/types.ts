export type TriviaQuestion = {
  id: number;
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  answer: string;
};

export type EpisodeBundle = {
  seriesIndex: number;
  season: number;
  title: string;
  airDate: string;
  primarySource: string;
  indexSource: string;
  generatedAt?: string;
  questions: TriviaQuestion[];
};

export type QuizItem = {
  episode: EpisodeBundle;
  question: TriviaQuestion;
  qIndexInEp: number;
};

/** How this run should be summarized, replayed, and audited in results */
export type QuizRunConfig =
  | { mode: "episode" }
  | { mode: "marathon_random"; count: number }
  | { mode: "daily"; dateKeyUtc: string; count: number }
  | { mode: "season"; season: number; count: number }
  | {
      mode: "categories";
      categoryLabel: string;
      categoryId: string;
      questionTypes: string[];
      count: number;
    }
  /** Every prompt in corpus — broadcast order or mega-mix endurance. */
  | { mode: "full_corpus"; poolSize: number; order: "broadcast" | "shuffled" };

export type GameScreen =
  | { name: "home" }
  | { name: "browse" }
  | { name: "stats" }
  | {
      name: "quiz";
      items: QuizItem[];
      run: QuizRunConfig;
      enteredFromBrowse: boolean;
    }
  | {
      name: "results";
      items: QuizItem[];
      answers: Record<number, { choice: number; correct: boolean }>;
      run: QuizRunConfig;
      enteredFromBrowse: boolean;
    };
