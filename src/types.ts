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

export type GameScreen =
  | { name: "home" }
  | { name: "browse" }
  | {
      name: "quiz";
      items: QuizItem[];
      marathon: boolean;
      enteredFromBrowse: boolean;
    }
  | {
      name: "results";
      items: QuizItem[];
      answers: Record<number, { choice: number; correct: boolean }>;
      marathon: boolean;
      enteredFromBrowse: boolean;
    };
