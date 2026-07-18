const EMAIL_ACTION_RESULT_KEY = 'mlg-email-action-result';

const EMAIL_ACTION_QUERY_KEYS = [
  'mode',
  'oobCode',
  'apiKey',
  'continueUrl',
  'lang'
];

export function getApplicationUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

export function getEmailActionCodeSettings() {
  return {
    url: getApplicationUrl(),
    handleCodeInApp: false
  };
}

export function getEmailActionRequest() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const actionCode = params.get('oobCode');
  const supportedModes = ['verifyEmail', 'resetPassword', 'recoverEmail'];

  if (!supportedModes.includes(mode) || !actionCode) return null;

  return {
    mode,
    actionCode,
    continueUrl: params.get('continueUrl') || ''
  };
}

export function getEmailActionReturnUrl(continueUrl = '') {
  if (typeof window === 'undefined') return '';

  let targetUrl = new URL(window.location.href);

  if (continueUrl) {
    try {
      const candidateUrl = new URL(continueUrl, window.location.origin);
      if (candidateUrl.origin === window.location.origin) {
        targetUrl = candidateUrl;
      }
    } catch (error) {
      // Keep the current application URL when the continuation URL is malformed.
    }
  }

  EMAIL_ACTION_QUERY_KEYS.forEach((key) => targetUrl.searchParams.delete(key));
  return targetUrl.toString();
}

export function storeEmailActionResult(result) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(EMAIL_ACTION_RESULT_KEY, JSON.stringify(result));
  } catch (error) {
    // Redirect still works when session storage is unavailable.
  }
}

export function consumeEmailActionResult() {
  if (typeof window === 'undefined') return null;

  let storedResult = null;
  try {
    storedResult = window.sessionStorage.getItem(EMAIL_ACTION_RESULT_KEY);
    window.sessionStorage.removeItem(EMAIL_ACTION_RESULT_KEY);
  } catch (error) {
    return null;
  }

  if (!storedResult) return null;

  try {
    return JSON.parse(storedResult);
  } catch (error) {
    return null;
  }
}
