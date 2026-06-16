export type StrengthsWeaknessesDiscussionPoint = {
  question_index: number;
  reason: string;
};

export type StrengthsWeaknessesQuestionItem = {
  question_index: number;
  question: string;
  answer: string;
  question_strengths: string[];
  question_weaknesses: string[];
  score?: number | null;
  score_display?: string;
  skipped?: boolean;
};

export type StrengthsWeaknessesAnalysis = {
  version?: number;
  complete?: boolean;
  generated_at_ist?: string;
  overall_strengths: string[];
  overall_weaknesses: string[];
  overall_key_strengths?: string[];
  overall_improvement_areas?: string[];
  discussion_points?: StrengthsWeaknessesDiscussionPoint[];
  questions: StrengthsWeaknessesQuestionItem[];
};
