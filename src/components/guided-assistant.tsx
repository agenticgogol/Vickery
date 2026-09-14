"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/data";
import { formatRupees } from "@/lib/data";
import {
  createSlot,
  getAssistantContext,
  interpretAssistantIntent,
  submitBid,
} from "@/lib/actions";
import { publishDataChange, subscribeToDataChanges } from "@/lib/live-sync";

type Message = {
  id: string;
  role: "guide" | "user" | "activity";
  text: string;
  action?: { label: string; href: string; release?: Record<string, string> };
};
type Conversation = {
  task?: "release" | "campaign";
  step: number;
  details: Record<string, string>;
};
type AssistantContext = {
  billboards: { id: string; name: string; area: string }[];
  advertisers: { id: string; name: string }[];
  openSlots: {
    id: string;
    billboardId: string;
    billboardName: string;
    date: string;
    startTime: string;
    endTime: string;
    reservePrice: number;
  }[];
  creatives: { id: string; advertiserId: string; name: string }[];
};
type CreateSlotProposal = {
  kind: "create_slot";
  billboardId: string;
  billboardName: string;
  date: string;
  startTime: string;
  endTime: string;
  reservePrice: number;
};
type SubmitBidProposal = {
  kind: "submit_bid";
  slotId: string;
  billboardName: string;
  date: string;
  startTime: string;
  endTime: string;
  advertiserId: string;
  advertiserName: string;
  creativeId: string;
  creativeName: string;
  amount: number;
  reservePrice: number;
};
type Proposal = CreateSlotProposal | SubmitBidProposal;
const labels: Record<string, string> = {
  billboard: "Billboard saved",
  inventory: "Inventory released or updated",
  auction: "Auction closed or updated",
  bid: "A bid was submitted",
  campaign: "Campaign brief saved",
  creative: "Creative asset saved or reviewed",
  playback: "Proof of play updated",
  settlement: "Settlement updated",
  reset: "Seeded demo restored",
};

function initial(role: Role): Message[] {
  return [
    {
      id: "welcome",
      role: "guide",
      text:
        role === "owner"
          ? "What would you like to do? I can release a slot for you directly — try “Release Gachibowli Flyover on 2026-09-08, 18:00-19:00, reserve 8000” — or guide you elsewhere."
          : "What would you like to do? I can place a bid for you directly — try “Bid 12000 on Cyber Towers Landmark”— or guide you elsewhere.",
    },
  ];
}
function resolve(role: Role, text: string) {
  const value = text.toLowerCase();
  if (role === "owner") {
    if (/(billboard|screen|asset)/.test(value))
      return {
        href: "/owner",
        reply:
          "Open Owner portal. Use Add billboard to create or edit your screen asset.",
      };
    if (/(release|create|slot|inventory|available)/.test(value))
      return {
        href: "/owner",
        reply:
          "Open Owner portal, or tell me the billboard, date, time window and reserve price together and I’ll release it directly.",
      };
    if (/(close|auction|bid|clearing)/.test(value))
      return {
        href: "/owner",
        reply:
          "Open Owner portal. Auction-open slots show their projected clearing price and a Close auction action — closing an auction stays a manual step I won’t take for you.",
      };
    return {
      href: "/owner",
      reply:
        "I can release inventory directly, or guide you to manage billboards or close an auction. Try “release Friday evening inventory”.",
    };
  }
  if (/(campaign|plan|bundle|reach)/.test(value))
    return {
      href: "/advertiser/campaigns",
      reply:
        "Open Campaigns. Set your budget, dates and creative, then choose Manual bids or Auto-bid.",
    };
  if (/(creative|asset|upload)/.test(value))
    return {
      href: "/advertiser/creatives",
      reply: "Open Creative library to add or reuse an approved creative.",
    };
  if (/(bid|buy|specific slot)/.test(value))
    return {
      href: "/advertiser",
      reply:
        "Open Marketplace. Select a slot, then choose Bid Now for the fast single-slot flow.",
    };
  return {
    href: "/advertiser",
    reply:
      "Open Marketplace to search and filter inventory. Try “find premium evening screens” or ask me to plan a campaign.",
  };
}

