import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Coins,
  Gift,
  Info,
  Package,
  Users,
  X,
  History,
  ShoppingBag,
} from "lucide-react";
import PageMeta from "../components/seo/PageMeta";
import DashboardLayout from "../layouts/DashboardLayout";
import SectionCard from "../components/ui/layout/SectionCard";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/feedback/EmptyState";
import { fetchMyBalance, fetchMyLedger } from "../services/rewardsApi";
import {
  fetchStoreItems,
  requestRedemption,
  fetchMyRedemptions,
  cancelRedemption,
} from "../services/rewardStoreApi";

const TYPE_LABELS = {
  CONTRIBUTION_APPROVED: "Contribution approved",
  REFERRAL_QUALIFIED: "Referral qualified",
  FEATURE_REQUEST_SHIPPED: "Feature request shipped",
  REDEMPTION_DEBIT: "Reward redeemed",
  REDEMPTION_REVERSED: "Redemption refunded",
};

const SOURCE_ICONS = {
  CONTRIBUTION: Gift,
  REFERRAL: Users,
  FEATURE_REQUEST: Gift,
  REDEMPTION: ShoppingBag,
};

const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-400",
  fulfilled: "bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)]",
  rejected: "bg-red-500/10 text-red-400",
  cancelled: "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]",
};

const VIEWS = [
  { value: "overview", label: "Overview" },
  { value: "rewards", label: "Rewards Store" },
  { value: "activity", label: "Activity" },
];

