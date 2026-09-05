import { useState } from 'react';
import {
  HeartHandshake,
  Mic,
  Vote,
  Wallet,
  CarFront,
  Home,
  ListChecks,
  MapPin,
  PhoneCall,
  Menu,
  X,
} from 'lucide-react';
import { colors, fonts } from '../theme';

const navLink: React.CSSProperties = {
  fontSize: 14,
  color: colors.creamMuted,
  textDecoration: 'none',
};

function PhoneFrame({
  children,
  bg = colors.paper,
}: {
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <div
      style={{
        width: 300,
        maxWidth: '100%',
        background: bg,
        border: `1px solid ${colors.hairline}`,
        borderRadius: 32,
        overflow: 'hidden',
        boxShadow: '0 24px 48px -28px rgba(28,27,25,.28)',
        fontFamily: fonts.ui,
      }}
    >
      {children}
    </div>
  );
}

function PhoneTopBar({ right }: { right: string }) {
  return (
    <div
      style={{
        background: colors.paper,
        padding: '12px 20px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        fontWeight: 600,
        color: colors.muted,
        borderBottom: `1px solid ${colors.hairline}`,
      }}
    >
      <span>9:41</span>
      <span>{right}</span>
    </div>
  );
}

function TabBar({ active }: { active: 'today' | 'decide' | 'wedding' }) {
  const item = (
    key: string,
    label: string,
    Icon: typeof Home,
    isActive: boolean
  ) => (
    <span
      key={key}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '12px 4px 14px',
        fontSize: 12,
        fontWeight: 600,
        color: isActive ? colors.green : colors.muted,
      }}
    >
      <Icon aria-hidden style={{ display: 'flex', width: 20, height: 20 }} />
      {label}
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        borderTop: `1px solid ${colors.hairline}`,
        background: '#FFFFFF',
      }}
    >
      {item('today', 'Today', Home, active === 'today')}
      {item('decide', 'Decide', ListChecks, active === 'decide')}
      {item('wedding', 'Wedding', MapPin, active === 'wedding')}
    </div>
  );
}