function continueConversation(
  role: Role,
  text: string,
  conversation: Conversation,
) {
  if (role === "owner") {
    if (conversation.task === "release") {
      if (conversation.step === 1) {
        conversation.details.billboard = text;
        conversation.step = 2;
        return {
          reply: `Great — I’ll prepare inventory for ${text}. What time window do you want to release? For example, “7–8 PM”.`,
        };
      }
      if (conversation.step === 2) {
        conversation.details.time = text;
        conversation.step = 3;
        return {
          reply: `Got it: ${conversation.details.billboard}, ${text}. What reserve price should we start with? You can say “₹10,000” or ask me to use the suggested range.`,
        };
      }
      conversation.details.reserve = text;
      conversation.task = undefined;
      return {
        reply: `Your release brief is ready: ${conversation.details.billboard}, ${conversation.details.time}, reserve ${text}. I’ll open the slot form so you can review and publish it yourself.`,
        action: {
          label: "Continue to Create slots",
          href: "/owner",
          release: conversation.details,
        },
      };
    }
    if (/(release|create.*slot|inventory)/i.test(text)) {
      conversation.task = "release";
      conversation.step = 1;
      conversation.details = { date: text };
      return {
        reply:
          "Great. I have your release timing in mind. Which billboard should I use?",
      };
    }
  }
  if (role === "advertiser" && /(campaign|plan)/i.test(text)) {
    if (conversation.task === "campaign") {
      conversation.task = undefined;
      return {
        reply: `I’ve noted your campaign goal: ${text}. Next, set a campaign name, budget, dates and creative; preferences are optional and activate Fit Score.`,
        action: {
          label: "Continue to Campaign builder",
          href: "/advertiser/campaigns",
        },
      };
    }
    conversation.task = "campaign";
    conversation.step = 1;
    conversation.details = {};
    return {
      reply:
        "Let’s plan it. What is the campaign objective or audience you want to reach?",
    };
  }
  const next = resolve(role, text);
  return {
    reply: next.reply,
    action: {
      label: `Open ${role === "owner" ? "Owner portal" : next.href.includes("campaign") ? "Campaign builder" : next.href.includes("creative") ? "Creative library" : "Marketplace"}`,
      href: next.href,
    },
  };
}

/** Resolves a parsed intent + grounding context into an executable proposal, or an error the human should fix. */
function buildProposal(
  role: Role,
  intent: { type: string; [key: string]: unknown },
  context: AssistantContext,
): { proposal: Proposal } | { error: string } {
  if (role === "owner" && intent.type === "create_slot") {
    const billboardName = intent.billboardName as string | undefined;
    const date = intent.date as string | undefined;
    const startTime = intent.startTime as string | undefined;
    const endTime = intent.endTime as string | undefined;
    const reservePrice = intent.reservePrice as number | undefined;
    const billboard = billboardName
      ? context.billboards.find(
          (item) => item.name.toLowerCase() === billboardName.toLowerCase(),
        )
      : undefined;
    if (!billboard)
      return {
        error:
          "Tell me which billboard, the date (YYYY-MM-DD), the time window, and the reserve price together — e.g. “Release Gachibowli Flyover on 2026-09-08, 18:00-19:00, reserve 8000”.",
      };
    if (!date || !startTime || !endTime || reservePrice === undefined)
      return {
        error: `I found ${billboard.name}, but I still need the date, start time, end time, and reserve price — all in one message.`,
      };
    return {
      proposal: {
        kind: "create_slot",
        billboardId: billboard.id,
        billboardName: billboard.name,
        date,
        startTime,
        endTime,
        reservePrice,
      },
    };
  }
  if (role === "advertiser" && intent.type === "submit_bid") {
    const billboardName = intent.billboardName as string | undefined;
    const amount = intent.amount as number | undefined;
    const advertiserName = intent.advertiserName as string | undefined;
    const date = intent.date as string | undefined;
    const startTime = intent.startTime as string | undefined;
    if (!billboardName || amount === undefined)
      return {
        error:
          "Tell me the billboard and your bid amount together — e.g. “Bid 12000 on Cyber Towers Landmark”.",
      };
    let candidates = context.openSlots.filter(
      (slot) => slot.billboardName.toLowerCase() === billboardName.toLowerCase(),
    );
    if (date) candidates = candidates.filter((slot) => slot.date === date);
    if (startTime) candidates = candidates.filter((slot) => slot.startTime === startTime);
    candidates = candidates
      .slice()
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    const slot = candidates[0];
    if (!slot)
      return {
        error: `I couldn’t find an open slot for “${billboardName}”${date ? ` on ${date}` : ""}. Check the marketplace for the exact billboard name and time.`,
      };
    const savedAdvertiserId =
      typeof window !== "undefined" ? window.localStorage.getItem("bx-demo-advertiser") : null;
    const advertiser = advertiserName
      ? context.advertisers.find(
          (item) => item.name.toLowerCase() === advertiserName.toLowerCase(),
        )
      : context.advertisers.find((item) => item.id === savedAdvertiserId);
    if (!advertiser)
      return {
        error: advertiserName
          ? `I don't recognize the advertiser "${advertiserName}". Options: ${context.advertisers.map((item) => item.name).join(", ")}.`
          : `Which advertiser is this bid for — ${context.advertisers.map((item) => item.name).join(", ")}?`,
      };
    const creative = context.creatives.find((item) => item.advertiserId === advertiser.id);
    if (!creative)
      return {
        error: `${advertiser.name} has no approved creative yet. Upload one in Creatives first, then ask me again.`,
      };
    return {
      proposal: {
        kind: "submit_bid",
        slotId: slot.id,
        billboardName: slot.billboardName,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        advertiserId: advertiser.id,
        advertiserName: advertiser.name,
        creativeId: creative.id,
        creativeName: creative.name,
        amount,
        reservePrice: slot.reservePrice,
      },
    };
  }
  return { error: "I didn't catch an action to take — try rephrasing, or use the buttons below." };
}

