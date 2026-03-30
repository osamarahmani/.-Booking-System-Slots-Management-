import { useEffect, useState, useCallback, useRef } from "react";

const API = "http://127.0.0.1:5000";

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const getToken   = () => localStorage.getItem("mb_token");
const getUser    = () => { try { return JSON.parse(localStorage.getItem("mb_user")); } catch { return null; } };
const saveAuth   = (t, u) => { localStorage.setItem("mb_token", t); localStorage.setItem("mb_user", JSON.stringify(u)); };
const clearAuth  = () => { localStorage.removeItem("mb_token"); localStorage.removeItem("mb_user"); };
const authH      = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const P = {
  teal:        "#0d9488", tealDark: "#0f766e", tealLight: "#ccfbf1",
  navy:        "#0f172a", navyMid:  "#1e293b",
  accent:      "#f59e0b", danger: "#ef4444", success: "#10b981",
  warning:     "#f97316", info: "#6366f1", purple: "#8b5cf6",
  bg:          "#f8fafc", card: "#ffffff",
  border:      "#e2e8f0", muted: "#64748b", text: "#0f172a",
  chartColors: ["#0d9488","#6366f1","#f59e0b","#ef4444","#10b981","#f97316","#8b5cf6","#06b6d4"],
};

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inp = {
  border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "10px 14px",
  fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  fontFamily: "inherit", background: "#f8fafc", transition: "border-color .2s",
};
const card = (extra = {}) => ({
  background: P.card, borderRadius: 18,
  boxShadow: "0 1px 20px rgba(0,0,0,0.06)", padding: "24px 28px",
  marginBottom: 20, ...extra,
});
const btn = (v = "primary", extra = {}) => ({
  padding: "9px 20px", border: "none", borderRadius: 10, cursor: "pointer",
  fontWeight: 700, fontSize: 13, letterSpacing: ".2px",
  transition: "all .15s", fontFamily: "inherit",
  background: v==="primary" ? P.teal : v==="danger" ? P.danger
            : v==="warning" ? P.warning : v==="success" ? P.success
            : v==="info"    ? P.info    : v==="ghost"   ? "transparent" : "#e2e8f0",
  color: v === "ghost" ? P.muted : "#fff",
  border: v === "ghost" ? `1.5px solid ${P.border}` : "none",
  ...extra,
});

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const Badge = ({ status }) => {
  const m = { confirmed: ["#d1fae5","#065f46"], cancelled: ["#fee2e2","#991b1b"], rescheduled: ["#fef3c7","#92400e"] };
  const [bg, c] = m[status] || m.confirmed;
  return <span style={{ background: bg, color: c, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{status}</span>;
};

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const DocAvatar = ({ name, color = P.teal, size = 44 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", background: color,
    display: "grid", placeItems: "center", fontSize: size * 0.38,
    fontWeight: 800, color: "#fff", flexShrink: 0, fontFamily: "inherit",
  }}>
    {name?.charAt(0)?.toUpperCase() || "D"}
  </div>
);

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ t }) => !t ? null : (
  <div style={{
    position: "fixed", bottom: 28, right: 28, zIndex: 9999,
    background: t.type === "error" ? P.danger : P.success,
    color: "#fff", padding: "12px 22px", borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)", fontSize: 14, fontWeight: 600,
    animation: "slideUp .25s ease", maxWidth: 360,
  }}>{t.msg}</div>
);

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, w = 440 }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={onClose}>
    <div style={{ background:"#fff",borderRadius:20,padding:"30px 34px",width:"92%",maxWidth:w,boxShadow:"0 24px 60px rgba(0,0,0,.2)",animation:"popIn .2s ease" }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
        <h3 style={{ margin:0,fontSize:18,fontWeight:800,color:P.text }}>{title}</h3>
        <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,cursor:"pointer",color:P.muted,lineHeight:1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  CHART PRIMITIVES  (pure SVG — no library needed)
// ══════════════════════════════════════════════════════════════════════════════

/** Bar chart */
function BarChart({ data, xKey, yKey, color = P.teal, height = 200, label = "" }) {
  if (!data?.length) return <div style={{ height, display:"grid",placeItems:"center",color:P.muted,fontSize:13 }}>No data</div>;
  const max  = Math.max(...data.map(d => d[yKey]), 1);
  const W    = 600, H = height, pad = { l:40, r:10, t:10, b:36 };
  const bW   = Math.max(8, (W - pad.l - pad.r) / data.length - 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
      {/* Y axis lines */}
      {[0,25,50,75,100].map(p => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - p / 100);
        return (
          <g key={p}>
            <line x1={pad.l} x2={W-pad.r} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 4} fontSize={10} fill={P.muted} textAnchor="end">
              {Math.round(max * p / 100)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x    = pad.l + i * ((W - pad.l - pad.r) / data.length) + 3;
        const val  = d[yKey] || 0;
        const barH = ((H - pad.t - pad.b) * val) / max;
        const y    = H - pad.b - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={barH} rx={4} fill={color} opacity={0.85} />
            {val > 0 && <text x={x + bW/2} y={y - 4} fontSize={9} fill={color} textAnchor="middle" fontWeight="700">{val}</text>}
            <text x={x + bW/2} y={H - pad.b + 14} fontSize={9} fill={P.muted} textAnchor="middle">{d[xKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Multi-line chart */
function LineChart({ data, xKey, series, height = 220 }) {
  if (!data?.length) return <div style={{ height, display:"grid",placeItems:"center",color:P.muted,fontSize:13 }}>No data</div>;
  const allVals = series.flatMap(s => data.map(d => d[s.key] || 0));
  const max     = Math.max(...allVals, 1);
  const W = 600, H = height, pad = { l:36, r:16, t:16, b:36 };
  const xStep   = (W - pad.l - pad.r) / Math.max(data.length - 1, 1);

  const toXY = (d, i, key) => ({
    x: pad.l + i * xStep,
    y: pad.t + (H - pad.t - pad.b) * (1 - (d[key] || 0) / max),
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
      {[0,25,50,75,100].map(p => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - p / 100);
        return (
          <g key={p}>
            <line x1={pad.l} x2={W-pad.r} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={pad.l-6} y={y+4} fontSize={10} fill={P.muted} textAnchor="end">{Math.round(max*p/100)}</text>
          </g>
        );
      })}
      {series.map(s => {
        const pts = data.map((d, i) => toXY(d, i, s.key));
        const path = pts.map((p, i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
        return (
          <g key={s.key}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={s.color} />
            ))}
          </g>
        );
      })}
      {/* X labels — show every N-th to avoid overlap */}
      {data.map((d, i) => {
        const skip = Math.ceil(data.length / 10);
        if (i % skip !== 0 && i !== data.length - 1) return null;
        const x = pad.l + i * xStep;
        return <text key={i} x={x} y={H - pad.b + 14} fontSize={9} fill={P.muted} textAnchor="middle">{d[xKey]?.slice(5)}</text>;
      })}
    </svg>
  );
}

/** Donut chart */
function DonutChart({ data, labelKey, valueKey, size = 180 }) {
  if (!data?.length) return null;
  const total  = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const cx = size / 2, cy = size / 2, r = size * 0.36, inner = size * 0.22;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const pct   = d[valueKey] / total;
    const sweep = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, color: P.chartColors[i % P.chartColors.length], label: d[labelKey], pct: Math.round(pct * 100), value: d[valueKey] };
  });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
      <svg width={size} height={size} style={{ flexShrink:0 }}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={2} />)}
        <circle cx={cx} cy={cy} r={inner} fill="#fff" />
        <text x={cx} y={cy-4} textAnchor="middle" fontSize={16} fontWeight="800" fill={P.text}>{total}</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize={10} fill={P.muted}>total</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:s.color, flexShrink:0 }} />
            <span style={{ color:P.text, fontWeight:600 }}>{s.label}</span>
            <span style={{ color:P.muted }}>— {s.value} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar — for peak hours */
