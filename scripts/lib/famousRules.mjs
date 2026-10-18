// Who Famous first names leaves out, shared by scripts/build-famous.mjs and the
// tests so the shipped file is checked against the same rule that built it.
//
// Pageviews make serial killers and murder victims "famous", and easy mode
// printed clues like "American serial killer". Pete chose (2026-10-01) to
// leave out people known mainly for violent or sexual crimes, or for being
// their victims; the board fills from the next most famous. Fraudsters and
// other non-violent offenders stay (Abagnale, Bankman-Fried).
//
// "<nationality> criminal" alone (Charles Bronson, Kenneth Noye) is caught too;
// fraudsters are described by what they did instead, so they stay. "criminal"
// must end the word: "criminal-justice activist" and "criminal profiler" are
// not criminals (a 2026-10-18 review found both left out).
export const NOTORIOUS = /\b(serial killer|spree killer|mass (murderer|shooter)|murderer|murdered|killer of|assassin|rapist|sex(ual)? (offender|abuser|predator)|child (molester|sex)|pedophile|paedophile|terrorist|hijacker|mobster|gangster|drug (lord|trafficker)|cult (leader|founder)|murder victim|victim of|war criminal|holocaust perpetrator|ss (officer|official)|leader of the ss|commandant of|kidnap(ping)? (victim|survivor)|abuse survivor|lynching victim|beheaded|jihadist|islamic state|mob boss|crime boss|paramilitary leader|murder defendant|(gang|crips|bloods) (member|leader|founder)|founder of the \w+ gang|lord's resistance army)\b|(?<!wrong(ful)?ly )convicted of (murder|rape)|^\p{L}+(-\p{L}+)? criminal(?![-\w])/iu;

// Descriptions that mention a crime without being about a criminal: a
// "criminal defense attorney", the nurse who "helped stop a serial killer".
// An exoneree ("wrongly convicted of murder") is spared inside NOTORIOUS by its
// lookbehind, not here: an exemption on the whole description let Steven Avery
// ("convicted of murder and previously wrongly convicted of rape") back in.
export const NOT_NOTORIOUS = /defen[cs]e (attorney|lawyer)|helped (stop|catch)|profiler|justice/i;

/** Is this person left out by the rule (before any of Pete's per-person decisions)? */
export const leftOutByRule = (description, name) =>
  (NOTORIOUS.test(description || '') && !NOT_NOTORIOUS.test(description || '')) || /\b(trial|case)\b/i.test(name || '');
