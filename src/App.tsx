import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDWkPmOIr2C4p6SBrpMqszi6_aiqzO3-Tw",
  authDomain: "dashboard-trafegou.firebaseapp.com",
  projectId: "dashboard-trafegou",
  storageBucket: "dashboard-trafegou.firebasestorage.app",
  messagingSenderId: "572699819361",
  appId: "1:572699819361:web:f5a54cf0dbfd82e3e89920"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function loadFromFirebase() {
  try {
    const snap = await getDoc(doc(db, "dashboard", "data"));
    if (snap.exists()) return snap.data();
  } catch (e) { console.error(e); }
  return null;
}
async function saveToFirebase(data) {
  try {
    await setDoc(doc(db, "dashboard", "data"), data);
    return true;
  } catch (e) { console.error(e); return false; }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const CURRENT_MONTH_LABEL = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });
const nowLabel = () => new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function makeUnit(id, name) {
  return {
    id, name: name || `Unidade ${pad(id)}`,
    campaigns: "", leads: 0, cpl: 0, clicks: 0,
    investment: 0, revenue: 0, received: 0, receivedTG: 0,
    adjustments: [],   // [{text, date}]
    observations: [],  // [{text, date}]
    weeklyData: [
      { semana: "Sem 1", leads: 0, cliques: 0 },
      { semana: "Sem 2", leads: 0, cliques: 0 },
      { semana: "Sem 3", leads: 0, cliques: 0 },
      { semana: "Sem 4", leads: 0, cliques: 0 },
    ],
  };
}

function migrateUnit(u) {
  // migrate old string fields to arrays
  return {
    investment: 0, revenue: 0, received: 0, receivedTG: 0,
    ...u,
    adjustments: Array.isArray(u.adjustments)
      ? u.adjustments
      : u.adjustments ? [{ text: u.adjustments, date: "" }] : [],
    observations: Array.isArray(u.observations)
      ? u.observations
      : u.observations ? [{ text: u.observations, date: "" }] : [],
  };
}

