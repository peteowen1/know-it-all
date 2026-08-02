const fs = require('fs');

function validateFile(origPath, auditedPath) {
  const orig = JSON.parse(fs.readFileSync(origPath, 'utf8'));
  const audited = JSON.parse(fs.readFileSync(auditedPath, 'utf8'));

  if (orig.length !== audited.length) {
    console.error('Length mismatch:', orig.length, 'vs', audited.length);
    return false;
  }

  let ok = true;
  for (let i = 0; i < orig.length; i++) {
    const o = orig[i];
    const a = audited[i];

    if (o.id !== a.id || o.category !== a.category || o.question !== a.question ||
        JSON.stringify(o.options) !== JSON.stringify(a.options) ||
        o.answer !== a.answer || o.difficulty !== a.difficulty) {
      console.error('Core field modified at index', i, o.id);
      console.error('Orig:', o.id, o.category, o.question, o.options, o.answer, o.difficulty);
      console.error('Audited:', a.id, a.category, a.question, a.options, a.answer, a.difficulty);
      ok = false;
    }

    const badPatterns = [
      /The correct answer is/i,
      /This is an essential piece/i,
      /Quizmaster Tip: Focus on/i,
      /Question text =/i,
      /\b->\b/
    ];

    for (const pat of badPatterns) {
      if (pat.test(a.tip)) {
        console.error('Bad pattern in tip at index', i, o.id, pat);
        ok = false;
      }
      if (pat.test(a.explanation)) {
        console.error('Bad pattern in explanation at index', i, o.id, pat);
        ok = false;
      }
    }

    if (!a.tip || a.tip.trim().length < 15) {
      console.error('Tip too short at index', i, o.id);
      ok = false;
    }
    if (!a.explanation || a.explanation.trim().length < 30) {
      console.error('Explanation too short at index', i, o.id);
      ok = false;
    }
  }

  if (ok) {
    console.log(auditedPath, 'PASSED all validation checks!');
  }
  return ok;
}

// Read raw original backup files or reconstructed objects
const origSports = JSON.parse(fs.readFileSync('C:/Users/peteo/.gemini/antigravity-cli/brain/001fed83-4b34-44a3-a708-35d62ffe44c4/scratch/sports_list.json', 'utf8')).map(q => ({
  id: q.id,
  category: 'sports',
  question: q.question,
  options: q.options,
  answer: q.options.indexOf(q.answerText),
  difficulty: 'Medium'
}));

fs.writeFileSync('C:/dev/gw-quiz-trainer/scratch/orig_sports_clean.json', JSON.stringify(origSports, null, 2));

validateFile('C:/dev/gw-quiz-trainer/scratch/orig_sports_clean.json', 'C:/dev/gw-quiz-trainer/src/data/questions/sports.json');