export default function Hero({
  onGetStarted,
}: {
  onGetStarted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  return (
    <div style={{ background: colors.ink }}>
      <style>{`
        @media (min-width: 768px) {
          .inai-links { display: flex !important; }
          .inai-burger { display: none !important; }
          .inai-row-text { order: 1; }
          .inai-row-shot { order: 2; }
        }
        .inai-links { display: none; gap: 32px; align-items: center; }
        .inai-row-text { order: 2; }
        .inai-row-shot { order: 1; }
      `}</style>

      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100svh',
          overflow: 'hidden',
          background: colors.ink,
          fontFamily: fonts.sans,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src="/video/marriage.mp4"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            background:
              'linear-gradient(180deg, rgba(22,17,13,0.35) 0%, rgba(22,17,13,0.15) 35%, rgba(22,17,13,0.75) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, rgba(22,17,13,0.6) 0%, rgba(22,17,13,0.35) 45%, rgba(22,17,13,0) 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '100svh',
            width: '100%',
            maxWidth: 1152,
            margin: '0 auto',
            padding: '0 24px',
            boxSizing: 'border-box',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '24px 0',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HeartHandshake
                aria-hidden
                style={{ display: 'flex', color: colors.cream, width: 28, height: 28 }}
              />
              <span
                style={{
                  fontFamily: fonts.serif,
                  fontWeight: 400,
                  fontSize: 24,
                  letterSpacing: '-0.01em',
                  color: colors.cream,
                }}
              >
                Inai
              </span>
            </span>

            <nav className="inai-links">
              <a href="#how" style={navLink}>How it works</a>
              <a href="#families" style={navLink}>For families</a>
              <a href="#join" style={navLink}>Sign in</a>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                className="inai-burger"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  background: 'transparent',
                  border: `1px solid rgba(246,241,232,0.18)`,
                  borderRadius: 12,
                  color: colors.cream,
                  cursor: 'pointer',
                }}
              >
                {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
              </button>
            </div>
          </header>

          {menuOpen && (
            <div
              style={{
                background: colors.ink,
                border: '1px solid rgba(246,241,232,0.18)',
                borderRadius: 16,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                marginBottom: 8,
              }}
            >
              {[
                ['#how', 'How it works'],
                ['#families', 'For families'],
                ['#join', 'Sign in'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: '12px 14px',
                    fontSize: 16,
                    color: colors.cream,
                    textDecoration: 'none',
                    borderRadius: 10,
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingBottom: 96, maxWidth: 672 }}>
            <h1
              style={{
                fontFamily: fonts.serif,
                fontWeight: 400,
                fontSize: 'clamp(38px, 7.2vw, 76px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: colors.cream,
                margin: '0 0 24px',
                textWrap: 'pretty',
              }}
            >
              One calm place for the whole wedding.
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.65,
                color: colors.creamMuted,
                margin: '0 0 32px',
                maxWidth: 576,
                textWrap: 'pretty',
              }}
            >
              Inai keeps everyone in sync, parents included, through chat and a
              phone call in their own language. The group chat can finally
              rest.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <button
                type="button"
                onClick={onGetStarted}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 48,
                  border: 'none',
                  borderRadius: 12,
                  background: colors.green,
                  color: '#FFFFFF',
                  padding: '0 26px',
                  fontFamily: fonts.ui,
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Get started
              </button>
              <a
                href="#how"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 48,
                  borderRadius: 12,
                  border: '1px solid rgba(246,241,232,0.28)',
                  color: colors.cream,
                  padding: '0 22px',
                  fontSize: 16,
                  textDecoration: 'none',
                }}
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: colors.paper,
          fontFamily: fonts.sans,
          padding: '160px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ width: 64, height: 1, background: colors.green, marginBottom: 40 }} />
          <h2
            style={{
              fontFamily: fonts.serif,
              fontWeight: 400,
              fontSize: 'clamp(32px,5.2vw,58px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: colors.ink2,
              margin: '0 0 40px',
              maxWidth: 800,
              textWrap: 'pretty',
            }}
          >
            Right now, the wedding lives in six places at once.
          </h2>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: colors.muted,
              margin: 0,
              maxWidth: 620,
              textWrap: 'pretty',
            }}
          >
            Decisions happen in the group chat and disappear. One cousin keeps
            the real budget in a spreadsheet. The mood board is on someone's
            Pinterest. Every reminder is chased by whoever cares most. Inai
            puts all of it in one place that stays current on its own.
          </p>
        </div>
      </section>

      <section
        id="how"
        style={{
          background: colors.paper,
          fontFamily: fonts.sans,
          padding: '0 24px 160px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 1152,
            margin: '0 auto',
            borderTop: `1px solid ${colors.hairline}`,
            paddingTop: 96,
          }}
        >
          <h2
            style={{
              fontFamily: fonts.serif,
              fontWeight: 400,
              fontSize: 'clamp(30px,4.4vw,48px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: colors.ink2,
              margin: '0 0 88px',
              maxWidth: 640,
              textWrap: 'pretty',
            }}
          >
            You talk. Inai keeps the record.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 112 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                gap: 56,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  borderRadius: 24,
                  background: colors.paperAlt,
                  padding: '36px 24px',
                  display: 'flex',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <PhoneFrame>
                  <PhoneTopBar right="Today" />
                  <div style={{ background: colors.paper, padding: '22px 20px 0' }}>
                    <p style={{ fontSize: 15, color: colors.muted, margin: 0 }}>Good morning, Priya</p>
                    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: '2px 0 18px', lineHeight: 1.2 }}>
                      3 things <span style={{ color: colors.green }}>need you</span> today
                    </div>
                    <div
                      style={{
                        background: colors.green,
                        color: '#FFFFFF',
                        borderRadius: 22,
                        padding: '22px 18px',
                        marginBottom: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        textAlign: 'center',
                      }}
                    >
                      <Mic aria-hidden style={{ display: 'flex', width: 26, height: 26 }} />
                      <b style={{ fontSize: 18, fontWeight: 700 }}>Ask or update by voice</b>
                      <span style={{ fontSize: 13, opacity: 0.85 }}>Speak in Tamil, Hindi or English</span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.muted,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        margin: '0 0 12px',
                      }}
                    >
                      Your turn
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
                      {(
                        [
                          [Vote, colors.greenTint, colors.green, 'Vote on the venue', '3 options · Amma decides Friday'],
                          [Wallet, '#FBEFD8', '#9a6712', 'Is the caterer paid?', 'Heard on a call · confirm'],
                          [CarFront, colors.greenTint, colors.green, "Chennai cousins' cab", 'Not booked yet'],
                        ] as [typeof Vote, string, string, string, string][]
                      ).map(([Icon, bg, fg, title, sub], i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: '#FFFFFF',
                            border: `1px solid ${colors.hairline}`,
                            borderRadius: 16,
                            padding: 14,
                          }}
                        >
                          <span
                            style={{
                              width: 40,
                              height: 40,
                              flex: 'none',
                              borderRadius: 12,
                              background: bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: fg,
                            }}
                          >
                            <Icon aria-hidden style={{ display: 'flex', width: 20, height: 20 }} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <b style={{ display: 'block', fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{title}</b>
                            <span style={{ fontSize: 13, color: colors.muted }}>{sub}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TabBar active="today" />
                </PhoneFrame>
              </div>
              <div style={{ maxWidth: 440 }} className="inai-row-text">
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontWeight: 400,
                    fontSize: 'clamp(24px,3vw,32px)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.015em',
                    color: colors.ink2,
                    margin: '0 0 14px',
                    textWrap: 'pretty',
                  }}
                >
                  Say it, don't type it.
                </h3>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: colors.muted, margin: 0, textWrap: 'pretty' }}>
                  Everyone updates by voice note, chat, or a quick call. Inai
                  turns it into clear status. No forms to keep filling in.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                gap: 56,
                alignItems: 'center',
              }}
            >
              <div style={{ maxWidth: 440 }} className="inai-row-text">
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontWeight: 400,
                    fontSize: 'clamp(24px,3vw,32px)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.015em',
                    color: colors.ink2,
                    margin: '0 0 14px',
                    textWrap: 'pretty',
                  }}
                >
                  Nothing is final until you say so.
                </h3>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: colors.muted, margin: 0, textWrap: 'pretty' }}>
                  What the assistant hears arrives as a draft you confirm with
                  one tap, and it shows you where it came from.
                </p>
              </div>
              <div
                className="inai-row-shot"
                style={{
                  borderRadius: 24,
                  background: colors.paperAlt,
                  padding: '56px 24px',
                  display: 'flex',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: 300,
                    maxWidth: '100%',
                    background: '#FFFFFF',
                    border: `1px solid ${colors.hairline}`,
                    borderRadius: 26,
                    padding: '26px 22px',
                    boxShadow: '0 24px 48px -28px rgba(28,27,25,.3)',
                    fontFamily: fonts.ui,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 6px' }}>Is this right?</div>
                  <p style={{ fontSize: 17, color: colors.ink2, margin: 0 }}>
                    The caterer is <b>booked and paid</b>.
                  </p>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 13,
                      color: colors.muted,
                      background: colors.paper,
                      border: `1px solid ${colors.hairline}`,
                      borderRadius: 999,
                      padding: '6px 12px',
                      margin: '14px 0 22px',
                    }}
                  >
                    <Mic aria-hidden style={{ display: 'flex', width: 14, height: 14 }} />
                    Heard on your call · 9:12 AM
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 16,
                        border: 'none',
                        background: colors.green,
                        color: '#FFFFFF',
                        fontFamily: fonts.ui,
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Yes, that's right
                    </button>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 16,
                        background: '#FFFFFF',
                        color: colors.ink2,
                        border: `2px solid ${colors.hairline}`,
                        fontFamily: fonts.ui,
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      No, fix it
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
                gap: 56,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  borderRadius: 24,
                  background: colors.paperAlt,
                  padding: '36px 24px',
                  display: 'flex',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <PhoneFrame>
                  <PhoneTopBar right="Today" />
                  <div style={{ padding: '22px 20px 24px' }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.muted,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        margin: '0 0 14px',
                      }}
                    >
                      Your turn
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        ['Confirm the mehendi menu', 'You own this · reminder tomorrow 6pm'],
                        ['Send Meera the guest count', 'Asked once. Not in the group chat.'],
                        ['Approve the decor advance', '₹90,000 · due Friday'],
                      ].map(([title, sub]) => (
                        <div
                          key={title}
                          style={{
                            background: '#FFFFFF',
                            border: `1px solid ${colors.hairline}`,
                            borderRadius: 16,
                            padding: '14px 16px',
                          }}
                        >
                          <b style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{title}</b>
                          <span style={{ fontSize: 13, color: colors.muted }}>{sub}</span>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 18,
                        background: colors.greenTint,
                        borderRadius: 12,
                        padding: '12px 14px',
                        fontSize: 13,
                        color: colors.green,
                      }}
                    >
                      Amma and Arjun each see only their own list.
                    </div>
                  </div>
                </PhoneFrame>
              </div>
              <div style={{ maxWidth: 440 }} className="inai-row-text">
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontWeight: 400,
                    fontSize: 'clamp(24px,3vw,32px)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.015em',
                    color: colors.ink2,
                    margin: '0 0 14px',
                    textWrap: 'pretty',
                  }}
                >
                  It chases, so you don't.
                </h3>
                <p style={{ fontSize: 17, lineHeight: 1.7, color: colors.muted, margin: 0, textWrap: 'pretty' }}>
                  Inai reminds the right person about the one thing they own,
                  on their own schedule. Never a group-wide blast.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="families"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '92svh',
          overflow: 'hidden',
          background: colors.ink,
          fontFamily: fonts.sans,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: colors.ink,
            backgroundImage:
              'radial-gradient(120% 100% at 78% 18%, rgba(14,124,102,0.18) 0%, rgba(22,17,13,0) 60%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: '100%',
            maxWidth: 1152,
            margin: '0 auto',
            padding: '120px 24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              marginTop: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 56,
              alignItems: 'end',
            }}
          >
            <div style={{ maxWidth: 672 }}>
              <h2
                style={{
                  fontFamily: fonts.serif,
                  fontWeight: 400,
                  fontSize: 'clamp(32px,5.4vw,60px)',
                  lineHeight: 1.08,
                  letterSpacing: '-0.02em',
                  color: colors.cream,
                  margin: '0 0 24px',
                  textWrap: 'pretty',
                }}
              >
                Your parents don't need the app. They need a phone call.
              </h2>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.7,
                  color: colors.creamMuted,
                  margin: 0,
                  maxWidth: 600,
                  textWrap: 'pretty',
                }}
              >
                Amma calls one number and asks, in Tamil, how many have
                confirmed from her side. Or Inai calls her about the one thing
                she is handling. She never installs anything. This is the
                part no other tool does.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: 8 }}>
              <div
                style={{
                  width: 320,
                  maxWidth: '100%',
                  background: colors.paper,
                  border: `1px solid ${colors.hairline}`,
                  borderRadius: 24,
                  padding: 24,
                  boxSizing: 'border-box',
                  boxShadow: '0 32px 60px -34px rgba(0,0,0,.6)',
                  fontFamily: fonts.ui,
                  color: colors.ink2,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    paddingBottom: 18,
                    borderBottom: `1px solid ${colors.hairline}`,
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      flex: 'none',
                      borderRadius: '50%',
                      background: colors.greenTint,
                      color: colors.green,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PhoneCall aria-hidden style={{ display: 'flex', width: 20, height: 20 }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>Inai calling</b>
                    <span style={{ fontSize: 13, color: colors.muted }}>Amma · Tamil · 2 min</span>
                  </span>
                </div>
                <p lang="ta" style={{ margin: '18px 0 0', fontSize: 17, lineHeight: 1.55 }}>
                  சாப்பாடு மெனு முடிஞ்சாச்சா?
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: colors.muted }}>
                  "Has the food menu been settled?"
                </p>
                <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.55, color: colors.ink2 }}>
                  Not yet. Eight dishes still to choose. Shall I remind you?
                </p>
                <p style={{ margin: '16px 0 0', fontSize: 13, color: colors.muted }}>
                  Read back and logged. No app, no typing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: colors.paper,
          fontFamily: fonts.sans,
          padding: '160px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 1152, margin: '0 auto' }}>
          <h2
            style={{
              fontFamily: fonts.serif,
              fontWeight: 400,
              fontSize: 'clamp(30px,4.4vw,48px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: colors.ink2,
              margin: '0 0 80px',
              maxWidth: 640,
              textWrap: 'pretty',
            }}
          >
            From the first vote to the last pickup.
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
              gap: 72,
              alignItems: 'start',
            }}
          >
            <div>
              <div
                style={{
                  borderRadius: 24,
                  background: colors.paperAlt,
                  padding: '36px 24px',
                  display: 'flex',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  marginBottom: 28,
                }}
              >
                <PhoneFrame>
                  <PhoneTopBar right="Decide" />
                  <div style={{ padding: '22px 20px 0' }}>
                    <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 4px' }}>Which mandap?</div>
                    <p style={{ fontSize: 13, color: colors.muted, margin: '0 0 16px' }}>From 12 ideas you pinned · grouped into 3</p>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      {[
                        ['linear-gradient(135deg,#E8A33D,#d98c1f)', 'Floral arch', true],
                        ['linear-gradient(135deg,#0E7C66,#0b6152)', 'Draped cloth', false],
                        ['linear-gradient(135deg,#a05a7a,#7d4460)', 'Temple style', false],
                      ].map(([bg, label, active]) => (
                        <div
                          key={label as string}
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            overflow: 'hidden',
                            border: `2px solid ${active ? colors.green : colors.hairline}`,
                            background: '#FFFFFF',
                          }}
                        >
                          <div style={{ height: 72, background: bg as string }} />
                          <div style={{ padding: '9px 6px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{label as string}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#FBEFD8', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#8a5a12', marginBottom: 16 }}>
                      <b style={{ color: '#6d4407' }}>Amma makes the final call.</b> Your vote helps her choose.
                    </div>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 16,
                        border: 'none',
                        background: colors.green,
                        color: '#FFFFFF',
                        fontFamily: fonts.ui,
                        fontSize: 18,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Vote: Floral arch
                    </button>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: 12,
                        border: 'none',
                        background: 'transparent',
                        color: colors.green,
                        fontFamily: fonts.ui,
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 8,
                      }}
                    >
                      See all 12 ideas
                    </button>
                  </div>
                  <TabBar active="decide" />
                </PhoneFrame>
              </div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontWeight: 400,
                  fontSize: 'clamp(26px,3.4vw,36px)',
                  lineHeight: 1.15,
                  letterSpacing: '-0.015em',
                  color: colors.ink2,
                  margin: '0 0 14px',
                }}
              >
                Decisions, settled.
              </h3>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: colors.muted, margin: 0, maxWidth: 480, textWrap: 'pretty' }}>
                Your Pinterest pins become a vote the family can actually
                finish, with a real person as the decider.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 24 }}>
              {[
                ['Budget in real time.', 'Watch the total move, and know the moment it goes over.', false],
                ['Guest travel, sorted.', 'Every arrival, pickup, and shared cab, grouped by who lands when and where.', true],
                ['Leaving times for everyone.', 'Each person is told when to leave, adjusted for live traffic. Parents get a call.', true],
              ].map(([title, body, border], i) => (
                <div
                  key={title as string}
                  style={{
                    padding: i === 0 ? '0 0 32px' : '32px 0',
                    borderTop: border ? `1px solid ${colors.hairline}` : undefined,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: fonts.serif,
                      fontWeight: 400,
                      fontSize: 24,
                      lineHeight: 1.2,
                      letterSpacing: '-0.015em',
                      color: colors.ink2,
                      margin: '0 0 10px',
                    }}
                  >
                    {title as string}
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.7, color: colors.muted, margin: 0, maxWidth: 420, textWrap: 'pretty' }}>
                    {body as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="join"
        style={{
          background: colors.ink,
          fontFamily: fonts.sans,
          padding: '176px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: fonts.serif,
              fontWeight: 400,
              fontSize: 'clamp(34px,5.6vw,60px)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: colors.cream,
              margin: '0 0 36px',
            }}
          >
            Let the group chat rest.
          </h2>
          <form
            onSubmit={e => {
              e.preventDefault();
              setSubmitted(true);
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}
          >
            <label
              htmlFor="inai-email"
              style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
            >
              Your email
            </label>
            <input
              id="inai-email"
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                flex: '1 1 240px',
                minWidth: 0,
                height: 48,
                borderRadius: 12,
                background: 'rgba(22,17,13,0.55)',
                border: '1px solid rgba(246,241,232,0.18)',
                color: colors.cream,
                fontFamily: fonts.sans,
                fontSize: 16,
                padding: '0 16px',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              style={{
                height: 48,
                borderRadius: 12,
                background: colors.green,
                color: '#FFFFFF',
                border: 'none',
                padding: '0 24px',
                fontFamily: fonts.sans,
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Join now
            </button>
          </form>
          {submitted && (
            <p style={{ fontSize: 15, color: colors.creamMuted, margin: '16px 0 0' }}>
              Thank you. We will be in touch soon.
            </p>
          )}
        </div>
      </section>

      <footer style={{ background: colors.ink, fontFamily: fonts.sans, padding: '0 24px 48px', boxSizing: 'border-box' }}>
        <div
          style={{
            maxWidth: 1152,
            margin: '0 auto',
            borderTop: '1px solid rgba(246,241,232,0.14)',
            paddingTop: 32,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontFamily: fonts.serif, fontWeight: 400, fontSize: 22, letterSpacing: '-0.01em', color: colors.cream }}>Inai</span>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
            <a href="#how" style={navLink}>How it works</a>
            <a href="#families" style={navLink}>For families</a>
            <a href="#privacy" style={navLink}>Privacy</a>
            <a href="#contact" style={navLink}>Contact</a>
          </nav>
        </div>
        <div style={{ maxWidth: 1152, margin: '0 auto', paddingTop: 28 }}>
          <p style={{ fontSize: 14, color: 'rgba(246,241,232,0.6)', margin: 0 }}>© 2026 Inai</p>
        </div>
      </footer>
    </div>
  );
}
