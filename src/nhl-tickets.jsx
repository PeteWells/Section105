import { useState, useMemo } from "react";

const TEAM_COLOR = "#C8102E";
const ICE_BLUE = "#AEE4F0";
const DARK = "#0A0E1A";
const STEEL = "#1E2640";

const MEMBERS = ["Alex", "Jordan", "Sam", "Taylor", "Morgan"];

const GAMES = [
  { id: 1, date: "2026-03-14", opponent: "Boston Bruins", home: true, seats: ["101-A", "101-B"], time: "7:00 PM" },
  { id: 2, date: "2026-03-17", opponent: "Toronto Maple Leafs", home: true, seats: ["101-A", "101-B"], time: "7:30 PM" },
  { id: 3, date: "2026-03-21", opponent: "Pittsburgh Penguins", home: false, seats: ["101-A", "101-B"], time: "6:00 PM" },
  { id: 4, date: "2026-03-24", opponent: "Tampa Bay Lightning", home: true, seats: ["101-A", "101-B"], time: "7:00 PM" },
  { id: 5, date: "2026-03-28", opponent: "Colorado Avalanche", home: true, seats: ["101-A", "101-B"], time: "7:00 PM" },
  { id: 6, date: "2026-04-02", opponent: "Vegas Golden Knights", home: false, seats: ["101-A", "101-B"], time: "10:00 PM" },
  { id: 7, date: "2026-04-05", opponent: "New York Rangers", home: true, seats: ["101-A", "101-B"], time: "7:30 PM" },
  { id: 8, date: "2026-04-08", opponent: "Florida Panthers", home: true, seats: ["101-A", "101-B"], time: "7:00 PM" },
];

