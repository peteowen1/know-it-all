// Shared by the app and the Worker (worker/index.js imports this file), so the
// Google client ID and the site address live in exactly one place.
//
// The client ID is public by design: Google shows it to every browser that
// renders the sign-in button. It identifies the app, it does not authorise it.

export const GOOGLE_CLIENT_ID = '538635611925-qmj0c3pepfgdngfme6ee4b4v1rmgclqt.apps.googleusercontent.com';

// Where the app lives now. The old GitHub Pages copy hands progress over to
// this address and then redirects every later visit here.
export const APP_ORIGIN = 'https://quiz.peteowen.dev';
export const OLD_HOST = 'peteowen1.github.io';
