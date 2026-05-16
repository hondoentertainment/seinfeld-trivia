import raw from "../data/trivia/all-episodes.json";
import type { EpisodeBundle } from "./types";

export const EPISODES = raw as EpisodeBundle[];
