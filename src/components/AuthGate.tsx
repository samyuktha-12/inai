import { useEffect, useMemo } from 'react';
import { useAuth } from 'react-oidc-context';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from '../module_bindings';
import { colors, fonts } from '../theme';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.ink,
        fontFamily: fonts.sans,
      }}
    >
      {children}
    </div>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  const connectionBuilder = useMemo(() => {
    if (!auth.user?.id_token) return null;
    return DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DB_NAME)
      .withToken(auth.user.id_token);
  }, [auth.user?.id_token]);

  // Safety net only: normally the sign-in modal on the Hero page handles
  // getting here unauthenticated. If this is ever reached anyway (e.g. a
  // stale "view=app" survives a signed-out session), go straight to
  // sign-in rather than show a second, redundant screen.
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.error) {
      auth.signinRedirect();
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error]);

  if (auth.error) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ color: colors.creamMuted, fontSize: 15, marginBottom: 16 }}>
            Sign-in failed: {auth.error.message}
          </p>
          <button
            type="button"
            onClick={() => auth.signinRedirect()}
            style={{
              height: 44,
              padding: '0 22px',
              borderRadius: 12,
              border: 'none',
              background: colors.green,
              color: '#FFFFFF',
              fontFamily: fonts.ui,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </Screen>
    );
  }

  if (auth.isLoading || !auth.isAuthenticated || !connectionBuilder) {
    return (
      <Screen>
        <p style={{ color: colors.creamMuted, fontSize: 15 }}>Signing you in…</p>
      </Screen>
    );
  }

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );
}