function HorizBar({ data, xKey, yKey, color = P.teal, height = 28 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[yKey]), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {data.filter(d => d[yKey] > 0).map((d, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:52, fontSize:12, color:P.muted, textAlign:"right", flexShrink:0 }}>{d[xKey]}</div>
          <div style={{ flex:1, background:"#f1f5f9", borderRadius:6, height:height * 0.6, overflow:"hidden" }}>
            <div style={{ width:`${(d[yKey]/max)*100}%`, height:"100%", background:color, borderRadius:6, transition:"width .5s ease" }} />
          </div>
          <div style={{ width:28, fontSize:12, fontWeight:700, color:P.text }}>{d[yKey]}</div>
        </div>
      ))}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, sub }) => (
  <div style={{ background:"#fff", borderRadius:16, padding:"18px 22px", boxShadow:"0 2px 14px rgba(0,0,0,.05)", display:"flex", alignItems:"center", gap:16, borderTop:`4px solid ${color}` }}>
    <div style={{ width:46, height:46, borderRadius:13, background:color+"18", display:"grid", placeItems:"center", fontSize:22, flexShrink:0 }}>{icon}</div>
    <div>
      <div style={{ fontSize:26, fontWeight:800, color:P.text, lineHeight:1 }}>{value??'—'}</div>
      <div style={{ fontSize:13, color:P.muted, marginTop:3 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:color, marginTop:2, fontWeight:600 }}>{sub}</div>}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AuthPage({ onAuth }) {
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ name:"", email:"", password:"", role:"user" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    const url  = mode === "login" ? "/auth/login" : "/auth/register";
    const body = mode === "login" ? { email: form.email, password: form.password } : form;
    try {
      const res  = await fetch(API + url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      saveAuth(data.token, data.user); onAuth(data.user);
    } catch { setError("Cannot connect to server. Is Flask running on port 5000?"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${P.navy} 0%,${P.tealDark} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:24, padding:"44px 40px", width:"90%", maxWidth:420, boxShadow:"0 32px 80px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:42, marginBottom:8 }}>🏥</div>
          <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:P.navy, letterSpacing:"-1px" }}>MediBook</h1>
          <p style={{ margin:"6px 0 0", color:P.muted, fontSize:14 }}>Appointment System v2.0</p>
        </div>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:4, marginBottom:24 }}>
          {["login","register"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"9px", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13, background:mode===m?"#fff":"transparent", color:mode===m?P.teal:P.muted, boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.1)":"none", transition:"all .2s", fontFamily:"inherit" }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {mode === "register" && <input style={inp} placeholder="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />}
          <input style={inp} placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          <input style={inp} placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&submit()} />
          {mode === "register" && (
            <select style={{...inp,background:"#f8fafc"}} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
              <option value="user">Patient / User</option>
              <option value="admin">Admin</option>
            </select>
          )}
          {error && <div style={{ background:"#fee2e2",color:"#991b1b",padding:"10px 14px",borderRadius:8,fontSize:13 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{...btn("primary"),padding:"12px",fontSize:15,background:loading?"#9ca3af":P.teal}}>
            {loading ? "Please wait…" : mode==="login" ? "Sign In" : "Create Account"}
          </button>
        </div>
        <p style={{ textAlign:"center",fontSize:12,color:P.muted,marginTop:20,marginBottom:0 }}>
          Demo: <b>admin@medibook.com</b> / <b>admin123</b>
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════
function Sidebar({ tab, setTab, user, onLogout, navItems, accent }) {
  return (
    <aside style={{ width:228, background:P.navy, display:"flex", flexDirection:"column", padding:"22px 0", position:"sticky", top:0, height:"100vh", flexShrink:0 }}>
      <div style={{ padding:"0 20px 22px", borderBottom:"1px solid #1e293b" }}>
        <div style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.5px" }}>🏥 MediBook</div>
        <div style={{ fontSize:10, color:"#94a3b8", marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>
          {user.role === "admin" ? "Admin Panel" : "Patient Portal"}
        </div>
      </div>
      <nav style={{ marginTop:16, flex:1, overflowY:"auto" }}>
        {navItems.map(n => (
          <div key={n.id} onClick={()=>setTab(n.id)} style={{
            padding:"12px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:12,
            fontSize:13.5, fontWeight:500,
            color: tab===n.id?"#fff":"#94a3b8",
            background: tab===n.id ? accent : "transparent",
            borderLeft: `3px solid ${tab===n.id ? "#fff" : "transparent"}`,
            transition:"all .15s",
          }}>
            <span style={{ fontSize:17 }}>{n.icon}</span>{n.label}
          </div>
        ))}
      </nav>
      <div style={{ padding:"16px 20px", borderTop:"1px solid #1e293b" }}>
        <div style={{ fontSize:13, color:"#94a3b8", marginBottom:10 }}>👤 {user.name}</div>
        <button onClick={onLogout} style={{ ...btn("ghost"), color:"#f87171", borderColor:"#7f1d1d", fontSize:12, width:"100%", padding:"8px" }}>Logout</button>
      </div>
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsPage({ notify }) {
  const [overview, setOverview]   = useState({});
  const [trend, setTrend]         = useState([]);
  const [byDoc, setByDoc]         = useState([]);
  const [bySpec, setBySpec]       = useState([]);
  const [peakHrs, setPeakHrs]     = useState([]);
  const [weekDay, setWeekDay]     = useState([]);
  const [days, setDays]           = useState(30);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async (d = days) => {
    setLoading(true);
    const h = authH();
    try {
      const [ov, tr, bd, bs, ph, wd] = await Promise.all([
        fetch(`${API}/analytics/overview`,            {headers:h}).then(r=>r.json()),
        fetch(`${API}/analytics/bookings-over-time?days=${d}`, {headers:h}).then(r=>r.json()),
        fetch(`${API}/analytics/by-doctor`,           {headers:h}).then(r=>r.json()),
        fetch(`${API}/analytics/by-specialization`,   {headers:h}).then(r=>r.json()),
        fetch(`${API}/analytics/peak-hours`,          {headers:h}).then(r=>r.json()),
        fetch(`${API}/analytics/weekly-trend`,        {headers:h}).then(r=>r.json()),
      ]);
      setOverview(ov); setTrend(tr); setByDoc(bd);
      setBySpec(bs);   setPeakHrs(ph); setWeekDay(wd);
    } catch { notify("Failed to load analytics", "error"); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(days); }, [days]);

  if (loading) return <div style={{ display:"grid",placeItems:"center",height:300,color:P.muted }}>Loading analytics…</div>;

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h2 style={{ margin:0, fontSize:24, fontWeight:800, color:P.text }}>📊 Analytics</h2>
        <div style={{ display:"flex", gap:8 }}>
          {[7,14,30,90].map(d => (
            <button key={d} onClick={()=>setDays(d)} style={{ ...btn(days===d?"primary":"ghost"), padding:"7px 16px", fontSize:13 }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))", gap:14, marginBottom:24 }}>
        <StatCard label="Total Bookings"  value={overview.total_bookings}  icon="📋" color={P.teal}    sub={`${overview.cancellation_rate}% cancel rate`} />
        <StatCard label="Confirmed"       value={overview.confirmed}       icon="✅" color={P.success} />
        <StatCard label="Cancelled"       value={overview.cancelled}       icon="❌" color={P.danger}  />
        <StatCard label="Rescheduled"     value={overview.rescheduled}     icon="🔄" color={P.warning} />
        <StatCard label="Slot Fill Rate"  value={`${overview.booking_rate}%`} icon="📈" color={P.info} />
        <StatCard label="Active Doctors"  value={overview.total_doctors}   icon="👨‍⚕️" color={P.purple} />
        <StatCard label="Patients"        value={overview.total_users}     icon="👥" color="#06b6d4"   />
      </div>

      {/* Line chart — bookings over time */}
      <div style={card()}>
        <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:700 }}>Bookings Over Time ({days} days)</h3>
        <LineChart
          data={trend} xKey="date"
          series={[
            { key:"confirmed",   color:P.success, label:"Confirmed"   },
            { key:"cancelled",   color:P.danger,  label:"Cancelled"   },
            { key:"rescheduled", color:P.warning, label:"Rescheduled" },
          ]}
          height={220}
        />
        <div style={{ display:"flex", gap:20, marginTop:12 }}>
          {[{label:"Confirmed",color:P.success},{label:"Cancelled",color:P.danger},{label:"Rescheduled",color:P.warning}].map(s=>(
            <div key={s.label} style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.muted }}>
              <div style={{ width:28,height:3,borderRadius:2,background:s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        {/* Weekly trend */}
        <div style={card({ marginBottom:0 })}>
          <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:700 }}>Bookings by Day of Week</h3>
          <BarChart data={weekDay} xKey="day" yKey="count" color={P.info} height={180} />
        </div>

        {/* By specialization donut */}
        <div style={card({ marginBottom:0 })}>
          <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:700 }}>By Specialization</h3>
          <DonutChart data={bySpec.slice(0,7)} labelKey="specialization" valueKey="count" size={160} />
        </div>
      </div>

      {/* Peak hours */}
      <div style={card()}>
        <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:700 }}>Peak Appointment Hours</h3>
        <HorizBar data={peakHrs} xKey="label" yKey="count" color={P.teal} height={32} />
      </div>

      {/* Doctor performance table */}
      <div style={card()}>
        <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Doctor Performance</h3>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead>
            <tr style={{ borderBottom:`2px solid ${P.border}`, color:P.muted, textAlign:"left" }}>
              {["Doctor","Total","Confirmed","Cancelled","Rescheduled","Cancel Rate","Avail. Slots"].map(h=>(
                <th key={h} style={{ padding:"8px 12px", fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byDoc.map((d,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${P.border}` }}>
                <td style={{ padding:"10px 12px", fontWeight:700 }}>Dr. {d.doctor_name}</td>
                <td style={{ padding:"10px 12px" }}>{d.total}</td>
                <td style={{ padding:"10px 12px", color:P.success, fontWeight:600 }}>{d.confirmed}</td>
                <td style={{ padding:"10px 12px", color:P.danger, fontWeight:600 }}>{d.cancelled}</td>
                <td style={{ padding:"10px 12px", color:P.warning, fontWeight:600 }}>{d.rescheduled}</td>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ flex:1, background:"#f1f5f9", borderRadius:4, height:8 }}>
                      <div style={{ width:`${d.cancel_rate}%`, height:"100%", background:d.cancel_rate>30?P.danger:P.warning, borderRadius:4 }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:600 }}>{d.cancel_rate}%</span>
                  </div>
                </td>
                <td style={{ padding:"10px 12px", color:P.teal, fontWeight:600 }}>{d.available_slots}</td>
              </tr>
            ))}
            {byDoc.length === 0 && <tr><td colSpan={7} style={{ padding:24,textAlign:"center",color:P.muted }}>No data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  DOCTORS PAGE  (Admin)
// ══════════════════════════════════════════════════════════════════════════════
function DoctorsPage({ notify }) {
  const [doctors, setDoctors]         = useState([]);
  const [specs, setSpecs]             = useState([]);
  const [showAdd, setShowAdd]         = useState(false);
  const [editDoc, setEditDoc]         = useState(null);
  const [viewDoc, setViewDoc]         = useState(null);
  const [filterSpec, setFilterSpec]   = useState("");
  const [search, setSearch]           = useState("");
  const [form, setForm]               = useState({ name:"", email:"", specialization:"", phone:"", bio:"", experience:"", fees:"", qualification:"", avatar_color:"#0d9488" });

  const h = authH();

  const loadDoctors = useCallback(() => {
    const q = new URLSearchParams({...(filterSpec&&{specialization:filterSpec}), ...(search&&{search})}).toString();
    fetch(`${API}/doctors${q?"?"+q:""}`, {headers:h}).then(r=>r.json()).then(setDoctors).catch(()=>{});
    fetch(`${API}/specializations`).then(r=>r.json()).then(setSpecs).catch(()=>{});
  }, [filterSpec, search]);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  const saveDoctor = () => {
    if (!form.name || !form.specialization) return notify("Name and specialization required", "error");
    const url    = editDoc ? `${API}/doctors/${editDoc._id}` : `${API}/doctors`;
    const method = editDoc ? "PUT" : "POST";
    fetch(url, { method, headers:h, body:JSON.stringify(form) })
      .then(r=>r.json()).then(d=>{
        if (d.error) return notify(d.error, "error");
        notify(editDoc ? "Doctor updated!" : "Doctor added!"); setShowAdd(false); setEditDoc(null);
        setForm({name:"",email:"",specialization:"",phone:"",bio:"",experience:"",fees:"",qualification:"",avatar_color:"#0d9488"});
        loadDoctors();
      });
  };

  const deactivate = (id) => {
    if (!window.confirm("Deactivate this doctor?")) return;
    fetch(`${API}/doctors/${id}`, { method:"DELETE", headers:h })
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify("Doctor deactivated"); loadDoctors(); });
  };

  const openEdit = (doc) => {
    setForm({ name:doc.name, email:doc.email||"", specialization:doc.specialization, phone:doc.phone||"", bio:doc.bio||"", experience:doc.experience||"", fees:doc.fees||"", qualification:doc.qualification||"", avatar_color:doc.avatar_color||"#0d9488" });
    setEditDoc(doc); setShowAdd(true);
  };

  const COLORS = ["#0d9488","#6366f1","#f59e0b","#ef4444","#10b981","#f97316","#8b5cf6","#06b6d4","#ec4899","#84cc16"];

  const DoctorForm = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Name *</label>
          <input style={inp} placeholder="Dr. John Smith" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Specialization *</label>
          <select style={{...inp,background:"#f8fafc"}} value={form.specialization} onChange={e=>setForm({...form,specialization:e.target.value})}>
            <option value="">Select…</option>
            {specs.map(s=><option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Email</label>
          <input style={inp} type="email" placeholder="doctor@clinic.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Phone</label>
          <input style={inp} placeholder="+91 9876543210" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Experience (years)</label>
          <input style={inp} type="number" placeholder="5" value={form.experience} onChange={e=>setForm({...form,experience:e.target.value})} /></div>
        <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Consultation Fee (₹)</label>
          <input style={inp} type="number" placeholder="500" value={form.fees} onChange={e=>setForm({...form,fees:e.target.value})} /></div>
      </div>
      <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Qualification</label>
        <input style={inp} placeholder="MBBS, MD (Cardiology)" value={form.qualification} onChange={e=>setForm({...form,qualification:e.target.value})} /></div>
      <div><label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:4 }}>Bio / About</label>
        <textarea style={{...inp,minHeight:72,resize:"vertical"}} placeholder="Short bio about the doctor…" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} /></div>
      <div>
        <label style={{ fontSize:12,color:P.muted,display:"block",marginBottom:6 }}>Avatar Color</label>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {COLORS.map(c => (
            <div key={c} onClick={()=>setForm({...form,avatar_color:c})} style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:form.avatar_color===c?"3px solid "+P.text:"3px solid transparent",transition:"border .15s" }} />
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <button onClick={saveDoctor} style={{...btn("primary"),flex:1,padding:"11px"}}>{editDoc ? "Update Doctor" : "Add Doctor"}</button>
        <button onClick={()=>{setShowAdd(false);setEditDoc(null);}} style={btn("ghost")}>Cancel</button>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <h2 style={{ margin:0, fontSize:24, fontWeight:800, color:P.text }}>👨‍⚕️ Doctors</h2>
        <button onClick={()=>{setShowAdd(true);setEditDoc(null);setForm({name:"",email:"",specialization:"",phone:"",bio:"",experience:"",fees:"",qualification:"",avatar_color:"#0d9488"});}} style={btn("primary")}>+ Add Doctor</button>
      </div>

      {/* Inline Add/Edit form */}
      {showAdd && (
        <div style={card()}>
          <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:700 }}>{editDoc ? "✏️ Edit Doctor" : "➕ Add New Doctor"}</h3>
          <DoctorForm />
        </div>
      )}

      {/* Filters */}
      <div style={{...card(),padding:"16px 22px",marginBottom:16}}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          <input style={{...inp,maxWidth:220}} placeholder="Search name / specialization…" value={search} onChange={e=>setSearch(e.target.value)} />
          <select style={{...inp,maxWidth:220,background:"#f8fafc"}} value={filterSpec} onChange={e=>setFilterSpec(e.target.value)}>
            <option value="">All Specializations</option>
            {specs.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>{setSearch("");setFilterSpec("");}} style={btn("ghost")}>Clear</button>
          <span style={{ marginLeft:"auto",fontSize:13,color:P.muted }}>{doctors.length} doctor{doctors.length!==1?"s":""}</span>
        </div>
      </div>

      {/* Doctor cards grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))", gap:18 }}>
        {doctors.map(doc => (
          <div key={doc._id} style={{ background:"#fff", borderRadius:18, boxShadow:"0 2px 16px rgba(0,0,0,.06)", overflow:"hidden", transition:"transform .2s,box-shadow .2s" }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,.1)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 16px rgba(0,0,0,.06)";}}>
            {/* Color strip */}
            <div style={{ height:6, background:doc.avatar_color||P.teal }} />
            <div style={{ padding:"20px 22px" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 }}>
                <DocAvatar name={doc.name} color={doc.avatar_color||P.teal} size={52} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:P.text, marginBottom:2 }}>Dr. {doc.name}</div>
                  <div style={{ fontSize:12, color:doc.avatar_color||P.teal, fontWeight:600, background:(doc.avatar_color||P.teal)+"15", display:"inline-block", padding:"2px 10px", borderRadius:999 }}>{doc.specialization}</div>
                  {doc.qualification && <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>{doc.qualification}</div>}
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                {[
                  { label:"Experience", value: doc.experience ? `${doc.experience}y` : "—" },
                  { label:"Available",  value: doc.available_slots ?? 0 },
                  { label:"Fee",        value: doc.fees ? `₹${doc.fees}` : "—" },
                ].map(s=>(
                  <div key={s.label} style={{ background:"#f8fafc", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:P.text }}>{s.value}</div>
                    <div style={{ fontSize:11, color:P.muted, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {doc.bio && <p style={{ fontSize:13, color:P.muted, margin:"0 0 14px", lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{doc.bio}</p>}

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setViewDoc(doc)} style={{...btn("ghost"),flex:1,padding:"8px",fontSize:12}}>View Profile</button>
                <button onClick={()=>openEdit(doc)} style={{...btn("primary"),flex:1,padding:"8px",fontSize:12}}>Edit</button>
                <button onClick={()=>deactivate(doc._id)} style={{...btn("danger"),padding:"8px 12px",fontSize:12}}>✕</button>
              </div>
            </div>
          </div>
        ))}
        {doctors.length === 0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:60, color:P.muted }}>
            <div style={{ fontSize:48 }}>👨‍⚕️</div>
            <p>No doctors found. Add one above.</p>
          </div>
        )}
      </div>

      {/* Doctor profile modal */}
      {viewDoc && (
        <Modal title={`Dr. ${viewDoc.name}`} onClose={()=>setViewDoc(null)} w={520}>
          <div style={{ display:"flex", gap:18, marginBottom:20, alignItems:"center" }}>
            <DocAvatar name={viewDoc.name} color={viewDoc.avatar_color||P.teal} size={70} />
            <div>
              <div style={{ fontSize:13, color:viewDoc.avatar_color||P.teal, fontWeight:700 }}>{viewDoc.specialization}</div>
              <div style={{ fontSize:13, color:P.muted, marginTop:4 }}>{viewDoc.qualification}</div>
              {viewDoc.email && <div style={{ fontSize:13, color:P.muted }}>✉️ {viewDoc.email}</div>}
              {viewDoc.phone && <div style={{ fontSize:13, color:P.muted }}>📞 {viewDoc.phone}</div>}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              {label:"Experience", value:viewDoc.experience?`${viewDoc.experience} yrs`:"—"},
              {label:"Consult Fee", value:viewDoc.fees?`₹${viewDoc.fees}`:"—"},
              {label:"Total Bookings", value:viewDoc.total_bookings??0},
              {label:"Available Slots", value:viewDoc.available_slots??0},
              {label:"Confirmed", value:viewDoc.confirmed??0},
              {label:"Cancelled", value:viewDoc.cancelled??0},
            ].map(s=>(
              <div key={s.label} style={{ background:"#f8fafc",borderRadius:10,padding:"10px",textAlign:"center" }}>
                <div style={{ fontSize:18,fontWeight:800,color:P.text }}>{s.value}</div>
                <div style={{ fontSize:11,color:P.muted,marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {viewDoc.bio && <p style={{ fontSize:14,color:P.muted,lineHeight:1.6,margin:"0 0 14px" }}>{viewDoc.bio}</p>}

          {viewDoc.upcoming_slots?.length > 0 && (
            <div>
              <div style={{ fontSize:13,fontWeight:700,marginBottom:8 }}>Upcoming Available Slots</div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {viewDoc.upcoming_slots.slice(0,5).map(sl=>(
                  <div key={sl._id} style={{ background:"#f0fdf9",borderRadius:8,padding:"8px 12px",fontSize:13,display:"flex",justifyContent:"space-between" }}>
                    <span>📅 {sl.date}</span><span>⏰ {sl.start_time}–{sl.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ user, onLogout, notify }) {
  const [tab, setTab]           = useState("analytics");
  const [slots, setSlots]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers]       = useState([]);
  const [doctors, setDoctors]   = useState([]);
  const [slotFilter, setSlotFilter]     = useState({ date:"", doctor_id:"", available_only:"" });
  const [bookingFilter, setBookingFilter] = useState({ search:"", status:"", date:"", doctor_id:"" });
  const [slotForm, setSlotForm]   = useState({ start_time:"", end_time:"", date:"", doctor_id:"" });
  const [bulkForm, setBulkForm]   = useState({ doctor_id:"", from_date:"", to_date:"", skip_weekends:false, times:"09:00 AM,09:30 AM\n09:30 AM,10:00 AM" });
  const [bookModal, setBookModal] = useState(null);
  const [reschedModal, setReschedModal] = useState(null);
  const [newSlotId, setNewSlotId] = useState("");
  const [showBulk, setShowBulk]   = useState(false);
  const h = authH();

  const loadCore = useCallback(() => {
    const sq = new URLSearchParams(Object.fromEntries(Object.entries(slotFilter).filter(([,v])=>v))).toString();
    const bq = new URLSearchParams(Object.fromEntries(Object.entries(bookingFilter).filter(([,v])=>v))).toString();
    fetch(`${API}/slots${sq?"?"+sq:""}`,    {headers:h}).then(r=>r.json()).then(setSlots).catch(()=>{});
    fetch(`${API}/bookings${bq?"?"+bq:""}`, {headers:h}).then(r=>r.json()).then(setBookings).catch(()=>{});
    fetch(`${API}/users`,                   {headers:h}).then(r=>r.json()).then(setUsers).catch(()=>{});
    fetch(`${API}/doctors`).then(r=>r.json()).then(setDoctors).catch(()=>{});
  }, [slotFilter, bookingFilter]);

  useEffect(() => { loadCore(); }, []);
  useEffect(() => { loadCore(); }, [slotFilter, bookingFilter]);

  const addSlot = () => {
    const {start_time,end_time,date} = slotForm;
    if (!start_time||!end_time||!date) return notify("Fill all required fields","error");
    fetch(`${API}/slots`,{method:"POST",headers:h,body:JSON.stringify(slotForm)})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify("Slot added!"); setSlotForm({start_time:"",end_time:"",date:"",doctor_id:""}); loadCore(); });
  };

  const addBulk = () => {
    const times = bulkForm.times.trim().split("\n").map(l=>{const[s,e]=l.split(",").map(x=>x.trim());return{start_time:s,end_time:e};}).filter(t=>t.start_time&&t.end_time);
    fetch(`${API}/slots/bulk`,{method:"POST",headers:h,body:JSON.stringify({...bulkForm,times})})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify(d.message); setShowBulk(false); loadCore(); });
  };

  const deleteSlot = (id) => {
    if(!window.confirm("Delete slot?")) return;
    fetch(`${API}/slots/${id}`,{method:"DELETE",headers:h}).then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify("Deleted"); loadCore(); });
  };

  const cancelBooking = (id) => {
    if(!window.confirm("Cancel booking?")) return;
    fetch(`${API}/bookings/${id}/cancel`,{method:"POST",headers:h}).then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify("Cancelled"); loadCore(); });
  };

  const reschedule = () => {
    if(!newSlotId) return notify("Select a slot","error");
    fetch(`${API}/bookings/${reschedModal._id}/reschedule`,{method:"POST",headers:h,body:JSON.stringify({new_slot_id:newSlotId})})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify(d.message); setReschedModal(null); setNewSlotId(""); loadCore(); });
  };

  const bookSlot = (slotId, reason="") => {
    fetch(`${API}/book/${slotId}`,{method:"POST",headers:h,body:JSON.stringify({reason})})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify(d.message); setBookModal(null); loadCore(); });
  };

  const availableSlots = slots.filter(s=>!s.is_booked);

  const nav = [
    {id:"analytics", icon:"📊", label:"Analytics"},
    {id:"doctors",   icon:"👨‍⚕️", label:"Doctors"},
    {id:"slots",     icon:"🗓️",  label:"Slots"},
    {id:"bookings",  icon:"📋", label:"Bookings"},
    {id:"users",     icon:"👥", label:"Users"},
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Segoe UI',system-ui,sans-serif", background:P.bg }}>
      <Sidebar tab={tab} setTab={setTab} user={user} onLogout={onLogout} navItems={nav} accent={P.tealDark} />
      <main style={{ flex:1, padding:"28px 32px", overflowY:"auto" }}>

        {tab === "analytics" && <AnalyticsPage notify={notify} />}
        {tab === "doctors"   && <DoctorsPage   notify={notify} />}

        {/* ── SLOTS ── */}
        {tab === "slots" && (<>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
            <h2 style={{ margin:0, fontSize:24, fontWeight:800, color:P.text }}>Manage Slots</h2>
            <button onClick={()=>setShowBulk(true)} style={btn("primary")}>🔁 Bulk / Recurring</button>
          </div>

          <div style={card()}>
            <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700 }}>➕ Add Single Slot</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
              <input style={inp} type="date" value={slotForm.date} onChange={e=>setSlotForm({...slotForm,date:e.target.value})} />
              <input style={inp} placeholder="Start (09:00 AM)" value={slotForm.start_time} onChange={e=>setSlotForm({...slotForm,start_time:e.target.value})} />
              <input style={inp} placeholder="End (09:30 AM)" value={slotForm.end_time} onChange={e=>setSlotForm({...slotForm,end_time:e.target.value})} />
              <select style={{...inp,background:"#f8fafc"}} value={slotForm.doctor_id} onChange={e=>setSlotForm({...slotForm,doctor_id:e.target.value})}>
                <option value="">Select Doctor</option>
                {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name} ({d.specialization})</option>)}
              </select>
            </div>
            <button onClick={addSlot} style={{...btn("primary"),marginTop:14}}>Add Slot</button>
          </div>

          {/* Filter row */}
          <div style={{...card(),padding:"16px 22px"}}>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontWeight:600,fontSize:14 }}>🔍</span>
              <input style={{...inp,maxWidth:170}} type="date" value={slotFilter.date} onChange={e=>setSlotFilter({...slotFilter,date:e.target.value})} />
              <select style={{...inp,maxWidth:220,background:"#f8fafc"}} value={slotFilter.doctor_id} onChange={e=>setSlotFilter({...slotFilter,doctor_id:e.target.value})}>
                <option value="">All Doctors</option>
                {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
              </select>
              <select style={{...inp,maxWidth:160,background:"#f8fafc"}} value={slotFilter.available_only} onChange={e=>setSlotFilter({...slotFilter,available_only:e.target.value})}>
                <option value="">All</option><option value="true">Available Only</option>
              </select>
              <button onClick={()=>setSlotFilter({date:"",doctor_id:"",available_only:""})} style={btn("ghost")}>Clear</button>
            </div>
          </div>

          <div style={card()}>
            <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700 }}>Slots ({slots.length})</h3>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:`2px solid ${P.border}`, color:P.muted, textAlign:"left" }}>
                {["Date","Doctor","Specialization","Time","Status","Booked By","Actions"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {slots.map(sl=>(
                  <tr key={sl._id} style={{ borderBottom:`1px solid ${P.border}` }}>
                    <td style={{ padding:"10px 12px" }}>{sl.date||"—"}</td>
                    <td style={{ padding:"10px 12px", fontWeight:600 }}>Dr. {sl.doctor_name||"—"}</td>
                    <td style={{ padding:"10px 12px", color:P.muted, fontSize:12 }}>{sl.specialization||"—"}</td>
                    <td style={{ padding:"10px 12px" }}>{sl.start_time}–{sl.end_time}</td>
                    <td style={{ padding:"10px 12px" }}>{sl.is_booked?<span style={{color:P.danger,fontWeight:700}}>Booked</span>:<span style={{color:P.success,fontWeight:700}}>Available</span>}</td>
                    <td style={{ padding:"10px 12px", color:P.muted }}>{sl.booked_by||"—"}</td>
                    <td style={{ padding:"10px 12px", display:"flex", gap:8 }}>
                      {!sl.is_booked && <button onClick={()=>setBookModal(sl)} style={{...btn("success"),padding:"5px 12px",fontSize:12}}>Book</button>}
                      {!sl.is_booked && <button onClick={()=>deleteSlot(sl._id)} style={{...btn("danger"),padding:"5px 12px",fontSize:12}}>Delete</button>}
                    </td>
                  </tr>
                ))}
                {slots.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:P.muted}}>No slots found</td></tr>}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ── BOOKINGS ── */}
        {tab === "bookings" && (<>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
            <h2 style={{ margin:0, fontSize:24, fontWeight:800, color:P.text }}>All Bookings</h2>
            <button onClick={()=>window.open(`${API}/export/bookings`,"_blank")} style={btn("primary")}>⬇ Export CSV</button>
          </div>
          <div style={{...card(),padding:"16px 22px",marginBottom:16}}>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              <input style={{...inp,maxWidth:210}} placeholder="Search name/email…" value={bookingFilter.search} onChange={e=>setBookingFilter({...bookingFilter,search:e.target.value})} />
              <select style={{...inp,maxWidth:150,background:"#f8fafc"}} value={bookingFilter.status} onChange={e=>setBookingFilter({...bookingFilter,status:e.target.value})}>
                <option value="">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
              <input style={{...inp,maxWidth:170}} type="date" value={bookingFilter.date} onChange={e=>setBookingFilter({...bookingFilter,date:e.target.value})} />
              <select style={{...inp,maxWidth:210,background:"#f8fafc"}} value={bookingFilter.doctor_id} onChange={e=>setBookingFilter({...bookingFilter,doctor_id:e.target.value})}>
                <option value="">All Doctors</option>
                {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
              </select>
              <button onClick={()=>setBookingFilter({search:"",status:"",date:"",doctor_id:""})} style={btn("ghost")}>Clear</button>
            </div>
          </div>
          <div style={card()}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:`2px solid ${P.border}`, color:P.muted, textAlign:"left" }}>
                {["Patient","Doctor","Specialization","Date","Time","Status","Actions"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {bookings.map(b=>(
                  <tr key={b._id} style={{ borderBottom:`1px solid ${P.border}` }}>
                    <td style={{ padding:"10px 12px", fontWeight:600 }}>{b.name}</td>
                    <td style={{ padding:"10px 12px" }}>Dr. {b.doctor_name}</td>
                    <td style={{ padding:"10px 12px", color:P.muted, fontSize:12 }}>{b.specialization||"—"}</td>
                    <td style={{ padding:"10px 12px", color:P.muted }}>{b.date||"—"}</td>
                    <td style={{ padding:"10px 12px" }}>{b.start_time}–{b.end_time}</td>
                    <td style={{ padding:"10px 12px" }}><Badge status={b.status} /></td>
                    <td style={{ padding:"10px 12px" }}>
                      {b.status==="confirmed"&&(
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={()=>cancelBooking(b._id)} style={{...btn("danger"),padding:"5px 12px",fontSize:12}}>Cancel</button>
                          <button onClick={()=>{setReschedModal(b);setNewSlotId("");}} style={{...btn("warning"),padding:"5px 12px",fontSize:12}}>Reschedule</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:P.muted}}>No bookings found</td></tr>}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ── USERS ── */}
        {tab === "users" && (<>
          <h2 style={{ margin:"0 0 22px", fontSize:24, fontWeight:800, color:P.text }}>Registered Users</h2>
          <div style={card()}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:`2px solid ${P.border}`, color:P.muted, textAlign:"left" }}>
                {["Name","Email","Role","Registered"].map(h=><th key={h} style={{ padding:"8px 12px", fontWeight:600 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u._id} style={{ borderBottom:`1px solid ${P.border}` }}>
                    <td style={{ padding:"10px 12px", fontWeight:600 }}>{u.name}</td>
                    <td style={{ padding:"10px 12px", color:P.muted }}>{u.email}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ background:u.role==="admin"?"#dbeafe":"#d1fae5", color:u.role==="admin"?"#1d4ed8":"#065f46", padding:"2px 10px", borderRadius:999, fontSize:12, fontWeight:600 }}>{u.role}</span>
                    </td>
                    <td style={{ padding:"10px 12px", color:P.muted, fontSize:12 }}>{u.created_at?new Date(u.created_at).toLocaleString():"—"}</td>
                  </tr>
                ))}
                {users.length===0&&<tr><td colSpan={4} style={{padding:28,textAlign:"center",color:P.muted}}>No users</td></tr>}
              </tbody>
            </table>
          </div>
        </>)}
      </main>

      {/* BOOK MODAL */}
      {bookModal && (
        <Modal title={`Book: ${bookModal.start_time}–${bookModal.end_time}`} onClose={()=>setBookModal(null)}>
          <p style={{ color:P.muted, fontSize:14, margin:"0 0 14px" }}>Dr. {bookModal.doctor_name} · {bookModal.date}</p>
          <textarea style={{...inp,minHeight:80,marginBottom:14}} placeholder="Reason for visit" id="reason_inp" />
          <button onClick={()=>bookSlot(bookModal._id, document.getElementById("reason_inp").value)} style={{...btn("success"),width:"100%",padding:"11px"}}>Confirm Booking</button>
        </Modal>
      )}

      {/* RESCHEDULE MODAL */}
      {reschedModal && (
        <Modal title={`Reschedule: ${reschedModal.name}`} onClose={()=>setReschedModal(null)}>
          <p style={{ color:P.muted, fontSize:14, margin:"0 0 14px" }}>Current: <b>{reschedModal.start_time}–{reschedModal.end_time}</b> · {reschedModal.date}</p>
          <select style={{...inp,background:"#fff",marginBottom:16}} value={newSlotId} onChange={e=>setNewSlotId(e.target.value)}>
            <option value="">— Select New Slot —</option>
            {availableSlots.map(sl=><option key={sl._id} value={sl._id}>{sl.date} · {sl.start_time}–{sl.end_time} — Dr. {sl.doctor_name}</option>)}
          </select>
          {availableSlots.length===0&&<p style={{color:P.danger,fontSize:13}}>No available slots.</p>}
          <button onClick={reschedule} style={{...btn("warning"),width:"100%",padding:"11px"}}>Confirm Reschedule</button>
        </Modal>
      )}

      {/* BULK MODAL */}
      {showBulk && (
        <Modal title="🔁 Recurring Slots" onClose={()=>setShowBulk(false)} w={480}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <select style={{...inp,background:"#f8fafc"}} value={bulkForm.doctor_id} onChange={e=>setBulkForm({...bulkForm,doctor_id:e.target.value})}>
              <option value="">Select Doctor</option>
              {doctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
            </select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={{ fontSize:12,color:P.muted }}>From</label><input style={inp} type="date" value={bulkForm.from_date} onChange={e=>setBulkForm({...bulkForm,from_date:e.target.value})} /></div>
              <div><label style={{ fontSize:12,color:P.muted }}>To</label><input style={inp} type="date" value={bulkForm.to_date} onChange={e=>setBulkForm({...bulkForm,to_date:e.target.value})} /></div>
            </div>
            <div>
              <label style={{ fontSize:12,color:P.muted }}>Times (start,end per line)</label>
              <textarea style={{...inp,minHeight:90,marginTop:4,fontFamily:"monospace",fontSize:13}} value={bulkForm.times} onChange={e=>setBulkForm({...bulkForm,times:e.target.value})} />
            </div>
            <label style={{ display:"flex",alignItems:"center",gap:8,fontSize:14,cursor:"pointer" }}>
              <input type="checkbox" checked={bulkForm.skip_weekends} onChange={e=>setBulkForm({...bulkForm,skip_weekends:e.target.checked})} /> Skip weekends
            </label>
            <button onClick={addBulk} style={{...btn("primary"),padding:"11px"}}>Generate Slots</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  USER / PATIENT DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function UserDashboard({ user, onLogout, notify }) {
  const [tab, setTab]             = useState("book");
  const [slots, setSlots]         = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [doctors, setDoctors]     = useState([]);
  const [specs, setSpecs]         = useState([]);
  const [filter, setFilter]       = useState({ date:"", doctor_id:"", specialization:"" });
  const [reschedModal, setReschedModal] = useState(null);
  const [newSlotId, setNewSlotId] = useState("");
  const [reasons, setReasons]     = useState({});
  const h = authH();

  const load = useCallback(() => {
    const q = new URLSearchParams({ available_only:"true", ...Object.fromEntries(Object.entries(filter).filter(([,v])=>v)) }).toString();
    fetch(`${API}/slots?${q}`).then(r=>r.json()).then(setSlots).catch(()=>{});
    fetch(`${API}/bookings/mine`,{headers:h}).then(r=>r.json()).then(setMyBookings).catch(()=>{});
    fetch(`${API}/doctors`).then(r=>r.json()).then(setDoctors).catch(()=>{});
    fetch(`${API}/specializations`).then(r=>r.json()).then(setSpecs).catch(()=>{});
  }, [filter]);

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ load(); },[filter]);

  const bookSlot = (slotId) => {
    fetch(`${API}/book/${slotId}`,{method:"POST",headers:h,body:JSON.stringify({reason:reasons[slotId]||""})})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify(d.message); load(); });
  };

  const cancelBooking = (id) => {
    if(!window.confirm("Cancel appointment?")) return;
    fetch(`${API}/bookings/${id}/cancel`,{method:"POST",headers:h})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify("Cancelled"); load(); });
  };

  const reschedule = () => {
    if(!newSlotId) return notify("Select a slot","error");
    fetch(`${API}/bookings/${reschedModal._id}/reschedule`,{method:"POST",headers:h,body:JSON.stringify({new_slot_id:newSlotId})})
      .then(r=>r.json()).then(d=>{ if(d.error) return notify(d.error,"error"); notify(d.message); setReschedModal(null); setNewSlotId(""); load(); });
  };

  // Filter slots by selected specialization (client-side on doctor list)
  const filteredDoctors = filter.specialization
    ? doctors.filter(d=>d.specialization===filter.specialization)
    : doctors;

  const nav = [
    {id:"book",    icon:"🗓️",  label:"Book Appointment"},
    {id:"history", icon:"📋", label:"My Appointments"},
    {id:"doctors", icon:"👨‍⚕️", label:"Our Doctors"},
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Segoe UI',system-ui,sans-serif", background:"#f0f9ff" }}>
      <Sidebar tab={tab} setTab={setTab} user={user} onLogout={onLogout} navItems={nav} accent="#1d4ed8" />
      <main style={{ flex:1, padding:"28px 32px", overflowY:"auto" }}>

        {/* ── BOOK ── */}
        {tab === "book" && (<>
          <h2 style={{ margin:"0 0 22px", fontSize:24, fontWeight:800, color:P.text }}>Book an Appointment</h2>
          <div style={{...card(),padding:"16px 22px"}}>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              <input style={{...inp,maxWidth:180}} type="date" value={filter.date} onChange={e=>setFilter({...filter,date:e.target.value})} />
              <select style={{...inp,maxWidth:200,background:"#f8fafc"}} value={filter.specialization} onChange={e=>setFilter({...filter,specialization:e.target.value,doctor_id:""})}>
                <option value="">All Specializations</option>
                {specs.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select style={{...inp,maxWidth:220,background:"#f8fafc"}} value={filter.doctor_id} onChange={e=>setFilter({...filter,doctor_id:e.target.value})}>
                <option value="">All Doctors</option>
                {filteredDoctors.map(d=><option key={d._id} value={d._id}>Dr. {d.name}</option>)}
              </select>
              <button onClick={()=>setFilter({date:"",doctor_id:"",specialization:""})} style={btn("ghost")}>Clear</button>
            </div>
          </div>

          {slots.length === 0 ? (
            <div style={{ textAlign:"center",padding:60,color:P.muted }}>
              <div style={{ fontSize:52 }}>🗓️</div>
              <p style={{ fontSize:15 }}>No available slots found. Try a different filter.</p>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:18 }}>
              {slots.map(sl => {
                const doc = doctors.find(d=>d._id===sl.doctor_id);
                return (
                  <div key={sl._id} style={{ background:"#fff", borderRadius:18, boxShadow:"0 2px 16px rgba(0,0,0,.06)", overflow:"hidden" }}>
                    <div style={{ height:5, background:doc?.avatar_color||P.teal }} />
                    <div style={{ padding:"20px 22px" }}>
                      {doc && (
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                          <DocAvatar name={doc.name} color={doc.avatar_color||P.teal} size={42} />
                          <div>
                            <div style={{ fontSize:14, fontWeight:800 }}>Dr. {doc.name}</div>
                            <div style={{ fontSize:12, color:doc.avatar_color||P.teal, fontWeight:600 }}>{doc.specialization}</div>
                            {doc.fees>0 && <div style={{ fontSize:12, color:P.muted }}>₹{doc.fees} consultation</div>}
                          </div>
                        </div>
                      )}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:16, fontWeight:800, color:P.text }}>⏰ {sl.start_time} – {sl.end_time}</div>
                          <div style={{ fontSize:13, color:P.muted }}>📅 {sl.date}</div>
                        </div>
                        <span style={{ background:"#d1fae5",color:"#065f46",padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:700 }}>Available</span>
                      </div>
                      <input style={{...inp,fontSize:13,marginBottom:10}} placeholder="Reason for visit (optional)" value={reasons[sl._id]||""} onChange={e=>setReasons({...reasons,[sl._id]:e.target.value})} />
                      <button onClick={()=>bookSlot(sl._id)} style={{...btn("success"),width:"100%",padding:"10px"}}>Book Now</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>)}

        {/* ── MY APPOINTMENTS ── */}
        {tab === "history" && (<>
          <h2 style={{ margin:"0 0 22px", fontSize:24, fontWeight:800, color:P.text }}>My Appointments</h2>
          {myBookings.length === 0 ? (
            <div style={{ textAlign:"center",padding:60,color:P.muted }}>
              <div style={{ fontSize:52 }}>📋</div>
              <p>No appointments yet. Go book one!</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {myBookings.map(b=>(
                <div key={b._id} style={{ background:"#fff",borderRadius:16,boxShadow:"0 2px 14px rgba(0,0,0,.06)",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14,borderLeft:`5px solid ${b.status==="confirmed"?P.success:b.status==="cancelled"?P.danger:P.warning}` }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700 }}>Dr. {b.doctor_name}</div>
                    {b.specialization && <div style={{ fontSize:12, color:P.teal, fontWeight:600, marginTop:2 }}>{b.specialization}</div>}
                    <div style={{ fontSize:13, color:P.muted, marginTop:4 }}>📅 {b.date} · ⏰ {b.start_time}–{b.end_time}</div>
                    {b.reason && <div style={{ fontSize:13, color:P.muted, marginTop:2 }}>Reason: {b.reason}</div>}
                    <div style={{ marginTop:8 }}><Badge status={b.status} /></div>
                  </div>
                  {b.status==="confirmed"&&(
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={()=>cancelBooking(b._id)} style={{...btn("danger"),padding:"8px 18px"}}>Cancel</button>
                      <button onClick={()=>{setReschedModal(b);setNewSlotId("");}} style={{...btn("warning"),padding:"8px 18px"}}>Reschedule</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── DOCTORS (public view) ── */}
        {tab === "doctors" && (<>
          <h2 style={{ margin:"0 0 22px", fontSize:24, fontWeight:800, color:P.text }}>Our Doctors</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:18 }}>
            {doctors.map(doc=>(
              <div key={doc._id} style={{ background:"#fff",borderRadius:18,boxShadow:"0 2px 16px rgba(0,0,0,.06)",overflow:"hidden" }}>
                <div style={{ height:6, background:doc.avatar_color||P.teal }} />
                <div style={{ padding:"20px 22px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:14 }}>
                    <DocAvatar name={doc.name} color={doc.avatar_color||P.teal} size={54} />
                    <div>
                      <div style={{ fontSize:15,fontWeight:800 }}>Dr. {doc.name}</div>
                      <div style={{ fontSize:12,color:doc.avatar_color||P.teal,fontWeight:600 }}>{doc.specialization}</div>
                      {doc.qualification && <div style={{ fontSize:12,color:P.muted }}>{doc.qualification}</div>}
                    </div>
                  </div>
                  {doc.bio && <p style={{ fontSize:13,color:P.muted,lineHeight:1.5,margin:"0 0 14px" }}>{doc.bio}</p>}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
                    {doc.experience>0&&<span style={{ background:"#f0fdf4",color:"#166534",padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:600 }}>{doc.experience} yrs exp</span>}
                    {doc.fees>0&&<span style={{ background:"#fffbeb",color:"#92400e",padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:600 }}>₹{doc.fees}</span>}
                    {doc.available_slots>0&&<span style={{ background:"#eff6ff",color:"#1d4ed8",padding:"3px 10px",borderRadius:999,fontSize:12,fontWeight:600 }}>{doc.available_slots} slots</span>}
                  </div>
                  <button onClick={()=>{ setTab("book"); setFilter({...filter,doctor_id:doc._id}); }} style={{...btn("primary"),width:"100%",padding:"10px",background:doc.avatar_color||P.teal}}>
                    Book with this Doctor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>)}
      </main>

      {reschedModal && (
        <Modal title="Reschedule Appointment" onClose={()=>setReschedModal(null)}>
          <p style={{ color:P.muted,fontSize:14,margin:"0 0 14px" }}>Current: <b>{reschedModal.start_time}–{reschedModal.end_time}</b> · {reschedModal.date}</p>
          <select style={{...inp,background:"#fff",marginBottom:16}} value={newSlotId} onChange={e=>setNewSlotId(e.target.value)}>
            <option value="">— Select New Slot —</option>
            {slots.map(sl=><option key={sl._id} value={sl._id}>{sl.date} · {sl.start_time}–{sl.end_time} — Dr. {sl.doctor_name}</option>)}
          </select>
          <button onClick={reschedule} style={{...btn("warning"),width:"100%",padding:"11px"}}>Confirm Reschedule</button>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(getUser);
  const [toast, setToast]       = useState(null);

  const notify = (msg, type="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null), 3400);
  };

  return (
    <>
      <style>{`
        *{box-sizing:border-box;} body{margin:0;}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes popIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
        table tr:hover{background:#fafafa;}
        button:hover:not(:disabled){opacity:.86;transform:translateY(-1px);}
        input:focus,select:focus,textarea:focus{border-color:#0d9488!important;box-shadow:0 0 0 3px rgba(13,148,136,.12);}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}
      `}</style>

      {!authUser
        ? <AuthPage onAuth={u=>{setAuthUser(u);}} />
        : authUser.role==="admin"
          ? <AdminDashboard user={authUser} onLogout={()=>{clearAuth();setAuthUser(null);}} notify={notify} />
          : <UserDashboard  user={authUser} onLogout={()=>{clearAuth();setAuthUser(null);}} notify={notify} />
      }
      <Toast t={toast} />
    </>
  );
}