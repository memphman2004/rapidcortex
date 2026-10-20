/**
 * Full-viewport public-safety photograph behind the sign-in card.
 * The photo stays fixed; a light navy wash keeps the form readable.
 */
export function LoginBackground() {
  return (
    <div className="rc-login-scene" aria-hidden>
      <img
        className="rc-login-scene__photo"
        src="/login/nexcort-network-bg.jpg"
        alt=""
        width={1024}
        height={576}
        decoding="sync"
        fetchPriority="high"
      />
      <div className="rc-login-scene__shade" />
      <div className="rc-login-scene__glow-red" />
      <div className="rc-login-scene__glow-blue" />
    </div>
  );
}
