import { useAuth } from 'react-oidc-context';

export default function SignInModal({ onClose }: { onClose: () => void }) {
  const auth = useAuth();

  return (
    <div className="modal-backdrop modal-backdrop--center" onClick={onClose}>
      <div className="modal-card sign-in-modal" role="dialog" aria-modal="true" aria-labelledby="sign-in-title" onClick={e => e.stopPropagation()}>
        <span className="modal-kicker">Welcome to Inai</span>
        <h2 id="sign-in-title">Keep the family plan together</h2>
        <p className="modal-copy">
          One account, every device — no group chat required.
        </p>

        {auth.error && (
          <p className="modal-error">
            {auth.error.message}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            onClick={() => auth.signinRedirect()}
            className="modal-primary-action"
          >
            <GoogleG /> Sign in with Google
          </button>
          <button
            type="button"
            onClick={onClose}
            className="modal-dismiss"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#FFFFFF"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.9c1.7-1.57 2.7-3.87 2.7-6.64z"
      />
      <path
        fill="#FFFFFF"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.27c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.34C2.38 15.98 5.48 18 9 18z"
        opacity=".85"
      />
      <path
        fill="#FFFFFF"
        d="M3.95 10.69A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.69V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.34z"
        opacity=".7"
      />
      <path
        fill="#FFFFFF"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.38 2.02.9 4.97l3.05 2.34C4.66 5.17 6.65 3.58 9 3.58z"
        opacity=".55"
      />
    </svg>
  );
}