const TICKET_PRICE = 120;

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const getMonth = (dateStr) =>
  new Date(dateStr + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" });

const MEMBER_COLORS = {
  Alex: "#C8102E",
  Jordan: "#0057A8",
  Sam: "#00843D",
  Taylor: "#FF7300",
  Morgan: "#8B2FC9",
};

// Snake draft: Round 1 A→E, Round 2 E→A, etc. Only includes members who are still active (under limit).
// We rebuild dynamically each time someone hits their limit mid-draft.
function getNextActiveMember(members, draftClaims, limits, currentIndex, totalGames) {
  // Build a fresh snake order from scratch, skipping maxed-out members
  const picks = [];
  let round = 0;
  const activeSoFar = {};
  members.forEach(m => activeSoFar[m] = 0);

  // Replay already-made picks to get counts
  Object.values(draftClaims).forEach(m => { if (activeSoFar[m] !== undefined) activeSoFar[m]++; });

  // Active = no limit set, or under limit
  const isActive = (m, counts) => limits[m] === null || limits[m] === undefined || counts[m] < limits[m];

  while (picks.length < totalGames) {
    const activeMembers = members.filter(m => isActive(m, activeSoFar));
    if (activeMembers.length === 0) break;
    const order = round % 2 === 0 ? [...activeMembers] : [...activeMembers].reverse();
    for (const m of order) {
      if (picks.length < totalGames && isActive(m, activeSoFar)) {
        picks.push({ member: m, round: round + 1 });
        // Don't actually increment here — this is just for order building
      }
    }
    round++;
    if (round > 100) break; // safety
  }

  return picks;
}

export default function App() {
  // limits: { Alex: 3, Jordan: null, ... } — null means no limit
  const [limits, setLimits] = useState(() => Object.fromEntries(MEMBERS.map(m => [m, null])));
  const [draftClaims, setDraftClaims] = useState({}); // { gameId: memberName }
  const [draftComplete, setDraftComplete] = useState(false);
  const [openClaims, setOpenClaims] = useState({});
  const [activeTab, setActiveTab] = useState("draft");
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedMember, setSelectedMember] = useState(MEMBERS[0]);
  const [editingLimit, setEditingLimit] = useState(null); // member name being edited
  const [pendingPick, setPendingPick] = useState(null); // game pending confirmation

  // How many games each member has drafted
  const draftCounts = useMemo(() => {
    const counts = Object.fromEntries(MEMBERS.map(m => [m, 0]));
    Object.values(draftClaims).forEach(m => { counts[m] = (counts[m] || 0) + 1; });
    return counts;
  }, [draftClaims]);

  // Is a member at or over their limit?
  const isAtLimit = (member) => limits[member] !== null && limits[member] !== undefined && draftCounts[member] >= limits[member];

  // Active members for the draft (not at limit)
  const activeMembers = useMemo(() => MEMBERS.filter(m => !isAtLimit(m)), [draftCounts, limits]);

  // Build draft order dynamically based on current limits/activity
  const draftOrder = useMemo(() => {
    // We need a sequence of picks. We rebuild from scratch using active members at each step.
    // This is a "lazy" snake: each round only uses currently-active members.
    const picks = [];
    const counts = Object.fromEntries(MEMBERS.map(m => [m, 0]));
    Object.values(draftClaims).forEach(m => { counts[m] = (counts[m] || 0) + 1; });

    let round = 0;
    const maxPicks = GAMES.length;

    while (picks.length < maxPicks) {
      const active = MEMBERS.filter(m => limits[m] === null || limits[m] === undefined || counts[m] < (limits[m] ?? Infinity));
      if (active.length === 0) break;
      const order = round % 2 === 0 ? [...active] : [...active].reverse();
      for (const m of order) {
        if (picks.length >= maxPicks) break;
        const memberLimit = limits[m];
        const memberCount = counts[m];
        if (memberLimit === null || memberLimit === undefined || memberCount < memberLimit) {
          picks.push({ member: m, round: round + 1 });
          counts[m]++;
        }
      }
      round++;
      if (round > 50) break;
    }
    return picks;
  }, [limits, draftClaims]);

  // Current pick index = number of picks made so far
  const draftPickIndex = Object.keys(draftClaims).length;
  const currentPick = !draftComplete && draftPickIndex < draftOrder.length ? draftOrder[draftPickIndex] : null;
  const availableGames = GAMES.filter(g => !draftClaims[g.id]);

  // Merged claims for schedule/splits/members
  const claims = useMemo(() => {
    const merged = {};
    Object.entries(draftClaims).forEach(([gameId, member]) => {
      const game = GAMES.find(g => g.id === Number(gameId));
      if (game) game.seats.forEach(s => { merged[`${gameId}-${s}`] = member; });
    });
    Object.entries(openClaims).forEach(([key, member]) => { merged[key] = member; });
    return merged;
  }, [draftClaims, openClaims]);

  const claimKey = (gameId, seat) => `${gameId}-${seat}`;

  const makeDraftPick = (gameId) => {
    if (!currentPick || draftComplete) return;
    const newClaims = { ...draftClaims, [gameId]: currentPick.member };
    setDraftClaims(newClaims);
    const remaining = GAMES.filter(g => !newClaims[g.id]);
    const nextActive = MEMBERS.filter(m => {
      const newCount = (draftCounts[m] || 0) + (currentPick.member === m ? 1 : 0);
      return limits[m] === null || limits[m] === undefined || newCount < limits[m];
    });
    if (remaining.length === 0 || nextActive.length === 0 || draftPickIndex + 1 >= draftOrder.length) {
      setDraftComplete(true);
    }
  };

  const resetDraft = () => {
    setDraftClaims({});
    setOpenClaims({});
    setDraftComplete(false);
  };

  const claimOpenSeat = (gameId, seat, member) => {
    const key = claimKey(gameId, seat);
    setOpenClaims(prev => {
      const n = { ...prev };
      if (n[key] === member) delete n[key];
      else n[key] = member;
      return n;
    });
  };

  const setLimit = (member, value) => {
    setLimits(prev => ({ ...prev, [member]: value === "" || value === null ? null : Math.max(0, Number(value)) }));
    setEditingLimit(null);
  };

  const memberStats = useMemo(() => {
    return MEMBERS.map(m => {
      const games = GAMES.filter(g => g.seats.some(s => claims[claimKey(g.id, s)] === m));
      const seats = Object.entries(claims).filter(([, v]) => v === m).length;
      return { name: m, games: games.length, seats, cost: seats * TICKET_PRICE };
    });
  }, [claims]);

  const totalClaimed = Object.keys(claims).length;
  const totalSeats = GAMES.reduce((a, g) => a + g.seats.length, 0);

  const gamesByMonth = useMemo(() => {
    const map = {};
    GAMES.forEach(g => {
      const mo = getMonth(g.date);
      if (!map[mo]) map[mo] = [];
      map[mo].push(g);
    });
    return map;
  }, []);

  // Next few picks preview
  const upcomingPicks = draftOrder.slice(draftPickIndex, draftPickIndex + 6);

  const tabs = [
    { id: "draft", label: "🎯 Draft" },
    { id: "calendar", label: "📅 Schedule" },
    { id: "splits", label: "💰 Cost Split" },
    { id: "members", label: "👥 Members" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: DARK, fontFamily: "'Georgia', serif", color: "#E8EAF0" }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${STEEL} 100%)`, borderBottom: `3px solid ${TEAM_COLOR}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: TEAM_COLOR, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏒</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 1, color: "#fff" }}>SECTION 101</div>
              <div style={{ fontSize: 11, color: ICE_BLUE, letterSpacing: 2, textTransform: "uppercase" }}>Season Ticket Group</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#8891A8" }}>
            <span style={{ color: ICE_BLUE, fontWeight: "bold" }}>{totalClaimed}</span>/{totalSeats} seats claimed
          </div>
        </div>
      </header>

      {/* Nav */}
      <div style={{ background: STEEL, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "14px 22px", background: "none", border: "none", borderBottom: activeTab === tab.id ? `3px solid ${TEAM_COLOR}` : "3px solid transparent", color: activeTab === tab.id ? "#fff" : "#8891A8", cursor: "pointer", fontSize: 14, fontWeight: activeTab === tab.id ? "bold" : "normal", transition: "all 0.2s", letterSpacing: 0.5 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── DRAFT TAB ── */}
        {activeTab === "draft" && (
          <div>

            {/* Member limit cards */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 12, borderLeft: `3px solid ${TEAM_COLOR}`, paddingLeft: 10 }}>
                Game Limits — set to skip when full, leave blank for no limit
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {MEMBERS.map(m => {
                  const atLimit = isAtLimit(m);
                  const color = MEMBER_COLORS[m];
                  const count = draftCounts[m];
                  const lim = limits[m];
                  const isEditing = editingLimit === m;
                  return (
                    <div key={m} style={{ background: atLimit ? "rgba(255,255,255,0.02)" : `${color}11`, border: `1px solid ${atLimit ? "rgba(255,255,255,0.08)" : color + "44"}`, borderRadius: 10, padding: "10px 14px", minWidth: 110, opacity: atLimit ? 0.5 : 1, transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: color + "33", border: `2px solid ${atLimit ? "#444" : color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", color: atLimit ? "#555" : color }}>
                          {m[0]}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: "bold", color: atLimit ? "#555" : "#fff" }}>{m}</span>
                        {atLimit && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Done</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: atLimit ? "#555" : color, fontWeight: "bold" }}>{count}</span>
                        <span style={{ fontSize: 12, color: "#555" }}>/</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            max={GAMES.length}
                            defaultValue={lim ?? ""}
                            placeholder="∞"
                            onBlur={e => setLimit(m, e.target.value === "" ? null : e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") setLimit(m, e.target.value === "" ? null : e.target.value); if (e.key === "Escape") setEditingLimit(null); }}
                            style={{ width: 36, background: "rgba(255,255,255,0.08)", border: `1px solid ${color}`, borderRadius: 4, color: "#fff", fontSize: 12, padding: "2px 4px", outline: "none", fontFamily: "inherit" }}
                          />
                        ) : (
                          <button onClick={() => setEditingLimit(m)} style={{ background: "none", border: "none", cursor: "pointer", color: lim !== null ? (atLimit ? "#555" : color) : "#444", fontSize: 12, padding: 0, fontFamily: "inherit", textDecoration: lim !== null ? "none" : "underline dotted" }}>
                            {lim !== null ? lim : "∞"}
                          </button>
                        )}
                        <span style={{ fontSize: 11, color: "#444" }}>games</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active pick banner */}
            {!draftComplete && currentPick ? (
              <div style={{ background: `linear-gradient(135deg, ${MEMBER_COLORS[currentPick.member]}22, transparent)`, border: `1px solid ${MEMBER_COLORS[currentPick.member]}55`, borderRadius: 14, padding: "18px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: MEMBER_COLORS[currentPick.member] + "33", border: `3px solid ${MEMBER_COLORS[currentPick.member]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold", color: MEMBER_COLORS[currentPick.member] }}>
                    {currentPick.member[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: "bold", color: "#fff" }}>{currentPick.member}'s Pick</div>
                    <div style={{ fontSize: 12, color: "#8891A8" }}>Round {currentPick.round} · Overall pick #{draftPickIndex + 1}</div>
                  </div>
                </div>

                {/* Upcoming picks queue */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Up next:</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {upcomingPicks.slice(1, 6).map((p, i) => (
                      <div key={i} title={p.member} style={{ width: 26, height: 26, borderRadius: "50%", background: MEMBER_COLORS[p.member] + "22", border: `2px solid ${MEMBER_COLORS[p.member]}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", color: MEMBER_COLORS[p.member] + "bb", opacity: 1 - i * 0.15 }}>
                        {p.member[0]}
                      </div>
                    ))}
                  </div>
                  <button onClick={resetDraft} style={{ marginLeft: 8, padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(200,16,46,0.15)", border: `1px solid ${TEAM_COLOR}44`, color: "#FF6B7A", fontSize: 12 }}>Reset</button>
                </div>
              </div>
            ) : !draftComplete ? (
              // All remaining members are at limit
              <div style={{ background: "rgba(0,200,80,0.08)", border: "1px solid rgba(0,200,80,0.3)", borderRadius: 14, padding: "18px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: "bold", color: "#4ADE80" }}>✅ All members have reached their limits!</div>
                  <div style={{ fontSize: 13, color: "#8891A8", marginTop: 4 }}>
                    {availableGames.length > 0 ? `${availableGames.length} unclaimed game${availableGames.length > 1 ? "s" : ""} are now open — first come, first served.` : "All games claimed."}
                  </div>
                </div>
                <button onClick={resetDraft} style={{ padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: "rgba(200,16,46,0.15)", border: `1px solid ${TEAM_COLOR}44`, color: "#FF6B7A", fontSize: 13, fontWeight: "bold" }}>Reset Draft</button>
              </div>
            ) : (
              <div style={{ background: "rgba(0,200,80,0.08)", border: "1px solid rgba(0,200,80,0.3)", borderRadius: 14, padding: "18px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: "bold", color: "#4ADE80" }}>✅ Draft Complete!</div>
                  <div style={{ fontSize: 13, color: "#8891A8", marginTop: 4 }}>
                    {availableGames.length > 0 ? `${availableGames.length} unclaimed game${availableGames.length > 1 ? "s" : ""} are now open — first come, first served.` : "All games have been claimed."}
                  </div>
                </div>
                <button onClick={resetDraft} style={{ padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: "rgba(200,16,46,0.15)", border: `1px solid ${TEAM_COLOR}44`, color: "#FF6B7A", fontSize: 13, fontWeight: "bold" }}>Start New Draft</button>
              </div>
            )}

            {/* Available games */}
            {!draftComplete && currentPick && availableGames.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 12, borderLeft: `3px solid ${TEAM_COLOR}`, paddingLeft: 10 }}>Available Games — Select One</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {availableGames.map(game => {
                    const isPending = pendingPick?.id === game.id;
                    return (
                      <div key={game.id}
                        style={{ background: isPending ? MEMBER_COLORS[currentPick.member] + "18" : "rgba(255,255,255,0.04)", border: `1px solid ${isPending ? MEMBER_COLORS[currentPick.member] : "rgba(255,255,255,0.12)"}`, borderRadius: 10, padding: "14px 18px", transition: "all 0.15s" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ textAlign: "center", minWidth: 44 }}>
                              <div style={{ fontSize: 10, color: "#8891A8", textTransform: "uppercase" }}>{formatDate(game.date).split(",")[0]}</div>
                              <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff", lineHeight: 1 }}>{new Date(game.date + "T12:00:00").getDate()}</div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: game.home ? "rgba(200,16,46,0.3)" : "rgba(255,255,255,0.08)", color: game.home ? "#FF6B7A" : "#8891A8", letterSpacing: 1, textTransform: "uppercase" }}>{game.home ? "HOME" : "AWAY"}</span>
                                <span style={{ fontSize: 15, fontWeight: "bold", color: "#E8EAF0" }}>{game.home ? "vs" : "@"} {game.opponent}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "#8891A8" }}>{formatDate(game.date)} · {game.time}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => setPendingPick(isPending ? null : game)}
                            style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit", background: isPending ? MEMBER_COLORS[currentPick.member] : MEMBER_COLORS[currentPick.member] + "33", border: `1px solid ${MEMBER_COLORS[currentPick.member]}`, color: isPending ? "#fff" : MEMBER_COLORS[currentPick.member], transition: "all 0.15s" }}
                          >
                            {isPending ? "Selected ✓" : "Pick ›"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Post-draft open claims */}
            {(draftComplete || (!currentPick && !draftComplete)) && availableGames.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 12, borderLeft: `3px solid ${TEAM_COLOR}`, paddingLeft: 10 }}>Unclaimed Games — First Come, First Served</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {availableGames.map(game => {
                    const seatClaims = game.seats.map(s => ({ seat: s, claimedBy: openClaims[claimKey(game.id, s)] || null }));
                    return (
                      <div key={game.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: "bold", fontSize: 14 }}>{game.home ? "vs" : "@"} {game.opponent}</div>
                            <div style={{ fontSize: 12, color: "#8891A8" }}>{formatDate(game.date)} · {game.time}</div>
                          </div>
                          <div style={{ display: "flex", gap: 12 }}>
                            {seatClaims.map(sc => (
                              <div key={sc.seat} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                                <div style={{ fontSize: 11, color: "#666" }}>{sc.seat}</div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {MEMBERS.map(m => (
                                    <button key={m} onClick={() => claimOpenSeat(game.id, sc.seat, m)} style={{ width: 26, height: 26, borderRadius: "50%", cursor: "pointer", border: `2px solid ${MEMBER_COLORS[m]}`, background: sc.claimedBy === m ? MEMBER_COLORS[m] : "transparent", color: sc.claimedBy === m ? "#fff" : MEMBER_COLORS[m], fontSize: 10, fontWeight: "bold" }}>{m[0]}</button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Draft history */}
            {draftPickIndex > 0 && (
              <div>
                <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#555", marginBottom: 12, borderLeft: "3px solid #333", paddingLeft: 10 }}>Draft History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {Object.entries(draftClaims).map(([gameId, member], i) => {
                    const game = GAMES.find(g => g.id === Number(gameId));
                    const pick = draftOrder[i];
                    return (
                      <div key={i} style={{ padding: "9px 14px", borderRadius: 8, background: MEMBER_COLORS[member] + "11", border: `1px solid ${MEMBER_COLORS[member]}33`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#555", minWidth: 22 }}>#{i + 1}</span>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: MEMBER_COLORS[member] + "44", border: `2px solid ${MEMBER_COLORS[member]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", color: MEMBER_COLORS[member] }}>{member[0]}</div>
                        <span style={{ fontWeight: "bold", color: MEMBER_COLORS[member], fontSize: 13 }}>{member}</span>
                        <span style={{ color: "#666", fontSize: 13 }}>→</span>
                        <span style={{ fontWeight: "bold", fontSize: 13, color: "#fff" }}>{game.home ? "vs" : "@"} {game.opponent}</span>
                        <span style={{ color: "#555", fontSize: 12 }}>{formatDate(game.date)}</span>
                        {pick && <span style={{ marginLeft: "auto", fontSize: 11, color: "#444" }}>R{pick.round}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === "calendar" && (
          <div>
            {Object.entries(gamesByMonth).map(([month, games]) => (
              <div key={month} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 12, borderLeft: `3px solid ${TEAM_COLOR}`, paddingLeft: 10 }}>{month}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {games.map(game => {
                    const seatClaims = game.seats.map(s => ({ seat: s, claimedBy: claims[claimKey(game.id, s)] || null }));
                    const isDraftClaimed = !!draftClaims[game.id];
                    return (
                      <div key={game.id} onClick={() => setSelectedGame(selectedGame?.id === game.id ? null : game)} style={{ background: selectedGame?.id === game.id ? "rgba(200,16,46,0.12)" : "rgba(255,255,255,0.04)", border: selectedGame?.id === game.id ? `1px solid ${TEAM_COLOR}` : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 18px", cursor: "pointer", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ textAlign: "center", minWidth: 48 }}>
                              <div style={{ fontSize: 10, color: "#8891A8", textTransform: "uppercase" }}>{formatDate(game.date).split(",")[0]}</div>
                              <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff", lineHeight: 1 }}>{new Date(game.date + "T12:00:00").getDate()}</div>
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: game.home ? "rgba(200,16,46,0.3)" : "rgba(255,255,255,0.08)", color: game.home ? "#FF6B7A" : "#8891A8", letterSpacing: 1, textTransform: "uppercase" }}>{game.home ? "HOME" : "AWAY"}</span>
                                {isDraftClaimed && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(100,200,100,0.15)", color: "#4ADE80", letterSpacing: 1, textTransform: "uppercase" }}>DRAFTED</span>}
                                <span style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{game.home ? "vs" : "@"} {game.opponent}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "#8891A8", marginTop: 2 }}>{game.time}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {seatClaims.map(sc => (
                              <div key={sc.seat} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: "bold", background: sc.claimedBy ? MEMBER_COLORS[sc.claimedBy] + "33" : "rgba(255,255,255,0.06)", border: `1px solid ${sc.claimedBy ? MEMBER_COLORS[sc.claimedBy] : "rgba(255,255,255,0.15)"}`, color: sc.claimedBy ? MEMBER_COLORS[sc.claimedBy] : "#8891A8" }}>
                                {sc.claimedBy || "Open"}
                              </div>
                            ))}
                          </div>
                        </div>
                        {selectedGame?.id === game.id && !isDraftClaimed && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: 12, color: ICE_BLUE, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Claim Seats</div>
                            {seatClaims.map(sc => (
                              <div key={sc.seat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                                <span style={{ fontSize: 13, color: "#ccc" }}>Seat <strong style={{ color: "#fff" }}>{sc.seat}</strong></span>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {MEMBERS.map(m => (
                                    <button key={m} onClick={() => claimOpenSeat(game.id, sc.seat, m)} style={{ padding: "4px 12px", borderRadius: 14, fontSize: 12, cursor: "pointer", border: `1px solid ${MEMBER_COLORS[m]}`, background: sc.claimedBy === m ? MEMBER_COLORS[m] : "transparent", color: sc.claimedBy === m ? "#fff" : MEMBER_COLORS[m], fontWeight: sc.claimedBy === m ? "bold" : "normal" }}>{m}</button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedGame?.id === game.id && isDraftClaimed && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: "#555" }} onClick={e => e.stopPropagation()}>
                            Claimed in draft by <strong style={{ color: MEMBER_COLORS[draftClaims[game.id]] }}>{draftClaims[game.id]}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COST SPLIT TAB ── */}
        {activeTab === "splits" && (
          <div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 8 }}>Season Overview</div>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {[{ label: "Total Games", value: GAMES.length, color: "#fff" }, { label: "Total Seats", value: totalSeats, color: "#fff" }, { label: "Season Total", value: `$${(totalSeats * TICKET_PRICE).toLocaleString()}`, color: TEAM_COLOR }, { label: "Claimed Value", value: `$${(totalClaimed * TICKET_PRICE).toLocaleString()}`, color: "#5BBFD1" }].map(s => (
                  <div key={s.label}><div style={{ fontSize: 28, fontWeight: "bold", color: s.color }}>{s.value}</div><div style={{ fontSize: 12, color: "#8891A8" }}>{s.label}</div></div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {memberStats.sort((a, b) => b.seats - a.seats).map(m => {
                const pct = totalSeats > 0 ? (m.seats / totalSeats) * 100 : 0;
                const lim = limits[m.name];
                return (
                  <div key={m.name} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${MEMBER_COLORS[m.name]}33`, borderRadius: 12, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: MEMBER_COLORS[m.name] + "33", border: `2px solid ${MEMBER_COLORS[m.name]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold", color: MEMBER_COLORS[m.name] }}>{m.name[0]}</div>
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: 15 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: "#8891A8" }}>{m.seats} seats · {m.games} games{lim !== null ? ` · limit: ${lim}` : ""}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: "bold", color: m.seats > 0 ? MEMBER_COLORS[m.name] : "#555" }}>${m.cost.toLocaleString()}</div><div style={{ fontSize: 11, color: "#8891A8" }}>{pct.toFixed(0)}% of season</div></div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, height: 6, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: MEMBER_COLORS[m.name], transition: "width 0.5s ease" }} /></div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20, padding: "16px 20px", background: "rgba(200,16,46,0.08)", border: `1px solid ${TEAM_COLOR}44`, borderRadius: 10, fontSize: 13, color: "#aaa" }}>
              💡 Ticket price set at <strong style={{ color: "#fff" }}>${TICKET_PRICE}/seat</strong>. Costs reflect claimed seats only.
            </div>
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab === "members" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              {MEMBERS.map(m => (
                <button key={m} onClick={() => setSelectedMember(m)} style={{ padding: "8px 20px", borderRadius: 20, cursor: "pointer", border: `2px solid ${MEMBER_COLORS[m]}`, background: selectedMember === m ? MEMBER_COLORS[m] : "transparent", color: selectedMember === m ? "#fff" : MEMBER_COLORS[m], fontWeight: "bold", fontSize: 13, transition: "all 0.15s" }}>{m}</button>
              ))}
            </div>
            {selectedMember && (() => {
              const stats = memberStats.find(s => s.name === selectedMember);
              const memberGames = GAMES.filter(g => g.seats.some(s => claims[claimKey(g.id, s)] === selectedMember));
              const color = MEMBER_COLORS[selectedMember];
              const lim = limits[selectedMember];
              return (
                <div>
                  <div style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: color + "33", border: `3px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: "bold", color }}>{selectedMember[0]}</div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: "bold" }}>{selectedMember}</div>
                        <div style={{ fontSize: 13, color: "#8891A8", display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <span>Game limit:</span>
                          <input
                            type="number"
                            min="0"
                            max={GAMES.length}
                            value={lim ?? ""}
                            placeholder="∞"
                            onChange={e => setLimit(selectedMember, e.target.value === "" ? null : e.target.value)}
                            style={{ width: 52, background: "rgba(255,255,255,0.08)", border: `1px solid ${color}66`, borderRadius: 6, color: "#fff", fontSize: 13, padding: "3px 6px", outline: "none", fontFamily: "inherit", textAlign: "center" }}
                          />
                          {lim !== null && <button onClick={() => setLimit(selectedMember, null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: 0 }}>clear</button>}
                          {isAtLimit(selectedMember) && <span style={{ color: "#4ADE80" }}>· Limit reached ✓</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
                      {[{ label: "Games", value: stats.games }, { label: "Seats", value: stats.seats }, { label: "Total Cost", value: `$${stats.cost}` }].map(s => (
                        <div key={s.label}><div style={{ fontSize: 24, fontWeight: "bold", color }}>{s.value}</div><div style={{ fontSize: 12, color: "#8891A8" }}>{s.label}</div></div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: ICE_BLUE, marginBottom: 12 }}>Claimed Games</div>
                  {memberGames.length === 0 ? <div style={{ color: "#8891A8", fontSize: 14, padding: 20 }}>No games claimed yet.</div> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {memberGames.map(game => {
                        const mySeats = game.seats.filter(s => claims[claimKey(game.id, s)] === selectedMember);
                        const wasDrafted = draftClaims[game.id] === selectedMember;
                        return (
                          <div key={game.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}33`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: "bold", fontSize: 14 }}>{game.home ? "vs" : "@"} {game.opponent}</div>
                              <div style={{ fontSize: 12, color: "#8891A8" }}>{formatDate(game.date)} · {game.time}{wasDrafted && <span style={{ marginLeft: 8, color: "#4ADE80" }}>· drafted</span>}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {mySeats.map(s => <span key={s} style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, background: color + "33", border: `1px solid ${color}`, color }}>{s}</span>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {pendingPick && currentPick && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setPendingPick(null)}
        >
          <div style={{ background: STEEL, border: `2px solid ${MEMBER_COLORS[currentPick.member]}`, borderRadius: 16, padding: "32px 36px", maxWidth: 400, width: "100%", boxShadow: `0 0 40px ${MEMBER_COLORS[currentPick.member]}44` }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, color: "#8891A8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Confirm Pick</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: MEMBER_COLORS[currentPick.member] + "33", border: `2px solid ${MEMBER_COLORS[currentPick.member]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", color: MEMBER_COLORS[currentPick.member], flexShrink: 0 }}>
                {currentPick.member[0]}
              </div>
              <div>
                <div style={{ fontSize: 15, color: "#aaa" }}><strong style={{ color: MEMBER_COLORS[currentPick.member] }}>{currentPick.member}</strong> is claiming</div>
                <div style={{ fontSize: 21, fontWeight: "bold", color: "#fff", marginTop: 2 }}>
                  {pendingPick.home ? "vs" : "@"} {pendingPick.opponent}
                </div>
                <div style={{ fontSize: 13, color: "#8891A8", marginTop: 2 }}>{formatDate(pendingPick.date)} · {pendingPick.time}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => { makeDraftPick(pendingPick.id); setPendingPick(null); }}
                style={{ flex: 1, padding: "13px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: "bold", background: MEMBER_COLORS[currentPick.member], border: "none", color: "#fff" }}
              >
                Yes, claim it
              </button>
              <button
                onClick={() => setPendingPick(null)}
                style={{ flex: 1, padding: "13px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: "bold", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa" }}
              >
                No, go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}