import { Link } from "react-router-dom";
import Button from "../ui/Button";
import BWModeToggle from "../common/BWModeToggle";

function LandingNav({ user }) {
  return (
    <nav className="lp-hero-nav absolute inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-transparent px-6 md:px-12">
      <Link
        to="/"
        className="lp-hero-nav-logo flex items-center font-display text-lg font-semibold tracking-tight text-white"
      >
        Code Club
        <span className="text-[var(--accent-text)]">.</span>
      </Link>

      <div className="flex items-center gap-2 md:gap-4">
        <Link
          to={user ? "/problems" : "/login?role=student"}
          className="hidden px-3 py-2 text-sm text-white/70 transition hover:text-white sm:inline-block"
        >
          Problems
        </Link>

        <div className="rounded-full border border-white/10 bg-black/20 p-1 backdrop-blur-sm">
          <BWModeToggle />
        </div>

        <Button to={user ? "/dashboard" : "/portal"} variant="theme" size="sm">
          {user ? "Dashboard →" : "Get Started"}
        </Button>
      </div>
    </nav>
  );
}

export default LandingNav;
