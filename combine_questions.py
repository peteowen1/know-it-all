import json
import glob
import os

HEADER = """export const CATEGORIES = {
  AUS_HISTORY: { id: 'aus_history', name: 'Australian History & Politics', icon: '🇦🇺', color: '#3b82f6' },
  GEOGRAPHY: { id: 'geography', name: 'World Geography & Places', icon: '🗺️', color: '#10b981' },
  SCIENCE: { id: 'science', name: 'Science & Nature', icon: '🔬', color: '#8b5cf6' },
  ARTS_LIT: { id: 'arts_lit', name: 'Literature & Classical Arts', icon: '🎭', color: '#ec4899' },
  LANGUAGE: { id: 'language', name: 'Etymology & Language', icon: '💬', color: '#f59e0b' },
  MYTHOLOGY: { id: 'mythology', name: 'Mythology & Religion', icon: '🏛️', color: '#6366f1' },
  SPORTS: { id: 'sports', name: 'Aussie & World Sports', icon: '🏆', color: '#ef4444' },
  POP_CULTURE: { id: 'pop_culture', name: 'Pop Culture & News', icon: '🗞️', color: '#14b8a6' }
};

export const ALL_QUESTIONS = """

FOOTER = """;

// Helper to generate a balanced 25-question Weekly Quiz guaranteed ZERO duplicates
export function getBalancedWeeklyQuiz(count = 25) {
  const categories = Object.values(CATEGORIES).map(c => c.id);
  const selected = [];
  const seenIds = new Set();
  const seenTexts = new Set();

  const addQ = (q) => {
    if (!seenIds.has(q.id) && !seenTexts.has(q.question)) {
      seenIds.add(q.id);
      seenTexts.add(q.question);
      selected.push(q);
      return true;
    }
    return false;
  };

  const qPerCat = Math.floor(count / categories.length);

  categories.forEach(catId => {
    const catQs = ALL_QUESTIONS.filter(q => q.category === catId);
    const shuffled = [...catQs].sort(() => 0.5 - Math.random());
    let addedCount = 0;
    for (const q of shuffled) {
      if (addedCount >= qPerCat) break;
      if (addQ(q)) addedCount++;
    }
  });

  if (selected.length < count) {
    const remaining = ALL_QUESTIONS.filter(q => !seenIds.has(q.id) && !seenTexts.has(q.question));
    const shuffledRemaining = [...remaining].sort(() => 0.5 - Math.random());
    for (const q of shuffledRemaining) {
      if (selected.length >= count) break;
      addQ(q);
    }
  }

  return selected.sort(() => 0.5 - Math.random());
}
"""

def main():
    json_files = [
        "ausHistory.json",
        "geography.json",
        "science.json",
        "artsLit.json",
        "languageEtymology.json",
        "mythologyHistory.json",
        "sports.json",
        "popCultureNews.json"
    ]
    
    base_dir = os.path.join(os.path.dirname(__file__), "src", "data", "questions")
    all_questions = []
    
    for filename in json_files:
        filepath = os.path.join(base_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                all_questions.extend(data)
                print(f"Loaded {len(data)} questions from {filename}")
        else:
            print(f"Warning: {filepath} not found!")

    out_path = os.path.join(os.path.dirname(__file__), "src", "data", "questionsData.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(HEADER)
        f.write(json.dumps(all_questions, indent=2, ensure_ascii=False))
        f.write(FOOTER)

    print(f"Successfully combined {len(all_questions)} questions into {out_path}")

if __name__ == "__main__":
    main()