export function GuidedAssistant({ role }: { role: Role }) {
  const router = useRouter();
  const key = `bx-guide-${role}`;
  const contextKey = `${key}-context`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [assistantContext, setAssistantContext] = useState<AssistantContext | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isPending, startTransition] = useTransition();
  const sessionLoaded = useRef(false);
  const conversation = useRef<Conversation>({ step: 0, details: {} });
  const nudgeKey = "bx-guide-nudge-seen";
  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => {
    if (role === "admin") return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(nudgeKey) === "1";
    } catch {
      // ignore — storage may be unavailable (private mode etc.)
    }
    if (seen) return;
    const timer = window.setTimeout(() => setShowNudge(true), 1200);
    return () => window.clearTimeout(timer);
  }, [role]);
  function dismissNudge() {
    setShowNudge(false);
    try {
      window.localStorage.setItem(nudgeKey, "1");
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(key);
        const savedContext = window.sessionStorage.getItem(contextKey);
        setMessages(saved ? JSON.parse(saved) : initial(role));
        if (savedContext) conversation.current = JSON.parse(savedContext);
      } catch {
        setMessages(initial(role));
      }
      sessionLoaded.current = true;
    }, 0);
    return () => window.clearTimeout(restore);
  }, [contextKey, key, role]);
  useEffect(() => {
    if (sessionLoaded.current && messages.length)
      window.sessionStorage.setItem(key, JSON.stringify(messages.slice(-12)));
  }, [key, messages]);
  useEffect(
    () =>
      subscribeToDataChanges((source) => {
        if (!source || !labels[source]) return;
        setMessages((current) => [
          ...current,
          {
            id: `${source}-${Date.now()}`,
            role: "activity",
            text: labels[source],
          },
        ]);
      }),
    [],
  );
  useEffect(() => {
    if (role === "admin" || !open || assistantContext) return;
    startTransition(async () => {
      const context = await getAssistantContext(role === "owner" ? "owner" : "advertiser");
      setAssistantContext(context);
    });
  }, [assistantContext, open, role, startTransition]);
  if (role === "admin") return null;

  function pushMessages(...next: Message[]) {
    setMessages((current) => [...current, ...next]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || isPending) return;
    const text = input.trim();
    setInput("");
    pushMessages({ id: `user-${Date.now()}`, role: "user", text });
    startTransition(async () => {
      const context =
        assistantContext ??
        (await getAssistantContext(role === "owner" ? "owner" : "advertiser"));
      setAssistantContext(context);
      const { intent } = await interpretAssistantIntent({
        query: text,
        role: role === "owner" ? "owner" : "advertiser",
        billboardNames: context.billboards.map((item) => item.name),
        advertiserNames: context.advertisers.map((item) => item.name),
      });
      if (intent.type === "navigate") {
        const next = continueConversation(role, text, conversation.current);
        window.sessionStorage.setItem(contextKey, JSON.stringify(conversation.current));
        pushMessages({
          id: `guide-${Date.now()}`,
          role: "guide",
          text: next.reply,
          action: next.action,
        });
        return;
      }
      const result = buildProposal(role, intent, context);
      if ("error" in result) {
        pushMessages({ id: `guide-${Date.now()}`, role: "guide", text: result.error });
        return;
      }
      setProposal(result.proposal);
      pushMessages({
        id: `guide-${Date.now()}`,
        role: "guide",
        text: "Review the details below, then confirm — nothing is submitted until you do.",
      });
    });
  }

  function cancelProposal() {
    setProposal(null);
    pushMessages({
      id: `guide-cancel-${Date.now()}`,
      role: "guide",
      text: "Cancelled. Nothing was submitted.",
    });
  }

  function confirmProposal() {
    if (!proposal) return;
    startTransition(async () => {
      try {
        if (proposal.kind === "create_slot") {
          await createSlot({
            billboardId: proposal.billboardId,
            date: proposal.date,
            startTime: proposal.startTime,
            endTime: proposal.endTime,
            reservePrice: proposal.reservePrice,
          });
          publishDataChange("inventory");
          pushMessages({
            id: `guide-done-${Date.now()}`,
            role: "guide",
            text: `Done — released ${proposal.billboardName} on ${proposal.date}, ${proposal.startTime}–${proposal.endTime}, reserve ${formatRupees(proposal.reservePrice)}.`,
            action: { label: "View in Owner portal", href: "/owner" },
          });
        } else {
          await submitBid({
            slotId: proposal.slotId,
            advertiserId: proposal.advertiserId,
            amount: proposal.amount,
            creativeId: proposal.creativeId,
          });
          publishDataChange("bid");
          pushMessages({
            id: `guide-done-${Date.now()}`,
            role: "guide",
            text: `Done — placed ${formatRupees(proposal.amount)} on ${proposal.billboardName} (${proposal.startTime}–${proposal.endTime}) as ${proposal.advertiserName}, using ${proposal.creativeName}.`,
            action: { label: "View My bids", href: "/advertiser/bids" },
          });
        }
        setAssistantContext(null);
        router.refresh();
      } catch (error) {
        pushMessages({
          id: `guide-error-${Date.now()}`,
          role: "guide",
          text:
            error instanceof Error
              ? error.message
              : "That didn’t go through — the exchange rejected it.",
        });
      } finally {
        setProposal(null);
      }
    });
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {showNudge && !open && (
        <div className="absolute bottom-16 right-0 w-64 animate-bounce rounded-2xl border border-cyan-200 bg-white p-4 text-left shadow-2xl">
          <button
            type="button"
            onClick={dismissNudge}
            aria-label="Dismiss"
            className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
          <p className="pr-4 text-xs font-black uppercase tracking-wide text-cyan-600">New</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">
            Try BX Guide — {role === "owner" ? "ask it to release a slot" : "ask it to place a bid"} in plain English.
          </p>
          <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-cyan-200 bg-white" />
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          dismissNudge();
        }}
        className="rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800"
        aria-expanded={open}
      >
        ✦ {open ? "Close guide" : "Ask BX Guide"}
      </button>
      {open && (
        <section className="absolute bottom-14 right-0 flex h-[430px] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black">BX Guide</p>
            <p className="mt-1 text-xs text-slate-500">
              Can release slots and place bids directly ·{" "}
              {role === "owner" ? "Owner" : "Advertiser"}
            </p>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`w-fit max-w-[92%] rounded-xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-slate-950 text-white" : message.role === "activity" ? "bg-emerald-50 font-semibold text-emerald-800" : "bg-slate-100 text-slate-700"}`}
              >
                {message.role === "activity" && "● "}
                {message.text}
                {message.action && (
                  <button
                    type="button"
                    onClick={() => {
                      if (message.action?.release)
                        window.sessionStorage.setItem(
                          "bx-create-slot-request",
                          JSON.stringify(message.action.release),
                        );
                      setOpen(false);
                      router.push(message.action!.href);
                    }}
                    className="mt-2 block rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-white"
                  >
                    {message.action.label} →
                  </button>
                )}
              </div>
            ))}
            {proposal && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                {proposal.kind === "create_slot" ? (
                  <>
                    <p className="font-black">Release slot</p>
                    <p className="mt-1">{proposal.billboardName}</p>
                    <p>
                      {proposal.date} · {proposal.startTime}–{proposal.endTime}
                    </p>
                    <p>Reserve {formatRupees(proposal.reservePrice)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-black">Place bid</p>
                    <p className="mt-1">{proposal.billboardName}</p>
                    <p>
                      {proposal.date} · {proposal.startTime}–{proposal.endTime} · reserve{" "}
                      {formatRupees(proposal.reservePrice)}
                    </p>
                    <p>
                      Bid {formatRupees(proposal.amount)} as {proposal.advertiserName} ·{" "}
                      {proposal.creativeName}
                    </p>
                  </>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={confirmProposal}
                    className="rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {isPending ? "Submitting…" : "Confirm & submit"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={cancelProposal}
                    className="rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-[11px] font-bold text-cyan-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={submit} className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  role === "owner"
                    ? "e.g. Release Gachibowli 18:00-19:00 reserve 8000"
                    : "e.g. Bid 12000 on Cyber Towers Landmark"
                }
                disabled={isPending}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-cyan-500 disabled:bg-slate-50"
              />
              <button
                disabled={isPending}
                className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(role === "owner"
                ? ["Release inventory", "Create billboard", "Close auction"]
                : ["Search inventory", "Bid now", "Plan a campaign"]
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
