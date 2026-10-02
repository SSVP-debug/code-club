import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Zap, Flame, CheckCircle2, Coins, RotateCcw, Shuffle, CalendarCheck, User as UserIcon } from "lucide-react";
import { useAppContext } from "../hooks/useAppContext";
import { usePremium } from "../hooks/usePremium";
import { getDailyChallenge } from "../utils/dailyChallenge";
import { getLastVisitedProblem } from "../utils/recentProblem";
import { buildLoginRedirect } from "../utils/authRedirect";
import { fetchMyBalance } from "../services/rewardsApi";
import { apiFetchOptional } from "../services/api";

function AvatarDropdown({ user, isGuest = false, onLogout, mobile = false }) {
  const [open, setOpen] = useState(false);
  const [dailyChallengeSlug, setDailyChallengeSlug] = useState(null);
  const [creditsBalance, setCreditsBalance] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { totalXP, currentStreak, solvedProblems, role } = useAppContext();
  const { monetizationEnabled, isPremium } = usePremium();
  const isStudent = role === "student" || !role;
  const lastVisitedSlug = getLastVisitedProblem();

  async function goToRandomProblem() {
    const problems = await apiFetchOptional("/api/problems");
    if (!Array.isArray(problems) || problems.length === 0) return;
    const pick = problems[Math.floor(Math.random() * problems.length)];
    setOpen(false);
    navigate(`/problems/${pick.slug}`);
  }

  useEffect(() => {
    if (!open || dailyChallengeSlug) return;
    let cancelled = false;
    getDailyChallenge()
      .then((dc) => { if (!cancelled) setDailyChallengeSlug(dc.slug); })
      .catch(() => { if (!cancelled) setDailyChallengeSlug(null); });
    return () => { cancelled = true; };
  }, [open, dailyChallengeSlug]);

  useEffect(() => {
    if (!open || isGuest || !isStudent || creditsBalance !== null) return;
    let cancelled = false;
    fetchMyBalance()
      .then((bal) => { if (!cancelled) setCreditsBalance(bal); })
      .catch(() => { if (!cancelled) setCreditsBalance(0); });
    return () => { cancelled = true; };
  }, [open, isGuest, isStudent, creditsBalance]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setOpen((prev) => !prev)} className="focus:outline-none">
        {isGuest ? (
          <div className={mobile ? "w-8 h-8 rounded-full bg-[var(--surface-elevated)] border border-dashed border-[var(--border-strong)] flex items-center justify-center" : "w-9 h-9 rounded-full bg-[var(--surface-elevated)] border border-dashed border-[var(--border-strong)] flex items-center justify-center"} title="Guest session">
            <UserIcon size={mobile ? 14 : 16} className="text-[var(--muted-foreground)]" aria-hidden="true" />
          </div>
        ) : user?.photoURL ? (
          <img src={user.photoURL} alt={user.displayName ?? "User"} className={mobile ? "w-8 h-8 rounded-full border border-[var(--border-strong)]" : "w-9 h-9 rounded-full border border-[var(--border-strong)]"} />
        ) : (
          <div className={mobile ? "w-8 h-8 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-sm" : "w-9 h-9 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-sm"}>
            {user?.displayName?.charAt(0)}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden">
          {isGuest ? (
            <>
              <div className="px-4 py-4 border-b border-[var(--border)]"><p className="font-semibold">Guest Session</p><p className="text-xs text-[var(--muted-foreground)]">Sign in to save your progress and unlock the rest of Code Club.</p></div>
              <div className="p-2"><Link to={buildLoginRedirect(location.pathname + location.search)} onClick={() => setOpen(false)} className="block w-full text-center rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 font-semibold hover:opacity-90">Sign In</Link></div>
            </>
          ) : (
            <>
              <div className="px-4 py-4 border-b border-[var(--border)]">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{user?.displayName}</p>{monetizationEnabled && <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPremium ? "bg-[var(--theme-primary,#2dd4bf)]/15 text-[var(--theme-primary,#2dd4bf)]" : "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"}`}>{isPremium ? "Pro" : "Free"}</span>}</div>
                <p className="text-xs text-[var(--muted-foreground)]">{user?.email}</p>
              </div>

              {isStudent && <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-[var(--border)]">
                <div className="flex flex-col items-center gap-1"><Zap size={14} className="text-yellow-400" /><span className="text-sm font-semibold">{totalXP ?? 0}</span><span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">XP</span></div>
                <div className="flex flex-col items-center gap-1"><Flame size={14} className="text-orange-400" /><span className="text-sm font-semibold">{currentStreak ?? 0}</span><span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Streak</span></div>
                <div className="flex flex-col items-center gap-1"><CheckCircle2 size={14} className="text-green-400" /><span className="text-sm font-semibold">{solvedProblems?.length ?? 0}</span><span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Solved</span></div>
                <Link to="/credits" onClick={() => setOpen(false)} className="flex flex-col items-center gap-1 rounded-lg hover:bg-[var(--surface-elevated)] transition py-0.5"><Coins size={14} style={{ color: "var(--theme-primary, #2dd4bf)" }} /><span className="text-sm font-semibold">{creditsBalance ?? 0}</span><span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Credits</span></Link>
              </div>}

              {isStudent && <div className="py-2 border-b border-[var(--border)]">
                <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Quick Actions</p>
                {lastVisitedSlug && <Link to={`/problems/${lastVisitedSlug}`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[var(--surface-elevated)] text-sm"><RotateCcw size={14} className="text-[var(--muted-foreground)]" />Resume Problem</Link>}
                <button onClick={goToRandomProblem} className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-[var(--surface-elevated)] text-sm text-left"><Shuffle size={14} className="text-[var(--muted-foreground)]" />Random Problem</button>
                {dailyChallengeSlug && <Link to={`/problems/${dailyChallengeSlug}`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[var(--surface-elevated)] text-sm"><CalendarCheck size={14} className="text-[var(--muted-foreground)]" />Daily Challenge</Link>}
              </div>}

              <div className="py-2">
                {role !== "admin" && <Link to="/profile" onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-[var(--surface-elevated)]">View Profile</Link>}
                <Link to="/settings" onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-[var(--surface-elevated)]">Settings</Link>
                {role !== "admin" && <Link to="/pricing" onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-[var(--surface-elevated)]">Pricing</Link>}
              </div>
              <div className="border-t border-[var(--border)] p-2"><button onClick={onLogout} className="w-full rounded-lg bg-[var(--foreground)] text-[var(--background)] py-2 font-semibold hover:opacity-90">Logout</button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AvatarDropdown;