function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── styles ────────────────────────────────────────────────────────────────────
const S = {
  inp: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 8, padding: "7px 10px", color: "#f0f0f0", fontSize: 13,
    fontFamily: "'DM Mono', monospace", outline: "none", width: "100%",
    boxSizing: "border-box",
  },
  card: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 24, marginBottom: 24,
  },
  sLabel: {
    fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: 2,
    color: "#a78bfa", textTransform: "uppercase", marginBottom: 18,
  },
  fLabel: {
    fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: 1.5,
    color: "#555", textTransform: "uppercase", marginBottom: 6,
  },
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${accent}33`, borderRadius: 16, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 5, minWidth: 140, flex: 1 }}>
      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: 2, color: accent, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f0", fontFamily: "'Syne', sans-serif" }}>{value}</span>
    </div>
  );
}

// ── WeeklyChart ───────────────────────────────────────────────────────────────
function WeeklyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="semana" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#aaa" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="leads" name="Leads" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cliques" name="Cliques" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── NotesList ── threaded notes with date ─────────────────────────────────────
function NotesList({ items, onAdd, onDelete, label, accent }) {
  const [draft, setDraft] = useState("");
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ ...S.sLabel, color: accent || "#a78bfa" }}>{label}</div>
      {items.length === 0 && <div style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>Nenhum registro ainda.</div>}
      {items.map((item, i) => (
        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, position: "relative" }}>
          <div style={{ fontSize: 12, color: "#f0f0f0", lineHeight: 1.6, whiteSpace: "pre-wrap", paddingRight: 24 }}>{item.text}</div>
          {item.date && <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>{item.date}</div>}
          {onDelete && (
            <button onClick={() => onDelete(i)} style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", cursor: "pointer", color: "#444", fontSize: 14, lineHeight: 1 }}>✕</button>
          )}
        </div>
      ))}
      {onAdd && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Escreva e clique em Adicionar..."
            rows={3}
            style={{ ...S.inp, resize: "vertical", lineHeight: 1.5, marginBottom: 8 }}
          />
          <button
            onClick={() => { if (draft.trim()) { onAdd({ text: draft.trim(), date: nowLabel() }); setDraft(""); } }}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: accent || "#a78bfa", color: "#fff", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer", fontWeight: 600 }}
          >
            + Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

// ── ConsolidatedView ──────────────────────────────────────────────────────────
function ConsolidatedView({ units, onCloseMonth }) {
  const [confirmClose, setConfirmClose] = useState(false);
  const totalLeads = units.reduce((s, u) => s + Number(u.leads), 0);
  const totalClicks = units.reduce((s, u) => s + Number(u.clicks), 0);
  const withCpl = units.filter(u => Number(u.cpl) > 0);
  const avgCPL = withCpl.length ? withCpl.reduce((s, u) => s + Number(u.cpl), 0) / withCpl.length : 0;
  const cw = [
    { semana: "Sem 1", leads: 0, cliques: 0 }, { semana: "Sem 2", leads: 0, cliques: 0 },
    { semana: "Sem 3", leads: 0, cliques: 0 }, { semana: "Sem 4", leads: 0, cliques: 0 },
  ];
  units.forEach(u => u.weeklyData.forEach((w, i) => { cw[i].leads += Number(w.leads); cw[i].cliques += Number(w.cliques); }));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="Total de Leads" value={totalLeads.toLocaleString("pt-BR")} accent="#a78bfa" />
        <StatCard label="Total de Cliques" value={totalClicks.toLocaleString("pt-BR")} accent="#60a5fa" />
        <StatCard label="CPL Médio da Rede" value={formatBRL(avgCPL)} accent="#34d399" />
        <StatCard label="Unidades Ativas" value={units.filter(u => u.campaigns).length} accent="#f59e0b" />
      </div>
      <div style={S.card}><div style={S.sLabel}>Evolução Semanal Consolidada</div><WeeklyChart data={cw} /></div>

      {/* Table — sem colunas de obs/ajustes */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(167,139,250,0.1)" }}>
              {["Unidade", "Campanhas Ativas", "Leads", "CPL Médio", "Cliques"].map(h => (
                <th key={h} style={{ padding: "13px 14px", textAlign: "left", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1.5, color: "#a78bfa", textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...units].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((u, i) => (
              <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                <td style={{ padding: "11px 14px", color: "#f0f0f0", fontWeight: 600, whiteSpace: "nowrap" }}>{u.name}</td>
                <td style={{ padding: "11px 14px", color: "#aaa", fontSize: 12 }}>{u.campaigns || "—"}</td>
                <td style={{ padding: "11px 14px", color: "#34d399", fontWeight: 700 }}>{Number(u.leads).toLocaleString("pt-BR")}</td>
                <td style={{ padding: "11px 14px", color: "#f59e0b" }}>{Number(u.cpl) > 0 ? formatBRL(u.cpl) : "—"}</td>
                <td style={{ padding: "11px 14px", color: "#60a5fa" }}>{Number(u.clicks).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
        {!confirmClose
          ? <button onClick={() => setConfirmClose(true)} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid rgba(251,191,36,0.4)", background: "transparent", color: "#fbbf24", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>📦 Fechar mês atual</button>
          : <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#888" }}>Confirmar fechamento do mês?</span>
              <button onClick={() => setConfirmClose(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => { onCloseMonth(); setConfirmClose(false); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #fbbf24, #d97706)", color: "#1a1a00", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Confirmar</button>
            </div>
        }
      </div>
    </div>
  );
}

// ── HistoryView ───────────────────────────────────────────────────────────────
function HistoryView({ history }) {
  const [openMonth, setOpenMonth] = useState(null);
  const [openUnit, setOpenUnit] = useState(null);

  if (!history.length) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: "#444", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
      Nenhum mês fechado ainda.
    </div>
  );

  return (
    <div>
      {[...history].reverse().map((month) => {
        const isOpen = openMonth === month.label;
        const tl = month.units.reduce((s, u) => s + Number(u.leads), 0);
        const tc = month.units.reduce((s, u) => s + Number(u.clicks), 0);
        const wc = month.units.filter(u => Number(u.cpl) > 0);
        const avgCPL = wc.length ? wc.reduce((s, u) => s + Number(u.cpl), 0) / wc.length : 0;

        return (
          <div key={month.label} style={{ ...S.card, marginBottom: 16 }}>
            <div onClick={() => { setOpenMonth(isOpen ? null : month.label); setOpenUnit(null); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", textTransform: "capitalize" }}>{month.label}</span>
                <span style={{ marginLeft: 16, fontSize: 11, color: "#555" }}>{tl} leads · {tc} cliques · CPL médio {formatBRL(avgCPL)}</span>
              </div>
              <span style={{ color: "#555" }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 20 }}>
                {/* Comparison chart — last 3 months */}
                <MonthComparisonChart history={history} currentMonth={month.label} />
                {month.units.map(u => {
                  const key = `${month.label}-${u.id}`;
                  const isUnitOpen = openUnit === key;
                  const roi = u.investment > 0 ? (((u.receivedTG || 0) - u.investment) / u.investment * 100).toFixed(1) : null;
                  return (
                    <div key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 12 }}>
                      <div onClick={() => setOpenUnit(isUnitOpen ? null : key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                        <span style={{ fontWeight: 600, color: "#ccc", fontSize: 13 }}>{u.name}</span>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "#34d399" }}>{u.leads} leads</span>
                          <span style={{ fontSize: 11, color: "#f59e0b" }}>{Number(u.cpl) > 0 ? formatBRL(u.cpl) : "—"}</span>
                          {roi !== null && <span style={{ fontSize: 11, color: roi >= 0 ? "#34d399" : "#f87171" }}>ROI {roi}%</span>}
                          <span style={{ color: "#555" }}>{isUnitOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {isUnitOpen && (
                        <div style={{ marginTop: 14 }}>
                          {/* Report summary */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
                            {[
                              { label: "Leads", value: u.leads, color: "#a78bfa" },
                              { label: "CPL Médio", value: u.cpl > 0 ? formatBRL(u.cpl) : "—", color: "#f59e0b" },
                              { label: "Investido", value: formatBRL(u.investment), color: "#60a5fa" },
                              { label: "Fat. Geral", value: formatBRL(u.revenue), color: "#34d399" },
                              { label: "Recebido", value: formatBRL(u.received), color: "#34d399" },
                              { label: "Recebido TG", value: formatBRL(u.receivedTG), color: "#fbbf24" },
                              { label: "ROI", value: roi !== null ? `${roi}%` : "—", color: roi >= 0 ? "#34d399" : "#f87171" },
                            ].map(({ label, value, color }) => (
                              <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                                <div style={S.fLabel}>{label}</div>
                                <div style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {/* Campaigns */}
                          {u.campaigns && <div style={{ marginBottom: 12 }}><div style={S.fLabel}>Campanhas Ativas</div><div style={{ color: "#aaa", fontSize: 12 }}>{u.campaigns}</div></div>}
                          {/* Adjustments */}
                          {u.adjustments?.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={S.fLabel}>Ajustes de Campanha</div>
                              {u.adjustments.map((a, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                  <div style={{ color: "#aaa", fontSize: 12, whiteSpace: "pre-wrap" }}>{a.text}</div>
                                  {a.date && <div style={{ color: "#444", fontSize: 10, marginTop: 4 }}>{a.date}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Observations */}
                          {u.observations?.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={S.fLabel}>Observações</div>
                              {u.observations.map((o, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                  <div style={{ color: "#aaa", fontSize: 12, whiteSpace: "pre-wrap" }}>{o.text}</div>
                                  {o.date && <div style={{ color: "#444", fontSize: 10, marginTop: 4 }}>{o.date}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div><div style={S.fLabel}>Evolução Semanal</div><WeeklyChart data={u.weeklyData} /></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MonthComparisonChart ──────────────────────────────────────────────────────
function MonthComparisonChart({ history, currentMonth }) {
  const idx = history.findIndex(h => h.label === currentMonth);
  const slice = history.slice(Math.max(0, idx - 2), idx + 1);
  if (slice.length < 2) return null;
  const data = slice.map(m => ({
    mes: m.label.slice(0, 3),
    leads: m.units.reduce((s, u) => s + Number(u.leads), 0),
    investido: m.units.reduce((s, u) => s + Number(u.investment || 0), 0),
    recebidoTG: m.units.reduce((s, u) => s + Number(u.receivedTG || 0), 0),
  }));
  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <div style={S.sLabel}>Comparativo — Últimos {slice.length} meses</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="mes" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#aaa" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="leads" name="Leads" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="investido" name="Investido R$" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="recebidoTG" name="Recebido TG R$" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── UnitView ──────────────────────────────────────────────────────────────────
function UnitView({ unit, isEditing, onChange }) {
  const hf = (field, value) => onChange({ ...unit, [field]: value });
  const hw = (idx, field, value) => onChange({ ...unit, weeklyData: unit.weeklyData.map((w, i) => i === idx ? { ...w, [field]: value } : w) });

  const addNote = (field, item) => onChange({ ...unit, [field]: [...(unit[field] || []), item] });
  const delNote = (field, i) => onChange({ ...unit, [field]: (unit[field] || []).filter((_, j) => j !== i) });

  const roi = unit.investment > 0
    ? (((unit.receivedTG || 0) - unit.investment) / unit.investment * 100).toFixed(1)
    : null;

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Leads no Mês" value={Number(unit.leads).toLocaleString("pt-BR")} accent="#34d399" />
        <StatCard label="CPL Médio" value={Number(unit.cpl) > 0 ? formatBRL(unit.cpl) : "—"} accent="#f59e0b" />
        <StatCard label="Cliques" value={Number(unit.clicks).toLocaleString("pt-BR")} accent="#60a5fa" />
        {roi !== null && <StatCard label="ROI" value={`${roi}%`} accent={roi >= 0 ? "#34d399" : "#f87171"} />}
      </div>

      {/* Dados principais */}
      <div style={S.card}>
        <div style={S.sLabel}>Dados da Unidade</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Nome da Unidade", field: "name", type: "text" },
            { label: "Campanhas Ativas", field: "campaigns", type: "text" },
            { label: "Leads no Mês", field: "leads", type: "number" },
            { label: "CPL Médio (R$)", field: "cpl", type: "number" },
            { label: "Cliques", field: "clicks", type: "number" },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <div style={S.fLabel}>{label}</div>
              {isEditing
                ? <input type={type} value={unit[field]} onChange={e => hf(field, e.target.value)} style={S.inp} />
                : <div style={{ color: "#ccc", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{field === "cpl" ? (Number(unit.cpl) > 0 ? formatBRL(unit.cpl) : "—") : (unit[field] || "—")}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Dados financeiros */}
      <div style={S.card}>
        <div style={S.sLabel}>Dados Financeiros</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Valor Investido (R$)", field: "investment" },
            { label: "Faturamento Geral Mês (R$)", field: "revenue" },
            { label: "Recebido Mês (R$)", field: "received" },
            { label: "Recebido TrafeGOU Mês (R$)", field: "receivedTG" },
          ].map(({ label, field }) => (
            <div key={field}>
              <div style={S.fLabel}>{label}</div>
              {isEditing
                ? <input type="number" value={unit[field] || 0} onChange={e => hf(field, e.target.value)} style={S.inp} />
                : <div style={{ color: "#fbbf24", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{formatBRL(unit[field])}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Evolução semanal */}
      <div style={S.card}>
        <div style={S.sLabel}>Evolução Semanal</div>
        {isEditing && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {unit.weeklyData.map((w, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                <div style={{ ...S.fLabel, marginBottom: 10 }}>{w.semana}</div>
                <div style={{ ...S.fLabel, fontSize: 9 }}>Leads</div>
                <input type="number" value={w.leads} onChange={e => hw(i, "leads", Number(e.target.value))} style={{ ...S.inp, marginBottom: 8 }} />
                <div style={{ ...S.fLabel, fontSize: 9 }}>Cliques</div>
                <input type="number" value={w.cliques} onChange={e => hw(i, "cliques", Number(e.target.value))} style={S.inp} />
              </div>
            ))}
          </div>
        )}
        <WeeklyChart data={unit.weeklyData} />
      </div>

      {/* Ajustes de Campanha — threaded */}
      <NotesList
        items={unit.adjustments || []}
        onAdd={item => addNote("adjustments", item)}
        onDelete={i => delNote("adjustments", i)}
        label="Ajustes de Campanha"
        accent="#60a5fa"
      />

      {/* Observações — threaded */}
      <NotesList
        items={unit.observations || []}
        onAdd={item => addNote("observations", item)}
        onDelete={i => delNote("observations", i)}
        label="Observações de Acompanhamento"
        accent="#f59e0b"
      />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [units, setUnits] = useState([makeUnit(1)]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("current");
  const [selectedId, setSelectedId] = useState("consolidated");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unitsOpen, setUnitsOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await loadFromFirebase();
      if (data) {
        if (data.units) setUnits(data.units.map(migrateUnit));
        if (data.history) setHistory(data.history.map(m => ({ ...m, units: m.units.map(migrateUnit) })));
      } else {
        // first load — create 26 default units
        setUnits(Array.from({ length: 26 }, (_, i) => makeUnit(i + 1)));
      }
      setLoaded(true);
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveToFirebase({ units, history });
    setSaving(false);
    if (ok) { setSaved(true); setIsEditing(false); setTimeout(() => setSaved(false), 2500); }
  }, [units, history]);

  const handleCloseMonth = useCallback(async () => {
    const snapshot = { label: CURRENT_MONTH_LABEL, closedAt: new Date().toISOString(), units: JSON.parse(JSON.stringify(units)) };
    const newHistory = [...history.filter(h => h.label !== CURRENT_MONTH_LABEL), snapshot];
    const freshUnits = units.map(u => ({
      ...makeUnit(u.id, u.name),
      campaigns: u.campaigns,
    }));
    setSaving(true);
    const ok = await saveToFirebase({ units: freshUnits, history: newHistory });
    setSaving(false);
    if (ok) { setHistory(newHistory); setUnits(freshUnits); setSelectedId("consolidated"); setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }, [units, history]);

  const handleUnitChange = useCallback((updated) => {
    setUnits(prev => prev.map(u => u.id === updated.id ? updated : u));
  }, []);

  const addUnit = () => {
    const newId = Date.now();
    const newUnit = makeUnit(newId, "Nova Unidade");
    setUnits(prev => [...prev, newUnit]);
    setSelectedId(newId);
    setIsEditing(true);
  };

  const selectedUnit = units.find(u => String(u.id) === String(selectedId));
  const currentTitle = selectedId === "consolidated" ? "Visão Geral — Rede" : (selectedUnit?.name ?? "");
  const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d0d1a", color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>
      Carregando dados...
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0d1a", fontFamily: "'Syne', sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Sidebar ── */}
      <div style={{ width: sidebarOpen ? 230 : 0, minWidth: sidebarOpen ? 230 : 0, background: "#0a0a18", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.3s ease, min-width 0.3s ease" }}>
        <div style={{ padding: "22px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 3 }}>Meta Ads</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f0", lineHeight: 1.3 }}>Painel de<br />Campanhas</div>
          <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#444", marginTop: 4, textTransform: "capitalize" }}>{CURRENT_MONTH_LABEL}</div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[{ id: "current", label: "Atual" }, { id: "history", label: "Histórico" }].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id === "current") setSelectedId("consolidated"); }}
              style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace", background: activeTab === t.id ? "rgba(167,139,250,0.12)" : "transparent", color: activeTab === t.id ? "#a78bfa" : "#555", borderBottom: activeTab === t.id ? "2px solid #a78bfa" : "2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
          {activeTab === "current" && (
            <>
              <button onClick={() => setSelectedId("consolidated")}
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: selectedId === "consolidated" ? "rgba(167,139,250,0.15)" : "transparent", color: selectedId === "consolidated" ? "#a78bfa" : "#777", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                🌐 Visão Geral
              </button>

              {/* Dropdown de Unidades */}
              <button onClick={() => setUnitsOpen(o => !o)}
                style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#666", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Unidades</span>
                <span style={{ fontSize: 12 }}>{unitsOpen ? "▲" : "▼"}</span>
              </button>

              {unitsOpen && (
                <>
                  {sortedUnits.map(u => (
                    <button key={u.id} onClick={() => setSelectedId(u.id)}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: String(selectedId) === String(u.id) ? "rgba(167,139,250,0.12)" : "transparent", color: String(selectedId) === String(u.id) ? "#e0d7ff" : "#555", fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.name}
                    </button>
                  ))}
                  <button onClick={addUnit}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "1px dashed rgba(167,139,250,0.3)", cursor: "pointer", background: "transparent", color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontSize: 12, marginTop: 4 }}>
                    + Nova unidade
                  </button>
                </>
              )}
            </>
          )}
          {activeTab === "history" && (
            history.length === 0
              ? <div style={{ padding: "20px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#3a3a4a", lineHeight: 1.7 }}>Nenhum mês<br />fechado ainda.</div>
              : [...history].reverse().map(m => (
                <div key={m.label} style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 12, color: "#ccc", fontWeight: 600, textTransform: "capitalize" }}>{m.label}</div>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#555", marginTop: 2 }}>{m.units.reduce((s, u) => s + Number(u.leads), 0)} leads totais</div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 26px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d0d1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#444", fontSize: 18, padding: 4 }}>☰</button>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>{activeTab === "history" ? "Meses Anteriores" : currentTitle}</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {saving && <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#a78bfa" }}>Salvando...</span>}
            {saved && !saving && <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#34d399" }}>✓ Salvo</span>}
            {activeTab === "current" && selectedId !== "consolidated" && (
              isEditing
                ? <>
                    <button onClick={() => setIsEditing(false)} style={{ padding: "7px 15px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={handleSave} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{saving ? "Salvando..." : "Salvar"}</button>
                  </>
                : <button onClick={() => setIsEditing(true)} style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.4)", background: "transparent", color: "#a78bfa", fontSize: 12, cursor: "pointer" }}>✏️ Editar</button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "26px 28px" }}>
          {activeTab === "history"
            ? <HistoryView history={history} />
            : selectedId === "consolidated"
              ? <ConsolidatedView units={units} onCloseMonth={handleCloseMonth} />
              : selectedUnit
                ? <UnitView unit={selectedUnit} isEditing={isEditing} onChange={handleUnitChange} />
                : <div style={{ color: "#555", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Selecione uma unidade.</div>
          }
        </div>
      </div>
    </div>
  );
}