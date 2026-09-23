import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function TpoBillingPanel({ onActivated }) {
  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [billing, catalog] = await Promise.all([
        apiFetch("/api/tpo/billing/status"),
        apiFetch("/api/tpo/billing/plans"),
      ]);
      setStatus(billing);
      setPlans(catalog.plans || []);
    } catch (err) {
      toast.error(err.message || "Failed to load institution billing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function purchase(planId) {
    setBuying(planId);
    try {
      const order = await apiFetch("/api/tpo/billing/create-order", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load the payment gateway.");

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Code Club",
        description: "Institution plan — " + (plans.find(p => p.id === planId)?.label || planId),
        handler: async (response) => {
          try {
            const result = await apiFetch("/api/tpo/billing/verify", {
              method: "POST",
              body: JSON.stringify({ ...response, planId }),
            });
            if (!result.success) throw new Error(result.error || "Payment verification failed.");
            toast.success("Institution subscription activated.");
            await load();
            onActivated?.();
          } catch (err) {
            toast.error(err.message || "Payment verification failed.");
          } finally {
            setBuying(null);
          }
        },
        modal: {
          ondismiss: () => setBuying(null),
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err.message || "Could not start institution payment.");
      setBuying(null);
    }
  }

  async function cancelSubscription() {
    if (!window.confirm("Cancel this institution subscription? Access will remain available until the paid period ends.")) return;
    setCancelling(true);
    try {
      await apiFetch("/api/tpo/billing/cancel", { method: "POST" });
      toast.success("Institution subscription cancelled. Access remains active until expiry.");
      await load();
      onActivated?.();
    } catch (err) {
      toast.error(err.message || "Could not cancel the institution subscription.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">Loading institution billing…</div>;
  }

  const active = status?.subscription?.isActive;
  const cancelled = status?.subscription?.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        <p className="text-xs uppercase tracking-widest font-semibold text-[var(--muted-foreground)]">Institution subscription</p>
        <h2 className="text-2xl font-black text-[var(--foreground)] mt-1">{status?.collegeName || "Your college"}</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">
          Billing belongs to your college, so access continues even if the primary TPO changes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 items-center">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--surface-elevated)] border border-[var(--border)]">
            {status?.subscription?.plan || "none"}
          </span>
          <span className={"px-3 py-1.5 rounded-full text-xs font-semibold " + (active ? "bg-verdict-accept/10 text-verdict-accept" : "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]")}>
            {status?.subscription?.status === "cancelled" ? "Cancelled" : active ? "Active" : "No active plan"}
          </span>
          {status?.subscription?.expiresAt && (
            <span className="text-xs text-[var(--muted-foreground)]">
              Access until {new Date(status.subscription.expiresAt).toLocaleDateString()}
            </span>
          )}
          {active && status?.subscription?.daysRemaining != null && (
            <span className={"text-xs font-medium " + (status.subscription.daysRemaining <= 7 ? "text-amber-400" : "text-[var(--muted-foreground)]")}>
              {status.subscription.daysRemaining} day{status.subscription.daysRemaining === 1 ? "" : "s"} remaining
            </span>
          )}
        </div>
      </div>

      {active && status?.subscription?.renewalRequired && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
          <h3 className="font-bold text-[var(--foreground)]">
            {status.subscription.daysRemaining === 0 ? "Subscription expired" : "Renewal coming up"}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {status.subscription.daysRemaining === 0
              ? "Choose a plan below to restore institutional access."
              : "Your paid period ends soon. Renew before expiry to keep the TPO workspace uninterrupted."}
          </p>
        </div>
      )}

      {!status?.billingEnabled ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="font-bold text-[var(--foreground)]">Institution billing is not live</h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Your college can continue using the TPO workspace during the pilot.
          </p>
        </div>
      ) : (!active || cancelled) ? (
        <div>
          {cancelled && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-4">
              <h3 className="font-bold text-[var(--foreground)]">Subscription cancelled</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-2">
                Access remains available until {status?.subscription?.expiresAt ? new Date(status.subscription.expiresAt).toLocaleDateString() : "the end of the paid period"}.
              </p>
              {status?.isPrimary && (
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                  You can purchase a new plan now to continue without an interruption.
                </p>
              )}
            </div>
          )}
          <div>
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Choose an institution plan</h3>
            <p className="text-sm text-[var(--muted-foreground)]">Only the primary TPO can purchase or manage the college subscription.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                <h4 className="font-bold text-[var(--foreground)]">{plan.label}</h4>
                <p className="mt-2">
                  <span className="text-3xl font-black text-[var(--foreground)]">₹{plan.amountRupees.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-[var(--muted-foreground)]">/{plan.interval === "monthly" ? "month" : "year"}</span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-2">Covers the institution's TPO workspace for {plan.durationDays} days.</p>
                <Button className="w-full mt-5" onClick={() => purchase(plan.id)} loading={buying === plan.id} disabled={Boolean(buying)}>
                  {buying === plan.id ? "Opening payment…" : "Subscribe"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : active && status?.isPrimary ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={cancelSubscription} loading={cancelling} disabled={cancelling}>
            Cancel subscription
          </Button>
        </div>
      ) : null}
    </div>
  );
}