const EMPTY_ADDRESS = {
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function amountLabel(amount) {
  return amount > 0 ? `+${amount}` : String(amount);
}

function entryDescription(entry) {
  if (entry.type === "REDEMPTION_DEBIT") {
    return entry.metadata?.itemName || "Reward redeemed";
  }
  if (entry.type === "REDEMPTION_REVERSED") {
    return entry.metadata?.itemName ? `${entry.metadata.itemName} — refund` : "Redemption refunded";
  }
  return TYPE_LABELS[entry.type] ?? entry.type;
}

export default function CreditsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("tab");
  const activeView = VIEWS.some((view) => view.value === requestedView) ? requestedView : "overview";

  const [balance, setBalance] = useState(null);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redemptionsLoaded, setRedemptionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [shippingTarget, setShippingTarget] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState(null);

  const loadBalanceAndLedger = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [bal, ledger, store] = await Promise.all([
        fetchMyBalance(),
        fetchMyLedger({ page: 1 }),
        fetchStoreItems(),
      ]);
      setBalance(bal);
      setEntries(ledger.entries || []);
      setTotal(ledger.total || 0);
      setPage(1);
      setItems(store.items || []);
    } catch (err) {
      setError(err.message || "Failed to load Credits.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  const loadRedemptions = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoadingRedemptions(true);
    try {
      const data = await fetchMyRedemptions();
      setRedemptions(data.redemptions || []);
      setRedemptionsLoaded(true);
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to load redemptions." });
    } finally {
      if (showSpinner) setLoadingRedemptions(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBalanceAndLedger();
  }, [loadBalanceAndLedger]);

  useEffect(() => {
    if (activeView === "activity" && !redemptionsLoaded) {
      loadRedemptions();
    }
  }, [activeView, redemptionsLoaded, loadRedemptions]);

  const hasMore = entries.length < total;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const ledger = await fetchMyLedger({ page: nextPage });
      setEntries((prev) => [...prev, ...(ledger.entries || [])]);
      setTotal(ledger.total || 0);
      setPage(nextPage);
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to load more activity." });
    } finally {
      setLoadingMore(false);
    }
  }

  function selectView(value) {
    setSearchParams(value === "overview" ? {} : { tab: value });
  }

  function openRedeem(item) {
    if (item.requiresShipping) {
      setShippingTarget(item);
      return;
    }
    doRedeem(item, null);
  }

  async function doRedeem(item, shippingAddress) {
    setBusyId(item._id);
    try {
      await requestRedemption(item._id, shippingAddress);
      setToast({ type: "success", message: `Redeemed "${item.name}". Credits are now held against this redemption.` });
      setShippingTarget(null);
      setAddressForm(EMPTY_ADDRESS);
      setRedemptionsLoaded(false);
      await loadBalanceAndLedger({ showSpinner: false });
      await loadRedemptions({ showSpinner: false });
      selectView("activity");
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to redeem." });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id) {
    setBusyId(id);
    try {
      await cancelRedemption(id);
      setToast({ type: "success", message: "Redemption cancelled — Credits refunded." });
      setRedemptionsLoaded(false);
      await loadBalanceAndLedger({ showSpinner: false });
      await loadRedemptions({ showSpinner: false });
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to cancel." });
    } finally {
      setBusyId(null);
    }
  }

  const addressComplete = ["recipientName", "line1", "city", "state", "postalCode", "country"].every(
    (field) => addressForm[field].trim().length > 0
  );

  const recentEntries = useMemo(() => entries.slice(0, 5), [entries]);

  return (
    <DashboardLayout>
      <PageMeta title="Credits · Code Club" path="/credits" />

      <div className="max-w-5xl mx-auto">
        <Link
          to="/club"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition mb-4"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          Back to Club
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Credits</h1>
              <button
                type="button"
                onClick={() => setShowInfo(true)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
                aria-label="How Credits work"
                title="How Credits work"
              >
                <Info size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[var(--muted-foreground)] mt-1 text-sm">
              Earn Credits through Code Club and use them in the Rewards Store.
            </p>
          </div>

          <SectionCard className="!m-0 min-w-[190px]" padding="sm">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--theme-primary, #2dd4bf)", opacity: 0.15 }}
              >
                <Coins size={20} style={{ color: "var(--theme-primary, #2dd4bf)" }} aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--foreground)] leading-tight">{balance ?? 0}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Available Credits</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {toast && (
          <div
            className={`mb-4 text-sm px-3 py-2 rounded-lg ${
              toast.type === "error"
                ? "bg-red-500/10 text-red-400"
                : "bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)]"
            }`}
          >
            {toast.message}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {VIEWS.map((view) => (
            <button
              key={view.value}
              type="button"
              onClick={() => selectView(view.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                activeView === view.value
                  ? "bg-white text-black"
                  : "bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        {loading ? (
          <SectionCard>
            <p className="text-[var(--muted-foreground)] text-sm">Loading your Credits…</p>
          </SectionCard>
        ) : activeView === "overview" ? (
          <Overview
            balance={balance}
            recentEntries={recentEntries}
            onViewRewards={() => selectView("rewards")}
            onViewActivity={() => selectView("activity")}
            onInfo={() => setShowInfo(true)}
          />
        ) : activeView === "rewards" ? (
          <Rewards
            items={items}
            balance={balance}
            busyId={busyId}
            onRedeem={openRedeem}
          />
        ) : (
          <Activity
            entries={entries}
            total={total}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            redemptions={redemptions}
            loadingRedemptions={loadingRedemptions}
            onCancel={handleCancel}
            onViewRewards={() => selectView("rewards")}
          />
        )}
      </div>

      {showInfo && <CreditsInfo onClose={() => setShowInfo(false)} />}

      {shippingTarget && (
        <ShippingAddressPanel
          item={shippingTarget}
          addressForm={addressForm}
          addressComplete={addressComplete}
          busy={busyId === shippingTarget._id}
          onChange={setAddressForm}
          onClose={() => setShippingTarget(null)}
          onConfirm={() => doRedeem(shippingTarget, addressForm)}
        />
      )}
    </DashboardLayout>
  );
}

function Overview({ balance, recentEntries, onViewRewards, onViewActivity, onInfo }) {
  return (
    <div className="space-y-6">
      <SectionCard accented>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Balance</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{balance ?? 0}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Credits available to spend</p>
          </div>
          <div className="sm:border-l sm:border-[var(--border)] sm:pl-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Spend</p>
            <button type="button" onClick={onViewRewards} className="mt-1 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--theme-primary,#2dd4bf)] transition">
              Browse Rewards Store →
            </button>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Use Credits on available perks and merchandise.</p>
          </div>
          <div className="sm:border-l sm:border-[var(--border)] sm:pl-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Learn</p>
            <button type="button" onClick={onInfo} className="mt-1 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--theme-primary,#2dd4bf)] transition">
              How Credits work →
            </button>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Understand earning, spending and refunds.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent activity"
        subtitle="Your latest Credits movements."
        action={
          <button type="button" onClick={onViewActivity} className="text-sm text-[var(--theme-primary,#2dd4bf)] hover:brightness-110 transition">
            View all
          </button>
        }
      >
        {recentEntries.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">
            No Credits activity yet. Start by contributing or referring a friend.
          </p>
        ) : (
          <LedgerList entries={recentEntries} />
        )}
      </SectionCard>
    </div>
  );
}

function Rewards({ items, balance, busyId, onRedeem }) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Rewards Store"
        subtitle="Spend your Credits on available perks and merchandise."
        icon={<ShoppingBag size={18} strokeWidth={2} />}
      >
        {items.length === 0 ? (
          <EmptyState
            icon="🎁"
            title="Nothing in the store yet"
            description="Check back soon — new rewards are added regularly."
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <StoreItemCard
                key={item._id}
                item={item}
                balance={balance}
                busy={busyId === item._id}
                onRedeem={() => onRedeem(item)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Activity({
  entries,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  redemptions,
  loadingRedemptions,
  onCancel,
  onViewRewards,
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Credits activity" subtitle="Every Credits movement, newest first." icon={<History size={18} strokeWidth={2} />}>
        {entries.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm">No Credits activity yet.</p>
        ) : (
          <>
            <LedgerList entries={entries} />
            {hasMore && (
              <div className="pt-4">
                <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={loadingMore} loading={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
            {!hasMore && total > 0 && (
              <p className="text-xs text-[var(--muted-foreground)] pt-4">Showing all {total} entries.</p>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="My redemptions" subtitle="Track rewards you've requested and their current status." icon={<Package size={18} strokeWidth={2} />}>
        {loadingRedemptions ? (
          <p className="text-[var(--muted-foreground)] text-sm">Loading redemptions…</p>
        ) : redemptions.length === 0 ? (
          <div className="text-sm">
            <p className="text-[var(--muted-foreground)]">No redemptions yet.</p>
            <button type="button" onClick={onViewRewards} className="mt-2 text-[var(--theme-primary,#2dd4bf)] hover:brightness-110">
              Browse the Rewards Store →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {redemptions.map((redemption) => (
              <RedemptionRow
                key={redemption._id}
                redemption={redemption}
                busy={onCancel && false}
                onCancel={onCancel}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function LedgerList({ entries }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {entries.map((entry) => {
        const Icon = SOURCE_ICONS[entry.sourceType] ?? Coins;
        const isReversed = entry.status === "reversed";
        const isDebit = entry.amount < 0;
        return (
          <div key={entry._id} className={`flex items-center justify-between gap-3 py-3 ${isReversed ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
              <Icon size={16} strokeWidth={2} className="text-[var(--muted-foreground)] flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-[var(--foreground)] truncate">
                  {entryDescription(entry)}
                  {isReversed && <span className="ml-2 text-xs text-[var(--muted-foreground)] font-normal">Reversed</span>}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">{formatDate(entry.createdAt)}</p>
              </div>
            </div>
            <span
              className={`text-sm font-semibold flex-shrink-0 ${
                isReversed
                  ? "text-[var(--muted-foreground)] line-through"
                  : isDebit
                    ? "text-red-400"
                    : "text-[var(--theme-primary,#2dd4bf)]"
              }`}
            >
              {amountLabel(entry.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StoreItemCard({ item, balance, busy, onRedeem }) {
  const canAfford = (balance ?? 0) >= item.costCredits;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[var(--foreground)] font-semibold text-sm">{item.name}</p>
        {item.requiresShipping && (
          <Package size={14} strokeWidth={2} className="text-[var(--muted-foreground)] flex-shrink-0" aria-hidden="true" />
        )}
      </div>
      <p className="text-[var(--muted-foreground)] text-xs mb-3 flex-1">{item.description}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]">
          <Coins size={13} style={{ color: "var(--theme-primary, #2dd4bf)" }} aria-hidden="true" />
          {item.costCredits}
        </span>
        <Button size="sm" onClick={onRedeem} disabled={!canAfford || busy} loading={busy}>
          {canAfford ? "Redeem" : "Not enough Credits"}
        </Button>
      </div>
    </div>
  );
}

function RedemptionRow({ redemption, busy, onCancel }) {
  const { itemSnapshot, status, createdAt, adminNotes } = redemption;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              STATUS_STYLES[status] || "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
            }`}>
              {status}
            </span>
          </div>
          <p className="text-[var(--foreground)] font-medium text-sm mt-1 truncate">{itemSnapshot.name}</p>
          <p className="text-[var(--muted-foreground)] text-xs mt-0.5">
            {itemSnapshot.costCredits} Credits · {formatDate(createdAt)}
          </p>
        </div>

        {status === "pending" && (
          <Button size="sm" variant="secondary" onClick={() => onCancel(redemption._id)} disabled={busy} loading={busy}>
            Cancel
          </Button>
        )}
      </div>

      {adminNotes && (status === "fulfilled" || status === "rejected") && (
        <p className="text-[var(--muted-foreground)] text-xs mt-2 border-t border-[var(--border)] pt-2">Note: {adminNotes}</p>
      )}
    </div>
  );
}

function CreditsInfo({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-info-title"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 id="credits-info-title" className="text-[var(--foreground)] font-bold text-lg">How Credits work</h2>
            <p className="text-[var(--muted-foreground)] text-sm mt-0.5">One balance for earning and rewards.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-3">
          <InfoStep icon={<Gift size={17} />} title="Earn Credits">
            Eligible Code Club activities can add Credits to your balance, such as approved contributions and qualified referrals.
          </InfoStep>
          <InfoStep icon={<ShoppingBag size={17} />} title="Spend Credits">
            Use Credits in the Rewards Store. Each reward has its own Credit cost.
          </InfoStep>
          <InfoStep icon={<Coins size={17} />} title="When you redeem">
            Credits are deducted when you request a reward, so the cost is held while your redemption is pending.
          </InfoStep>
          <InfoStep icon={<History size={17} />} title="If a redemption is cancelled or rejected">
            The spent Credits are returned through a refund entry in your Credits activity.
          </InfoStep>
        </div>

        <div className="mt-5 bg-[var(--surface-elevated)] rounded-xl px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
          Your Credits activity is recorded in one ledger, so earned Credits, spending and refunds can be followed from the same history.
        </div>
      </div>
    </div>
  );
}

function InfoStep({ icon, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] text-[var(--theme-primary,#2dd4bf)] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ShippingAddressPanel({ item, addressForm, addressComplete, busy, onChange, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-[var(--foreground)] font-bold text-base">Shipping address</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="text-[var(--muted-foreground)] text-sm mb-3">
          "{item.name}" ships to you — where should we send it?
        </p>
        <div className="space-y-2">
          {[
            ["recipientName", "Full name"],
            ["line1", "Address line 1"],
            ["line2", "Address line 2 (optional)"],
            ["city", "City"],
            ["state", "State"],
            ["postalCode", "Postal code"],
            ["country", "Country"],
          ].map(([field, placeholder]) => (
            <input
              key={field}
              placeholder={placeholder}
              value={addressForm[field]}
              onChange={(e) => onChange((prev) => ({ ...prev, [field]: e.target.value }))}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--theme-primary,#2dd4bf)]"
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} disabled={!addressComplete || busy} loading={busy}>
            Confirm redemption
          </Button>
        </div>
      </div>
    </div>
  );
}
