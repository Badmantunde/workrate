import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
const fmt    = (s) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const fmtHr  = (s) => (s/3600).toFixed(1);
const rand   = (a,b) => Math.floor(Math.random()*(b-a)+a);
const nowStr = () => new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false});
const pct    = (a,b) => b===0?0:Math.round((a/b)*100);

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:"#F7F6F3", surface:"#FFFFFF", borderLight:"#EEECE8", border:"#E3E0D9",
  text:"#18170F", sub:"#6A6760", muted:"#A5A29A",
  accent:"#1B7A50", accentLight:"#EDF6F1", accentBorder:"#BEE0CE",
  purple:"#6D28D9", purpleLight:"#F3F0FF", purpleBorder:"rgba(109,40,217,.25)",
  warn:"#B8520E", warnLight:"#FDF1E8", warnBorder:"rgba(184,82,14,.25)",
  danger:"#BE1A1A", dangerLight:"#FDEAEA", dangerBorder:"rgba(190,26,26,.25)",
  overlay:"rgba(24,23,15,0.4)",
};

const wqiColor = (w) => w>=85?C.accent:w>=70?C.warn:C.danger;
const wqiLabel = (w) => w>=85?"Excellent":w>=70?"Good":"Needs work";
const heatFill = (v,idle) => {
  if(idle) return "rgba(190,26,26,0.12)";
  if(v===0) return C.borderLight;
  if(v<25)  return "rgba(27,122,80,0.14)";
  if(v<50)  return "rgba(27,122,80,0.32)";
  if(v<75)  return "rgba(27,122,80,0.58)";
  return "rgba(27,122,80,0.84)";
};

const card  = {background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px 26px"};
const LBL   = {fontSize:11,letterSpacing:"0.07em",textTransform:"uppercase",color:C.muted,fontWeight:500,marginBottom:10};

/* SVG icons (no emojis) */
const Icon = {
  check: (size=14) => <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M2 7l3 4 6-8"/></svg>,
  cross: (size=14) => <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>,
  warn: (size=14) => <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4v4M7 9.5v.5"/><path d="M1.5 12L7 2l5.5 10H1.5z"/></svg>,
  flame: (size=20) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  target: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  chart: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>,
  star: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>,
  handshake: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12h2m-2 2h2m-6-4h2m-2 2h2m4-6v2m0 8v2m-4-6h4m-4 2h6l2-4-2-4h-6m-4 2H8L6 8l2-4h4"/></svg>,
  lightning: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z"/></svg>,
  run: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l6 6-6 6M5 5v14"/></svg>,
  doc: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  chartBar: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16v-5M12 16V9M17 16v-3"/></svg>,
  clipboard: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  circleOn: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>,
  circleOff: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>,
  settings: (size=18) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
};
const btn = (v="primary",extra={}) => ({
  padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",
  fontSize:13,fontWeight:600,letterSpacing:"-0.01em",transition:"all .15s",
  ...(v==="primary" ? {background:C.accent,color:"#fff"} : {}),
  ...(v==="ghost"   ? {background:"transparent",color:C.sub,border:`1px solid ${C.border}`} : {}),
  ...(v==="accent"  ? {background:C.accentLight,color:C.accent,border:`1px solid ${C.accentBorder}`} : {}),
  ...(v==="danger"  ? {background:C.dangerLight,color:C.danger,border:`1px solid ${C.dangerBorder}`} : {}),
  ...(v==="purple"  ? {background:C.purpleLight,color:C.purple,border:`1px solid ${C.purpleBorder}`} : {}),
  ...extra,
});
const inp = {width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,
  fontSize:13,color:C.text,background:C.bg,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════════════════════════ */
const genHeatmap = () => {
  const b=[];
  for(let h=0;h<24;h++) for(let m=0;m<12;m++){
    const peak=(h>=9&&h<=12)||(h>=14&&h<=18);
    const intensity=peak?rand(30,100):rand(0,25);
    b.push({hour:h,block:m,intensity,idle:intensity<8});
  }
  return b;
};

const HEATMAP = genHeatmap();

/*
 * SESSION SHAPE — unified between extension (v1.2) and dashboard.
 * Every session has both the new verified-time fields AND the legacy
 * fields kept for backwards compatibility with older components.
 *
 * Extension sends:  verifiedSec, wallSec, offTabSec, idleSec,
 *                   verifiedPct, offTabPct, idlePct, unregisteredTabSwitches,
 *                   registeredTabs[], offTabEvents[], activityBlocks[]
 * Dashboard needs:  duration (= verifiedSec), idle (= idlePct),
 *                   switches (= unregisteredTabSwitches)
 *                   start/end as "HH:MM" strings for display
 *
 * normalizeExtensionSession() bridges the two when sessions arrive
 * from the extension via URL hash deep-link or future API sync.
 */
function normalizeExtensionSession(raw) {
  // Parse ISO timestamps → "HH:MM" display strings
  const toHHMM = iso => {
    try { const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
    catch { return "—"; }
  };
  const toDate = iso => {
    try {
      const d=new Date(iso), now=new Date();
      const diffDays=Math.floor((now-d)/(86400000));
      if(diffDays===0) return "Today";
      if(diffDays===1) return "Yesterday";
      return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    } catch { return "—"; }
  };
  return {
    // Core identity
    id:          raw.id,
    task:        raw.task || "Untitled",
    client:      raw.client || "—",
    tags:        raw.tags || [],
    date:        raw.date || toDate(raw.sessionStart),
    start:       raw.start || toHHMM(raw.sessionStart),
    end:         raw.end   || toHHMM(raw.sessionEnd),
    approved:    raw.approved ?? false,
    shared:      raw.shared ?? false,
    // Verified-time fields (v1.2)
    verifiedSec: raw.verifiedSec ?? raw.duration ?? 0,
    wallSec:     raw.wallSec ?? raw.duration ?? 0,
    offTabSec:   raw.offTabSec ?? 0,
    idleSec:     raw.idleSec ?? 0,
    verifiedPct: raw.verifiedPct ?? 100,
    offTabPct:   raw.offTabPct ?? 0,
    idlePct:     raw.idlePct ?? raw.idle ?? 0,
    // Legacy aliases (kept for existing components)
    duration:    raw.verifiedSec ?? raw.duration ?? 0,
    idle:        raw.idlePct ?? raw.idle ?? 0,
    switches:    raw.unregisteredTabSwitches ?? raw.switches ?? 0,
    // Proof evidence
    registeredTabs: raw.registeredTabs || [],
    offTabEvents:   raw.offTabEvents   || [],
    activityBlocks: raw.activityBlocks || [],
    wqi:         raw.wqi ?? 0,
    adjustReason: raw.adjustReason || null,
    adjusted:    raw.adjusted || false,
  };
}

const INIT_SESSIONS = [
  {id:1,date:"Today",     task:"Dashboard UI Redesign",    start:"09:12",end:"12:47",
    verifiedSec:12900,wallSec:14400,offTabSec:900,idleSec:600,
    verifiedPct:90,offTabPct:6,idlePct:4,duration:12900,wqi:87,
    switches:4,idle:8,tags:["Design","React"],client:"Volta Studio",
    approved:false,shared:true,
    registeredTabs:[{domain:"figma.com",title:"Dashboard v3 – Figma"},{domain:"github.com",title:"volta-studio/dashboard"}],
    offTabEvents:[{domain:"gmail.com",durationSec:240},{domain:"slack.com",durationSec:320},{domain:"twitter.com",durationSec:340}],
    activityBlocks:[]},
  {id:2,date:"Today",     task:"API Integration & Testing",start:"14:03",end:"17:30",
    verifiedSec:12420,wallSec:13500,offTabSec:720,idleSec:360,
    verifiedPct:92,offTabPct:5,idlePct:3,duration:12420,wqi:92,
    switches:2,idle:4,tags:["Backend"],client:"Volta Studio",
    approved:true,shared:true,
    registeredTabs:[{domain:"localhost:3000",title:"API Dev Server"},{domain:"github.com",title:"volta-studio/api"}],
    offTabEvents:[{domain:"stackoverflow.com",durationSec:480},{domain:"notion.so",durationSec:240}],
    activityBlocks:[]},
  {id:3,date:"Yesterday", task:"Component Library Setup",  start:"10:00",end:"13:15",
    verifiedSec:11700,wallSec:12900,offTabSec:900,idleSec:300,
    verifiedPct:85,offTabPct:8,idlePct:7,duration:11700,wqi:78,
    switches:7,idle:12,tags:["React"],client:"Melon Co.",
    approved:false,shared:true,
    registeredTabs:[{domain:"storybook.melon.co",title:"Component Library"}],
    offTabEvents:[{domain:"youtube.com",durationSec:600},{domain:"reddit.com",durationSec:300}],
    activityBlocks:[]},
  {id:4,date:"Feb 21",    task:"Client Review Session",    start:"15:00",end:"16:30",
    verifiedSec:5400,wallSec:5400,offTabSec:0,idleSec:1188,
    verifiedPct:78,offTabPct:0,idlePct:22,duration:5400,wqi:65,
    switches:11,idle:22,tags:["Meeting"],client:"Melon Co.",
    approved:true,shared:false,
    registeredTabs:[{domain:"meet.google.com",title:"Client Review — Melon Co."}],
    offTabEvents:[],activityBlocks:[]},
  {id:5,date:"Feb 20",    task:"Auth Flow Implementation", start:"09:00",end:"12:30",
    verifiedSec:12600,wallSec:12960,offTabSec:240,idleSec:120,
    verifiedPct:97,offTabPct:2,idlePct:1,duration:12600,wqi:89,
    switches:3,idle:6,tags:["Backend","React"],client:"Orbit Labs",
    approved:false,shared:true,
    registeredTabs:[{domain:"localhost:8080",title:"Auth Service"},{domain:"github.com",title:"orbit-labs/auth"}],
    offTabEvents:[{domain:"docs.github.com",durationSec:240}],activityBlocks:[]},
  {id:6,date:"Feb 19",    task:"Design System Tokens",     start:"10:30",end:"14:00",
    verifiedSec:12600,wallSec:12780,offTabSec:120,idleSec:60,
    verifiedPct:97,offTabPct:1,idlePct:2,duration:12600,wqi:94,
    switches:1,idle:3,tags:["Design"],client:"Volta Studio",
    approved:true,shared:true,
    registeredTabs:[{domain:"figma.com",title:"Design Tokens – Volta"}],
    offTabEvents:[{domain:"notion.so",durationSec:120}],activityBlocks:[]},
];

const MILESTONES = [
  {id:1,client:"Volta Studio",title:"MVP Launch",due:"Mar 15",progress:68,hours:42,budget:5000},
  {id:2,client:"Volta Studio",title:"QA & Testing Phase",due:"Mar 28",progress:20,hours:12,budget:2000},
  {id:3,client:"Melon Co.",   title:"Rebrand Design",    due:"Mar 10",progress:90,hours:28,budget:3500},
  {id:4,client:"Orbit Labs",  title:"Auth Module",       due:"Apr 2", progress:45,hours:18,budget:2800},
];

const WQI_HISTORY = [
  {week:"Jan W1",wqi:74},{week:"Jan W2",wqi:78},{week:"Jan W3",wqi:80},{week:"Jan W4",wqi:77},
  {week:"Feb W1",wqi:82},{week:"Feb W2",wqi:85},{week:"Feb W3",wqi:83},{week:"Feb W4",wqi:87},
];

const WEEKLY = [
  {day:"M",hours:7.2,wqi:88},{day:"T",hours:6.1,wqi:82},{day:"W",hours:8.5,wqi:91},
  {day:"T",hours:5.8,wqi:74},{day:"F",hours:7.9,wqi:86},{day:"S",hours:2.1,wqi:70},{day:"S",hours:3.6,wqi:78},
];

const STREAK_DAYS = [
  {d:"M",active:true},{d:"T",active:true},{d:"W",active:true},{d:"T",active:true},
  {d:"F",active:true},{d:"S",active:false},{d:"S",active:true},
  {d:"M",active:true},{d:"T",active:true},{d:"W",active:true},{d:"T",active:true},
  {d:"F",active:true},{d:"S",active:false},{d:"S",active:false},
];

const BADGES = [
  {id:"deep_focus",   IconComp:Icon.target,   label:"Deep Focus",    desc:"4+ hour uninterrupted session",     earned:false},
  {id:"consistent",   IconComp:Icon.chart,     label:"Consistent",   desc:"7-day streak achieved",             earned:false},
  {id:"top_wqi",      IconComp:Icon.star,      label:"Top Performer",desc:"WQI above 90 for a full week",      earned:false},
  {id:"trusted",      IconComp:Icon.handshake, label:"Trusted Pro",  desc:"97%+ client approval rate",         earned:false},
  {id:"speedster",    IconComp:Icon.lightning, label:"Fast Starter", desc:"Start before 9am 5 days in a row",  earned:false},
  {id:"marathon",     IconComp:Icon.run,       label:"Marathon",     desc:"40+ hours tracked in a single week",earned:false},
];

const ADMIN_USERS = [
  {id:1,name:"Alex Rivera",  email:"alex@designco.io",  plan:"Pro",    sessions:47,revenue:8240,status:"active"},
  {id:2,name:"Jordan Kim",   email:"jordan@devcraft.io",plan:"Agency", sessions:128,revenue:22400,status:"active"},
  {id:3,name:"Sam Okafor",   email:"sam@freelance.ng",  plan:"Free",   sessions:12,revenue:0,status:"active"},
  {id:4,name:"Priya Nair",   email:"priya@studio.in",   plan:"Pro",    sessions:34,revenue:5100,status:"suspended"},
];

const TAG_OPTS     = ["Design","React","Backend","Node","Meeting","Research","Writing","DevOps"];

/* ═══════════════════════════════════════════════════════════════════════════
   AI SUMMARY GENERATOR (mock)
═══════════════════════════════════════════════════════════════════════════ */
const generateAISummary = (task, duration, wqi, switches, idle, client) => {
  const hrs   = fmtHr(duration);
  const focus = 100 - idle;
  const peaks = ["9:00–10:30 AM","10:15–11:45 AM","2:00–4:00 PM","3:30–5:00 PM"];
  const peak  = peaks[rand(0,peaks.length)];
  return {
    total:       hrs,
    peak:        peak,
    switches:    switches,
    idleRatio:   idle,
    focusRatio:  focus,
    wqi:         wqi,
    invoiceLine: `${hrs} hours of focused ${task} work for ${client}. Peak productivity window: ${peak}. Focus ratio: ${focus}%. WQI: ${wqi}/100.`,
    bullets: [
      `Completed ${task.toLowerCase()} with ${focus}% active focus time`,
      `${switches} context switch${switches!==1?"es":""} recorded — ${switches<=3?"excellent":"moderate"} concentration`,
      `Peak productivity window: ${peak}`,
      idle>15?`High idle time (${idle}%) — consider shorter, more focused sessions`:`Low idle ratio (${idle}%) — strong session quality`,
      `Work Quality Index: ${wqi}/100 — ${wqiLabel(wqi)}`,
    ],
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════════════════════════════════════ */
function Tag({children,onRemove}){
  return(
    <span style={{padding:"3px 9px",borderRadius:99,fontSize:11,fontWeight:500,background:C.accentLight,color:C.accent,display:"inline-flex",alignItems:"center",gap:4}}>
      {children}
      {onRemove&&<span onClick={onRemove} style={{cursor:"pointer",opacity:.6,lineHeight:1}}>×</span>}
    </span>
  );
}

function Field({label,children,hint}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{fontSize:12,fontWeight:500,color:C.sub,display:"block",marginBottom:6}}>{label}</label>
      {children}
      {hint&&<p style={{fontSize:11,color:C.muted,marginTop:4}}>{hint}</p>}
    </div>
  );
}

function Modal({title,onClose,children,width=480}){
  useEffect(()=>{
    const h=(e)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[onClose]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:C.overlay,padding:20,overflowY:"auto"}}
      onClick={(e)=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.surface,borderRadius:16,width:"100%",maxWidth:width,boxShadow:"0 24px 60px rgba(0,0,0,.18)",my:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:`1px solid ${C.borderLight}`}}>
          <span style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:"-0.02em"}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.muted,lineHeight:1,padding:2}}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

function Toast({message,type="success",onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);
  const colors={success:[C.accentLight,C.accent,C.accentBorder],error:[C.dangerLight,C.danger,C.dangerBorder],warn:[C.warnLight,C.warn,C.warnBorder]};
  const [bg,co,bd]=colors[type]||colors.success;
  const icon = type==="success" ? Icon.check(16) : type==="error" ? Icon.cross(16) : Icon.warn(16);
  return(
    <div style={{position:"fixed",bottom:28,right:28,zIndex:2000,background:bg,color:co,border:`1px solid ${bd}`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:500,boxShadow:"0 8px 24px rgba(0,0,0,.10)",animation:"wr-slidein .25s ease",maxWidth:340,display:"flex",alignItems:"center",gap:8}}>
      <span style={{display:"flex",flexShrink:0}}>{icon}</span>
      <span>{message}</span>
    </div>
  );
}

function ProgressBar({value,color=C.accent,height=6}){
  return(
    <div style={{height,background:C.borderLight,borderRadius:99,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,value)}%`,background:color,borderRadius:99,transition:"width .8s cubic-bezier(.16,1,.3,1)"}}/>
    </div>
  );
}

function WQIRing({score,size=84}){
  const r=(size/2)-7, circ=2*Math.PI*r, color=wqiColor(score);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
      <div style={{position:"relative",width:size,height:size}}>
        <svg width={size} height={size} style={{transform:"rotate(-90deg)",position:"absolute",inset:0}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.borderLight} strokeWidth={7}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round"
            style={{transition:"stroke-dasharray .8s cubic-bezier(.16,1,.3,1)"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:size>70?19:14,fontWeight:700,color,letterSpacing:"-0.03em"}}>{score}</span>
        </div>
      </div>
      <span style={{fontSize:11,fontWeight:600,color,letterSpacing:"0.06em",textTransform:"uppercase"}}>{wqiLabel(score)}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEATMAP
═══════════════════════════════════════════════════════════════════════════ */
function Heatmap({data}){
  const hrLabel=(h)=>h===0?"12am":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`;
  return(
    <div>
      <div style={{display:"flex",gap:10}}>
        <div style={{display:"flex",flexDirection:"column",gap:2,paddingTop:18,minWidth:34}}>
          {[0,6,12,18].map(h=>(
            <div key={h} style={{height:62,display:"flex",alignItems:"flex-start",fontSize:10,color:C.muted,fontWeight:500}}>{hrLabel(h)}</div>
          ))}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:2,marginBottom:5}}>
            {Array.from({length:12},(_,i)=>(
              <div key={i} style={{flex:1,textAlign:"center",fontSize:9,color:C.muted}}>{i===0?":00":i===6?":30":""}</div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:2}}>
            {data.map((b,i)=>(
              <div key={i} title={`${b.hour}:${String(b.block*5).padStart(2,"0")} — ${b.intensity}%${b.idle?" (idle)":""}`}
                style={{height:10,borderRadius:2,background:heatFill(b.intensity,b.idle),cursor:"default",transition:"transform .1s"}}
                onMouseEnter={e=>{e.target.style.transform="scale(1.5)";e.target.style.zIndex=5;e.target.style.position="relative";}}
                onMouseLeave={e=>{e.target.style.transform="scale(1)";e.target.style.zIndex="auto";}}
              />
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center",fontSize:11,color:C.muted,fontWeight:500}}>
        <span>Less</span>
        {[0,18,40,65,88].map(v=>(<div key={v} style={{width:10,height:10,borderRadius:2,background:heatFill(v,false),border:v===0?`1px solid ${C.border}`:"none"}}/>))}
        <span>More</span>
        <span style={{margin:"0 4px",color:C.borderLight}}>|</span>
        <div style={{width:10,height:10,borderRadius:2,background:heatFill(0,true)}}/>
        <span style={{color:C.danger}}>Idle</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXT SWITCH GRAPH
═══════════════════════════════════════════════════════════════════════════ */
function ContextSwitchGraph({sessions}){
  const list = sessions.slice(0,6);
  const max = list.length ? Math.max(...list.map(s=>s.switches??s.unregisteredTabSwitches??0),1) : 1;
  return(
    <div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",height:72}}>
        {list.map((s,i)=>{
          const sw = s.switches ?? s.unregisteredTabSwitches ?? 0;
          return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:10,fontWeight:500,color:sw>7?C.danger:sw>4?C.warn:C.accent}}>{sw}</span>
            <div style={{width:"100%",height:Math.max(4,(sw/max)*52),background:sw>7?C.danger:sw>4?C.warn:C.accentBorder,borderRadius:"3px 3px 0 0",transition:"height .4s"}}/>
            <span style={{fontSize:9,color:C.muted,textAlign:"center",maxWidth:40,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{s.date}</span>
          </div>
        );})}
      </div>
      <div style={{display:"flex",gap:14,marginTop:12,fontSize:11}}>
        {[[C.accent,"Low (≤4)"],[C.warn,"Medium (5–7)"],[C.danger,"High (8+)"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:c}}/>
            <span style={{color:C.muted}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WQI TREND CHART
═══════════════════════════════════════════════════════════════════════════ */
function WQITrendChart({data}){
  const min=60, max=100, h=80, w=320;
  const pts=data.map((d,i)=>({
    x:(i/(data.length-1))*(w-20)+10,
    y:h-((d.wqi-min)/(max-min))*(h-10)-5,
    wqi:d.wqi, week:d.week,
  }));
  const path="M"+pts.map(p=>`${p.x},${p.y}`).join(" L");
  const area=`${path} L${pts[pts.length-1].x},${h} L${pts[0].x},${h} Z`;
  return(
    <div style={{overflowX:"auto"}}>
      <svg width="100%" viewBox={`0 0 ${w} ${h+10}`} style={{display:"block"}}>
        <defs>
          <linearGradient id="wqiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity=".18"/>
            <stop offset="100%" stopColor={C.accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wqiGrad)"/>
        <path d={path} fill="none" stroke={C.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={C.surface} stroke={C.accent} strokeWidth={2}/>
            {i===pts.length-1&&(
              <text x={p.x} y={p.y-8} fontSize={9} fill={C.accent} fontWeight={600} textAnchor="middle">{p.wqi}</text>
            )}
          </g>
        ))}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        {data.filter((_,i)=>i%2===0).map(d=>(
          <span key={d.week} style={{fontSize:9,color:C.muted}}>{d.week}</span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EARNINGS PROJECTION
═══════════════════════════════════════════════════════════════════════════ */
function EarningsChart(){
  const months=[
    {m:"Nov",earned:4200,proj:null},{m:"Dec",earned:5800,proj:null},
    {m:"Jan",earned:6900,proj:null},{m:"Feb",earned:8240,proj:null},
    {m:"Mar",earned:null,proj:9100},{m:"Apr",earned:null,proj:9800},
  ];
  const maxV=10000;
  return(
    <div style={{display:"flex",gap:10,alignItems:"flex-end",height:90}}>
      {months.map((m,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:10,fontWeight:500,color:m.earned?C.text:C.muted}}>
            ${((m.earned||m.proj)/1000).toFixed(1)}k
          </span>
          <div style={{width:"100%",height:Math.max(4,((m.earned||m.proj)/maxV)*60),
            background:m.earned?C.accent:C.accentBorder,
            borderRadius:"3px 3px 0 0",
            border:m.proj?`1.5px dashed ${C.accentBorder}`:"none",
            opacity:m.proj?.7:1,
            transition:"height .5s"}}/>
          <span style={{fontSize:10,color:C.muted}}>{m.m}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STREAK TRACKER
═══════════════════════════════════════════════════════════════════════════ */
function StreakTracker({streak}){
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{color:C.warn,display:"flex"}}>{Icon.flame(32)}</div>
        <div>
          <div style={{fontSize:28,fontWeight:700,color:C.text,letterSpacing:"-0.04em",lineHeight:1}}>{streak}</div>
          <div style={{fontSize:12,color:C.sub,marginTop:2}}>day streak</div>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          <div style={{fontSize:13,fontWeight:600,color:C.accent}}>Personal best: 14</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>Keep it up!</div>
        </div>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {STREAK_DAYS.map((d,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{width:24,height:24,borderRadius:6,
              background:d.active?C.accent:C.borderLight,
              border:`1px solid ${d.active?C.accentBorder:C.border}`,
              transition:"all .2s"}}/>
            <span style={{fontSize:9,color:C.muted}}>{d.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BADGE SYSTEM
═══════════════════════════════════════════════════════════════════════════ */
function BadgeGrid({badges}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
      {badges.map(b=>{
        const IconC = b.IconComp || (()=>null);
        return (
        <div key={b.id} style={{
          padding:"14px 12px",borderRadius:10,textAlign:"center",
          background:b.earned?C.accentLight:C.bg,
          border:`1px solid ${b.earned?C.accentBorder:C.borderLight}`,
          opacity:b.earned?1:.7,
          transition:"all .2s",
        }}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:6,color:b.earned?C.accent:C.muted}}><IconC size={22}/></div>
          <div style={{fontSize:12,fontWeight:600,color:b.earned?C.text:C.muted,marginBottom:2}}>{b.label}</div>
          <div style={{fontSize:10,color:C.muted,lineHeight:1.4}}>{b.desc}</div>
          {b.earned&&<div style={{fontSize:10,color:C.accent,fontWeight:600,marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{Icon.check(12)} Earned</div>}
        </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI SESSION SUMMARY MODAL
═══════════════════════════════════════════════════════════════════════════ */
function AISummaryModal({summary,task,onClose,onInvoice,onSave}){
  const [copied,setCopied]=useState(false);
  const copy=()=>{
    navigator.clipboard.writeText(summary.invoiceLine).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  return(
    <Modal title="AI Session Summary" onClose={onClose} width={540}>
      {/* Header metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {[
          {label:"Duration",value:`${summary.total}h`,color:C.text},
          {label:"Focus ratio",value:`${summary.focusRatio}%`,color:C.accent},
          {label:"Context switches",value:summary.switches,color:summary.switches<=4?C.accent:C.warn},
          {label:"WQI Score",value:summary.wqi,color:wqiColor(summary.wqi)},
        ].map(m=>(
          <div key={m.label} style={{background:C.bg,borderRadius:10,padding:"12px",border:`1px solid ${C.borderLight}`,textAlign:"center"}}>
            <div style={{fontSize:19,fontWeight:700,color:m.color,letterSpacing:"-0.03em"}}>{m.value}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:3,fontWeight:500}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Peak window */}
      <div style={{background:C.accentLight,border:`1px solid ${C.accentBorder}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{color:C.accent,display:"flex"}}>{Icon.lightning(20)}</span>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.accent}}>Peak productivity window</div>
          <div style={{fontSize:13,color:C.text,marginTop:1}}>{summary.peak}</div>
        </div>
      </div>

      {/* Bullet insights */}
      <div style={{marginBottom:18}}>
        <div style={{...LBL,marginBottom:10}}>AI Insights</div>
        {summary.bullets.map((b,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
            <span style={{color:C.accent,fontSize:14,lineHeight:1.5,flexShrink:0}}>→</span>
            <span style={{fontSize:13,color:C.sub,lineHeight:1.5}}>{b}</span>
          </div>
        ))}
      </div>

      {/* Invoice-ready line */}
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:20}}>
        <div style={{...LBL,marginBottom:6}}>Invoice-ready summary</div>
        <p style={{fontSize:13,color:C.text,lineHeight:1.6,margin:0}}>{summary.invoiceLine}</p>
        <button onClick={copy} style={{...btn("ghost",{padding:"5px 12px",fontSize:11,marginTop:10})}}>{copied?"Copied!":"Copy text"}</button>
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Discard</button>
        <button style={btn("accent")} onClick={()=>{onInvoice();onClose();}}>Generate invoice</button>
        <button style={btn("primary")} onClick={()=>{onSave();onClose();}}>Save session</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANUAL TIME ADJUST MODAL
═══════════════════════════════════════════════════════════════════════════ */
function AdjustTimeModal({session,onClose,onSave,onToast}){
  const [newDur,setNewDur]=useState(Math.floor(session.duration/60));
  const [reason,setReason]=useState("");
  const submit=()=>{
    if(!reason.trim()){onToast("A reason is required for time adjustments","warn");return;}
    onSave({...session,duration:newDur*60,adjusted:true,adjustReason:reason});
    onToast("Time adjustment saved");
    onClose();
  };
  return(
    <Modal title="Adjust tracked time" onClose={onClose} width={420}>
      <div style={{background:C.warnLight,border:`1px solid ${C.warnBorder}`,borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.warn,fontWeight:500,display:"flex",alignItems:"center",gap:8}}>
        <span style={{flexShrink:0}}>{Icon.warn(16)}</span>
        All adjustments are logged for transparency. A reason is required.
      </div>
      <Field label="Session">
        <div style={{...inp,background:C.bg,color:C.sub,pointerEvents:"none"}}>{session.task}</div>
      </Field>
      <Field label="Adjusted duration (minutes)">
        <input style={inp} type="number" value={newDur} onChange={e=>setNewDur(+e.target.value)} min={1}/>
      </Field>
      <Field label="Reason for adjustment *" hint="This will be visible to clients on shared sessions">
        <textarea style={{...inp,height:80,resize:"vertical"}} placeholder="e.g. Timer left running during lunch break..." value={reason} onChange={e=>setReason(e.target.value)}/>
      </Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={submit}>Save adjustment</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NEW SESSION MODAL
═══════════════════════════════════════════════════════════════════════════ */
function NewSessionModal({onClose,onSave,clients,onLookupClients}){
  const clientList = Array.isArray(clients) ? clients : [];
  const clientOpts = clientList.map(c => typeof c === "string" ? c : (c?.name || "—")).filter(Boolean);
  const clientObjects = clientList.filter(c => c && typeof c === "object" && (c.id != null || c.name));
  const [form,setForm]=useState({task:"",client:clientOpts[0]||"",clientId:null,tags:[],start:nowStr(),end:"",notes:""});
  const [clientInput,setClientInput]=useState("");
  const [lookupResults,setLookupResults]=useState([]);
  const [lookupLoading,setLookupLoading]=useState(false);
  const [dropdownOpen,setDropdownOpen]=useState(false);
  const lookupTimerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!clientInput.trim() || !clientInput.includes("@")) {
      setLookupResults([]);
      return;
    }
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(async () => {
      if (!onLookupClients) { setLookupResults([]); return; }
      setLookupLoading(true);
      try {
        const list = await onLookupClients(clientInput.trim());
        setLookupResults(Array.isArray(list) ? list : []);
      } catch (_) {
        setLookupResults([]);
      } finally {
        setLookupLoading(false);
      }
    }, 300);
    return () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current); };
  }, [clientInput, onLookupClients]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayClient = form.client || "";
  const showLookup = clientInput.includes("@") && (lookupResults.length > 0 || lookupLoading);
  const optionsToShow = showLookup ? lookupResults : clientObjects;
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addTag=(t)=>{if(t&&!form.tags.includes(t))set("tags",[...form.tags,t]);};
  const selectClient=(c)=>{
    const name = c?.name || (typeof c === "string" ? c : "—");
    set("client", name);
    set("clientId", c?.id ?? null);
    setClientInput(name);
    setDropdownOpen(false);
    setLookupResults([]);
  };

  const submit=()=>{
    if(!form.task.trim())return;
    const [sh,sm]=form.start.split(":").map(Number);
    const [eh,em]=(form.end||"00:00").split(":").map(Number);
    const dur=form.end?Math.max(0,((eh*60+em)-(sh*60+sm))*60):3600;
    const wqi=rand(68,96);
    onSave({id:Date.now(),date:"Today",task:form.task,client:form.client||"—",clientId:form.clientId,
      start:form.start,end:form.end||"—",duration:dur,
      wqi,switches:rand(1,8),idle:rand(3,18),tags:form.tags,approved:false,shared:false});
    onClose();
  };

  return(
    <Modal title="New session" onClose={onClose} width={500}>
      <Field label="Task name"><input style={inp} placeholder="What did you work on?" value={form.task} onChange={e=>set("task",e.target.value)}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Start"><input style={inp} type="time" value={form.start} onChange={e=>set("start",e.target.value)}/></Field>
        <Field label="End"><input style={inp} type="time" value={form.end} onChange={e=>set("end",e.target.value)}/></Field>
      </div>
      <Field label="Client">
        <div ref={dropdownRef} style={{position:"relative"}}>
          <input
            style={inp}
            value={dropdownOpen ? clientInput : displayClient}
            onChange={e=>{ setClientInput(e.target.value); setDropdownOpen(true); if (!e.target.value.includes("@")) set("client", e.target.value); }}
            onFocus={()=>setDropdownOpen(true)}
            placeholder="Type name or client email to search"
          />
          {dropdownOpen && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.1)",maxHeight:220,overflowY:"auto",zIndex:50}}>
              {lookupLoading && <div style={{padding:"12px 14px",fontSize:12,color:C.muted}}>Searching...</div>}
              {!lookupLoading && optionsToShow.length === 0 && clientInput.includes("@") && <div style={{padding:"12px 14px",fontSize:12,color:C.muted}}>No clients found for this email.</div>}
              {!lookupLoading && optionsToShow.length === 0 && !clientInput.includes("@") && clientObjects.length === 0 && <div style={{padding:"12px 14px",fontSize:12,color:C.muted}}>Type a client email to look up, or enter a name.</div>}
              {optionsToShow.map(c=>{
                const obj = typeof c === "object" ? c : { name: c };
                const name = obj.name || obj.email || String(c);
                const logo = obj.logo_url;
                return (
                  <button key={obj.id ?? name} type="button" onClick={()=>selectClient(obj)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:"none",background:"none",cursor:"pointer",fontSize:13,color:C.text,textAlign:"left",fontFamily:"inherit",borderRadius:0}}
                    onMouseDown={e=>e.preventDefault()}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:logo ? `url(${logo}) center/cover` : `linear-gradient(135deg,${C.accent},#0D5535)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:600,flexShrink:0}}>
                      {!logo && (name.charAt(0)||"?").toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontWeight:600}}>{name}</div>
                      {obj.email && <div style={{fontSize:11,color:C.muted}}>{obj.email}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Field>
      <Field label="Tags">
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
          {form.tags.map(t=><Tag key={t} onRemove={()=>set("tags",form.tags.filter(x=>x!==t))}>{t}</Tag>)}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {TAG_OPTS.filter(t=>!form.tags.includes(t)).map(t=>(
            <button key={t} onClick={()=>addTag(t)} style={{...btn("ghost",{padding:"3px 10px",fontSize:11,borderRadius:99})}}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="Notes"><textarea style={{...inp,height:60,resize:"none"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any context..."/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={submit}>Save session</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE MODAL — well-structured invoice, downloadable (print / save as PDF)
═══════════════════════════════════════════════════════════════════════════ */
function InvoiceModal({session,onClose,onToast,currentUser}){
  const [rate,setRate]=useState(currentUser?.hourly_rate || 95);
  const [terms,setTerms]=useState("Net 14");
  const [note,setNote]=useState("");
  const dur = session.verifiedSec ?? session.duration ?? 0;
  const hrs = fmtHr(dur);
  const hrsNum = parseFloat(hrs) || 0;
  const total = (hrsNum * rate).toFixed(2);
  const invoiceDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const downloadInvoice = () => {
    const sellerName = currentUser?.name || "Freelancer";
    const sellerEmail = currentUser?.email || "";
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Invoice – ${session.task}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 32px auto; padding: 0 24px; color: #18170F; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1B7A50; }
  .logo { font-size: 20px; font-weight: 700; color: #1B7A50; }
  .meta { font-size: 12px; color: #6A6760; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid #E3E0D9; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6A6760; font-weight: 600; }
  .amount { text-align: right; font-weight: 600; }
  .total-row td { border-bottom: none; padding-top: 16px; font-size: 18px; font-weight: 700; }
  .terms { margin-top: 32px; font-size: 12px; color: #6A6760; }
  .note { margin-top: 16px; padding: 12px; background: #F7F6F3; border-radius: 8px; font-size: 13px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">WorkRate</div>
      <div class="meta">Invoice · ${invoiceDate}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 600;">${sellerName}</div>
      <div class="meta">${sellerEmail}</div>
    </div>
  </div>
  <h1>Invoice</h1>
  <p class="meta">To: ${session.client}</p>
  <table>
    <thead><tr><th>Description</th><th>Date</th><th>Hours</th><th class="amount">Rate</th><th class="amount">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>${session.task}</td>
        <td>${session.date} · ${session.start}–${session.end}</td>
        <td>${hrs}</td>
        <td class="amount">$${rate}/hr</td>
        <td class="amount">$${total}</td>
      </tr>
      <tr class="total-row"><td colspan="4" style="text-align: right;">Total</td><td class="amount">$${total}</td></tr>
    </tbody>
  </table>
  <div class="terms">Payment terms: ${terms}. All amounts in USD.</div>
  ${note ? `<div class="note">${note.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
</body>
</html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 250);
    onToast("Invoice opened for print or save as PDF");
    onClose();
  };

  return(
    <Modal title="Generate invoice" onClose={onClose} width={440}>
      <div style={{background:C.bg,borderRadius:10,padding:"14px 16px",marginBottom:20,border:`1px solid ${C.borderLight}`}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{session.task}</div>
        <div style={{fontSize:12,color:C.sub,marginTop:3}}>{session.client} · {session.date} · {session.start}–{session.end}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Hourly rate ($)"><input style={inp} type="number" value={rate} onChange={e=>setRate(+e.target.value)} min={1}/></Field>
        <Field label="Payment terms">
          <select style={inp} value={terms} onChange={e=>setTerms(e.target.value)}>
            {["Due on receipt","Net 7","Net 14","Net 30"].map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note to client">
        <textarea style={{...inp,height:60,resize:"none"}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Work completed this session..."/>
      </Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderTop:`1px solid ${C.borderLight}`,marginTop:4}}>
        <div style={{fontSize:13,color:C.sub}}>{hrs}h × ${rate}/hr</div>
        <div style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:"-0.03em"}}>${total}</div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={downloadInvoice}>Download invoice</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT MODAL
═══════════════════════════════════════════════════════════════════════════ */
function ExportModal({session,onClose,onToast}){
  return(
    <Modal title="Export session report" onClose={onClose} width={420}>
      <div style={{background:C.bg,borderRadius:10,padding:"12px 14px",marginBottom:20,border:`1px solid ${C.borderLight}`}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{session.task}</div>
        <div style={{fontSize:12,color:C.sub,marginTop:2}}>{session.client} · {fmtHr(session.duration)}h tracked</div>
      </div>
      {[[Icon.doc,"PDF Report","Full session summary with heatmap snapshot"],
        [Icon.chartBar,"CSV Export","Raw time blocks for your records"],
        [Icon.clipboard,"Client-ready summary","Clean one-pager, no raw data exposed"]].map(([Ico,t,d])=>(
        <button key={t} onClick={()=>{onToast(`${t} downloading…`);onClose();}}
          style={{...btn("ghost",{width:"100%",textAlign:"left",display:"flex",flexDirection:"row",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,marginBottom:8})}}> 
          <span style={{color:C.accent,display:"flex"}}>{typeof Ico==="function"?Ico(20):Ico}</span>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <span style={{fontWeight:600,color:C.text,fontSize:13}}>{t}</span>
            <span style={{fontSize:11,color:C.muted,fontWeight:400}}>{d}</span>
          </div>
        </button>
      ))}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEEP WORK MODAL
═══════════════════════════════════════════════════════════════════════════ */
function DeepWorkModal({active,onToggle,onClose}){
  const blocked=["twitter.com","reddit.com","youtube.com","instagram.com","tiktok.com"];
  return(
    <Modal title="Deep Work Mode" onClose={onClose} width={420}>
      <div style={{background:active?C.purpleLight:C.bg,border:`1px solid ${active?C.purpleBorder:C.border}`,borderRadius:10,padding:"16px",marginBottom:20,textAlign:"center"}}>
        <div style={{marginBottom:6,display:"flex",justifyContent:"center",color:active?C.purple:C.muted}}>{active?Icon.circleOn(28):Icon.circleOff(28)}</div>
        <div style={{fontSize:14,fontWeight:600,color:active?C.purple:C.text}}>{active?"Active — Distraction blocking on":"Currently off"}</div>
        <div style={{fontSize:12,color:C.sub,marginTop:4}}>Blocks distracting domains during focus sessions</div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={LBL}>Blocked domains</div>
        {blocked.map(d=>(
          <div key={d} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",borderRadius:8,background:C.bg,border:`1px solid ${C.borderLight}`,marginBottom:6}}>
            <span style={{fontSize:13,color:C.text}}>{d}</span>
            <span style={{fontSize:11,color:C.muted}}>Blocked when active</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Close</button>
        <button onClick={()=>{onToggle();onClose();}}
          style={btn(active?"danger":"purple",{})}>
          {active?"Disable deep work":"Enable deep work"}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILE DRAWER
═══════════════════════════════════════════════════════════════════════════ */
function ProfileDrawer({onClose,onToast,currentUser,onLogout,role,onUpdateProfile}){
  const displayName = currentUser?.name || currentUser?.email?.split("@")[0] || "";
  const [name,setName]=useState(displayName||"");
  const [email,setEmail]=useState(currentUser?.email||"");
  const [rate,setRate]=useState(currentUser?.hourly_rate ?? 95);
  const [avatarUrl,setAvatarUrl]=useState(currentUser?.avatar_url||"");
  const [studioName,setStudioName]=useState(currentUser?.studio_name ?? "");
  const isClient = role==="client";

  useEffect(() => {
    setStudioName(currentUser?.studio_name ?? "");
  }, [currentUser?.studio_name]);

  const doSave = async () => {
    try {
      if (onUpdateProfile) {
        const payload = { name: name || currentUser?.name, hourly_rate: rate };
        if (avatarUrl !== (currentUser?.avatar_url || "")) payload.avatar_url = avatarUrl || null;
        if (isClient && studioName !== undefined) payload.studio_name = studioName || null;
        await onUpdateProfile(payload);
      }
      onToast("Profile updated");
      onClose();
    } catch (e) {
      onToast(e?.message || "Update failed", "error");
    }
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{position:"absolute",inset:0,background:"rgba(24,23,15,.2)"}} onClick={onClose}/>
      <div style={{position:"relative",background:C.surface,width:380,height:"100%",boxShadow:"-24px 0 48px rgba(0,0,0,.1)",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${C.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:15,fontWeight:600,color:C.text}}>{isClient ? "Client profile" : "Profile & settings"}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.muted}}>×</button>
        </div>
        <div style={{padding:24,flex:1}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:avatarUrl ? `url(${avatarUrl}) center/cover` : `linear-gradient(135deg,${C.accent},#0D5535)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:24,fontWeight:700,marginBottom:10,overflow:"hidden"}}>
              {!avatarUrl && ((name||displayName).charAt(0)||"?").toUpperCase()}
            </div>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{name||displayName||"User"}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{isClient ? "Viewing as client / hiring" : "Freelancer"}</div>
          </div>
          <Field label="Profile photo">
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input style={{...inp,flex:1,minWidth:0}} value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)} placeholder="Image URL"/>
              <button style={btn("ghost",{padding:"8px 12px"})} onClick={()=>setAvatarUrl("")}>Remove</button>
            </div>
            <p style={{fontSize:11,color:C.muted,marginTop:4}}>Paste an image URL, or remove to use initial.</p>
          </Field>
          <Field label="Display name"><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></Field>
          <Field label="Email"><input style={{...inp,opacity:.9}} value={email} readOnly placeholder="you@example.com"/></Field>
          {isClient && (
            <Field label="Studio / Agency name" hint="Shown when you hire or approve time as a client">
              <input style={inp} value={studioName ?? ""} onChange={e=>setStudioName(e.target.value)} placeholder="Your studio or agency"/>
            </Field>
          )}
          {!isClient && <Field label="Default hourly rate ($)"><input style={inp} type="number" value={rate} onChange={e=>setRate(+e.target.value)} min={0}/></Field>}
          {onLogout&&(
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.borderLight}`}}>
              <button onClick={()=>{onLogout();onClose();}} style={{...btn("ghost",{width:"100%",fontSize:13})}}>Log out</button>
            </div>
          )}
          <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${C.borderLight}`}}>
            <div style={LBL}>Integrations (optional)</div>
            {["GitHub","LinkedIn","Twitter"].map(k=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                <span style={{fontSize:13,color:C.text,fontWeight:500}}>{k}</span>
                <span style={{fontSize:12,fontWeight:500,color:C.muted}}>Not connected</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.borderLight}`,display:"flex",gap:8}}>
          <button style={{...btn("ghost"),flex:1}} onClick={onClose}>Discard</button>
          <button style={{...btn("primary"),flex:1}} onClick={doSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSCRIPTION MODAL
═══════════════════════════════════════════════════════════════════════════ */
function SubscriptionModal({onClose,onToast}){
  const [current,setCurrent]=useState("pro");
  const plans=[
    {id:"free",   name:"Free",   price:"$0",  period:"forever", features:["Time tracking","5 sessions/month","Basic reports"],       accent:C.border},
    {id:"pro",    name:"Pro",    price:"$19", period:"/ month",  features:["Unlimited sessions","Heatmaps","WQI scoring","AI summaries","Proof score link"], accent:C.accent, popular:true},
    {id:"agency", name:"Agency", price:"$49", period:"/ month",  features:["Everything in Pro","Team dashboard","Admin panel","Priority support","White-label reports"], accent:C.purple},
  ];
  return(
    <Modal title="Subscription plans" onClose={onClose} width={600}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {plans.map(p=>(
          <div key={p.id} onClick={()=>setCurrent(p.id)}
            style={{padding:"18px 16px",borderRadius:12,border:`2px solid ${current===p.id?p.accent:C.border}`,
              background:current===p.id?`${p.accent}08`:C.surface,cursor:"pointer",position:"relative",transition:"all .15s"}}>
            {p.popular&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:C.accent,color:"#fff",fontSize:10,fontWeight:600,padding:"2px 10px",borderRadius:99,whiteSpace:"nowrap"}}>Most popular</div>}
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{p.name}</div>
            <div style={{fontSize:22,fontWeight:700,color:p.accent,letterSpacing:"-0.03em"}}>{p.price}<span style={{fontSize:12,fontWeight:400,color:C.muted}}> {p.period}</span></div>
            <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:6}}>
              {p.features.map(f=>(
                <div key={f} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                  <span style={{color:p.accent,display:"flex",flexShrink:0,marginTop:2}}>{Icon.check(12)}</span>
                  <span style={{fontSize:12,color:C.sub}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={()=>{onToast("Plan updated successfully!");onClose();}}>Confirm plan</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SESSION ROW (freelancer)
   • Accepts `highlighted` prop — auto-expands and scrolls into view
     when the dashboard is opened via a deep-link from the extension.
   • Expanded view now shows the full verified / off-tab / idle proof
     breakdown from the extension's v1.2 accountability model.
═══════════════════════════════════════════════════════════════════════════ */
function SessionRow({s, onInvoice, onExport, onAdjust, highlighted}){
  const [open, setOpen] = useState(false);
  const rowRef = useRef(null);
  const color  = wqiColor(s.wqi);

  // Auto-expand and scroll when this session is the deep-link target
  useEffect(() => {
    if (highlighted) {
      setOpen(true);
      setTimeout(() => rowRef.current?.scrollIntoView({ behavior:"smooth", block:"center" }), 120);
    }
  }, [highlighted]);

  // Derived verified-time fields (works for both legacy and v1.2 sessions)
  const verifiedSec = s.verifiedSec ?? s.duration ?? 0;
  const wallSec     = s.wallSec     ?? s.duration ?? 0;
  const offTabSec   = s.offTabSec   ?? 0;
  const idleSec     = s.idleSec     ?? 0;
  const verifiedPct = s.verifiedPct ?? 100;
  const offTabPct   = s.offTabPct   ?? 0;
  const idlePct     = s.idlePct     ?? s.idle ?? 0;
  const isV12       = s.verifiedPct != null; // has extension v1.2 data

  return(
    <div ref={rowRef}
      style={{
        background: C.surface,
        border: `1px solid ${highlighted ? C.accentBorder : open ? C.accentBorder : C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color .15s",
        boxShadow: highlighted ? `0 0 0 3px ${C.accentLight}` : "none",
      }}>

      {/* ── Row header — click to expand ── */}
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",cursor:"pointer"}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:500,color:C.text,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {s.task}
            {s.adjusted&&<span style={{fontSize:10,color:C.warn,fontWeight:600,background:C.warnLight,padding:"1px 7px",borderRadius:99,border:`1px solid ${C.warnBorder}`}}>Adjusted</span>}
            {s.approved&&<span style={{fontSize:10,color:C.accent,fontWeight:600,background:C.accentLight,padding:"1px 7px",borderRadius:99,border:`1px solid ${C.accentBorder}`}}>Approved</span>}
            {highlighted&&<span style={{fontSize:10,color:C.purple,fontWeight:600,background:C.purpleLight,padding:"1px 7px",borderRadius:99,border:`1px solid ${C.purpleBorder}`}}>↑ From extension</span>}
          </div>
          <div style={{fontSize:12,color:C.sub,marginTop:3}}>{s.date} · {s.start}–{s.end} · {s.client}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {(s.tags||[]).map(t=><span key={t} style={{padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:500,background:C.accentLight,color:C.accent}}>{t}</span>)}
        </div>
        {/* Verified time (primary) vs wall (secondary) */}
        <div style={{textAlign:"right",minWidth:60}}>
          <div style={{fontSize:15,fontWeight:600,color:C.text,letterSpacing:"-0.02em"}}>{fmtHr(verifiedSec)}h</div>
          <div style={{fontSize:10,color:C.muted,fontWeight:500}}>
            {isV12 ? `verified · ${verifiedPct}%` : "tracked"}
          </div>
        </div>
        <div style={{textAlign:"center",minWidth:40}}>
          <div style={{fontSize:15,fontWeight:600,color,letterSpacing:"-0.02em"}}>{s.wqi}</div>
          <div style={{fontSize:10,color:C.muted,fontWeight:500}}>WQI</div>
        </div>
        <div style={{color:C.muted,fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</div>
      </div>

      {/* ── Expanded detail ── */}
      {open&&(
        <div style={{padding:"0 20px 18px",borderTop:`1px solid ${C.borderLight}`}}>

          {/* v1.2 verified-time proof bar */}
          {isV12 && (
            <div style={{marginTop:14,marginBottom:4}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em"}}>Time breakdown — verified proof</span>
                <span style={{fontSize:11,color:C.muted}}>Wall clock: {fmtHr(wallSec)}h total</span>
              </div>
              {/* Stacked proof bar */}
              <div style={{display:"flex",height:10,borderRadius:99,overflow:"hidden",gap:1}}>
                <div title={`Verified: ${verifiedPct}%`}  style={{flex:verifiedPct,background:C.accent,borderRadius:"99px 0 0 99px"}}/>
                <div title={`Off-tab: ${offTabPct}%`}     style={{flex:offTabPct,background:C.warn}}/>
                <div title={`Idle: ${idlePct}%`}          style={{flex:idlePct||0.5,background:C.danger,borderRadius:"0 99px 99px 0"}}/>
              </div>
              {/* Legend */}
              <div style={{display:"flex",gap:16,marginTop:8}}>
                {[
                  {label:"Verified on project tabs", pct:verifiedPct, sec:verifiedSec, color:C.accent},
                  {label:"Off-tab",                  pct:offTabPct,   sec:offTabSec,   color:C.warn},
                  {label:"Idle",                     pct:idlePct,     sec:idleSec,     color:C.danger},
                ].map(m=>(
                  <div key={m.label} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.sub}}>{m.label}: <strong style={{color:m.color}}>{m.pct}%</strong> <span style={{color:C.muted}}>({fmtHr(m.sec)}h)</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality stats */}
          <div style={{display:"flex",gap:20,marginTop:12,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:C.sub}}><strong style={{color:C.warn}}>{s.switches}</strong> off-tab switches</span>
            <span style={{fontSize:12,color:C.sub}}>Focus: <strong style={{color:C.accent}}>{100-idlePct}%</strong></span>
            <span style={{fontSize:12,color:C.sub}}>Shared: <strong style={{color:s.shared?C.accent:C.muted}}>{s.shared?"Yes":"No"}</strong></span>
          </div>

          {/* Registered tabs used */}
          {s.registeredTabs?.length > 0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Project tabs registered</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {s.registeredTabs.map((t,i)=>(
                  <span key={i} style={{fontSize:11,fontWeight:500,padding:"2px 9px",borderRadius:99,background:C.accentLight,color:C.accent,border:`1px solid ${C.accentBorder}`}}>
                    {t.domain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Off-tab log */}
          {s.offTabEvents?.length > 0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Off-tab log</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {s.offTabEvents.map((e,i)=>(
                  <span key={i} style={{fontSize:11,padding:"2px 9px",borderRadius:99,background:C.warnLight,color:C.warn,border:`1px solid ${C.warnBorder}`}}>
                    {e.domain} · {Math.round(e.durationSec/60)}m
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Adjustment reason */}
          {s.adjustReason&&(
            <div style={{marginTop:10,fontSize:12,color:C.warn,background:C.warnLight,padding:"7px 12px",borderRadius:8,border:`1px solid ${C.warnBorder}`}}>
              Adjustment reason: {s.adjustReason}
            </div>
          )}

          {/* Actions */}
          <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            <button style={btn("ghost",  {padding:"7px 14px",fontSize:12})} onClick={()=>onExport(s)}>Export PDF</button>
            <button style={btn("accent", {padding:"7px 14px",fontSize:12})} onClick={()=>onInvoice(s)}>Generate invoice</button>
            <button style={btn("ghost",  {padding:"7px 14px",fontSize:12})} onClick={()=>onAdjust(s)}>Adjust time</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIMER PANEL
═══════════════════════════════════════════════════════════════════════════ */
function TimerPanel({running,elapsed,onToggle,task,setTask}){
  return(
    <div style={{...card,border:running?`1.5px solid ${C.accentBorder}`:`1px solid ${C.border}`,background:running?"#F2FAF6":C.surface,transition:"all .3s"}}>
      <div style={LBL}>Current session</div>
      <input value={task} onChange={e=>setTask(e.target.value)} placeholder="What are you working on?"
        style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${C.borderLight}`,outline:"none",fontSize:17,fontWeight:500,color:C.text,paddingBottom:10,marginBottom:20,fontFamily:"inherit",boxSizing:"border-box"}}/>
      <div style={{fontSize:46,fontWeight:600,letterSpacing:"-0.04em",color:running?C.accent:C.text,lineHeight:1,marginBottom:20,transition:"color .3s",fontVariantNumeric:"tabular-nums"}}>
        {fmt(elapsed)}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onToggle} style={btn(running?"danger":"primary",{padding:"10px 26px"})}>
          {running?"Stop":"Start timer"}
        </button>
        {running&&(
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            {[12,18,14,20,16].map((h,i)=>(
              <div key={i} style={{width:3,height:h,background:C.accent,borderRadius:2,opacity:.55,animation:`wr-pulse ${.5+i*.1}s ease-in-out infinite alternate`}}/>
            ))}
            <span style={{fontSize:12,color:C.accent,fontWeight:500,marginLeft:8}}>Recording</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS METRICS ROW (from spec §8)
═══════════════════════════════════════════════════════════════════════════ */
function AnalyticsMetrics({sessions}){
  const dur = s => s.verifiedSec ?? s.duration ?? 0;
  const idlePct = s => s.idlePct ?? s.idle ?? 0;
  const totalDur  = sessions.reduce((a,s)=>a+dur(s),0);
  const avgSession= sessions.length ? totalDur/sessions.length : 0;
  const focusSess = sessions.filter(s=>idlePct(s)<10).length;
  const focusRatio= pct(focusSess,sessions.length);
  const approved  = sessions.filter(s=>s.approved).length;
  const approvalR = pct(approved,sessions.filter(s=>s.shared).length||1);
  const revPerHr  = 95; // avg rate
  const metrics=[
    {label:"Avg session duration", value:fmt(Math.round(avgSession)), sub:"per session"},
    {label:"Weekly focus ratio",   value:`${focusRatio}%`,           sub:"sessions with <10% idle"},
    {label:"Client approval rate", value:`${approvalR}%`,            sub:`${approved} of ${sessions.filter(s=>s.shared).length} shared approved`},
    {label:"Revenue per tracked hr",value:`$${revPerHr}`,            sub:"based on current rate"},
  ];
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      {metrics.map(m=>(
        <div key={m.label} style={{...card,padding:"18px 20px"}}>
          <div style={LBL}>{m.label}</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:"-0.03em",lineHeight:1}}>{m.value}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ── ROLE VIEWS ──
═══════════════════════════════════════════════════════════════════════════ */

/* CLIENT DASHBOARD — hiring view; no dummy data. Clients from shared sessions. */
function ClientDashboard({sessions,milestones,onApprove,onToast}){
  const sharedClients = [...new Set(sessions.filter(s=>s.shared).map(s=>s.client).filter(Boolean))].sort();
  const [activeClient,setActiveClient]=useState(sharedClients[0]||"");
  const mySessions=sessions.filter(s=>s.shared&&s.client===activeClient);
  const myMilestones=milestones.filter(m=>m.client===activeClient);
  const pending=mySessions.filter(s=>!s.approved);
  const totalHrs=mySessions.reduce((a,s)=>a+(s.verifiedSec??s.duration??0),0);
  const avgWqi=mySessions.length?Math.round(mySessions.reduce((a,s)=>a+(s.wqi??0),0)/mySessions.length):0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Client View</h1>
          <p style={{fontSize:13,color:C.sub,marginTop:5}}>Sessions shared with you. Approve time or hire freelancers.</p>
        </div>
        {sharedClients.length>0&&(
          <select value={activeClient} onChange={e=>setActiveClient(e.target.value)} style={{...inp,width:"auto",minWidth:160}}>
            {sharedClients.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{display:"flex",gap:8,padding:"7px 14px",borderRadius:10,background:C.accentLight,border:`1px solid ${C.accentBorder}`,alignItems:"center"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.accent}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.accent}}>Transparency verified</span>
        </div>
      </div>

      {sharedClients.length===0 && (
        <div style={{...card,textAlign:"center",padding:40,color:C.muted}}>
          <p style={{fontSize:14,marginBottom:8}}>No sessions shared with you yet.</p>
          <p style={{fontSize:13}}>When freelancers share sessions with you, they will appear here for approval.</p>
        </div>
      )}

      {/* Summary stats */}
      {sharedClients.length>0 && (
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {l:"Total hours",v:`${fmtHr(totalHrs)}h`,n:"This month"},
          {l:"Sessions shared",v:mySessions.length,n:`${pending.length} pending approval`},
          {l:"Avg WQI",v:avgWqi,n:wqiLabel(avgWqi)},
          {l:"Pending approval",v:pending.length,n:"sessions awaiting review"},
        ].map(m=>(
          <div key={m.l} style={{...card,padding:"18px 22px"}}>
            <div style={LBL}>{m.l}</div>
            <div style={{fontSize:26,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>{m.v}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:5}}>{m.n}</div>
          </div>
        ))}
      </div>
      )}

      {/* Pending approvals */}
      {sharedClients.length>0 && pending.length>0&&(
        <div style={{...card,border:`1px solid ${C.warnBorder}`,background:C.warnLight}}>
          <div style={{...LBL,color:C.warn}}>Pending your approval</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pending.map(s=>(
              <div key={s.id} style={{background:C.surface,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.text}}>{s.task}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:2}}>{s.date} · {s.start}–{s.end} · {fmtHr(s.duration)}h · WQI {s.wqi}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={btn("ghost",{padding:"6px 14px",fontSize:12})} onClick={()=>onToast("Session rejected","warn")}>Reject</button>
                  <button style={btn("primary",{padding:"6px 14px",fontSize:12})} onClick={()=>{onApprove(s.id);onToast(`"${s.task}" approved`);}}>Approve hours</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones — only when we have milestone data from API later */}
      {myMilestones.length>0&&(
      <div style={{...card}}>
        <div style={LBL}>Milestone progress</div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {myMilestones.map(m=>(
            <div key={m.id}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <div>
                  <span style={{fontSize:14,fontWeight:500,color:C.text}}>{m.title}</span>
                  <span style={{fontSize:12,color:C.muted,marginLeft:10}}>Due {m.due}</span>
                </div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:13,fontWeight:600,color:wqiColor(m.progress+10)}}>{m.progress}%</span>
                  <span style={{fontSize:12,color:C.muted,marginLeft:8}}>{m.hours}h · ${m.budget.toLocaleString()} budget</span>
                </div>
              </div>
              <ProgressBar value={m.progress} color={wqiColor(m.progress+10)}/>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Shared sessions (read-only) */}
      {sharedClients.length>0 && (
      <div>
        <div style={LBL}>Shared sessions</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {mySessions.map(s=>(
            <div key={s.id} style={{...card,padding:"14px 20px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:wqiColor(s.wqi),flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:C.text}}>{s.task}</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>{s.date} · {s.start}–{s.end}</div>
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.text}}>{fmtHr(s.duration)}h</div>
                  <div style={{fontSize:10,color:C.muted}}>tracked</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:600,color:wqiColor(s.wqi)}}>{s.wqi}</div>
                  <div style={{fontSize:10,color:C.muted}}>WQI</div>
                </div>
                {s.approved
                  ?<span style={{fontSize:11,color:C.accent,fontWeight:600,background:C.accentLight,padding:"3px 10px",borderRadius:99,border:`1px solid ${C.accentBorder}`,display:"inline-flex",alignItems:"center",gap:4}}><span style={{display:"flex"}}>{Icon.check(10)}</span> Approved</span>
                  :<span style={{fontSize:11,color:C.warn,fontWeight:600,background:C.warnLight,padding:"3px 10px",borderRadius:99,border:`1px solid ${C.warnBorder}`}}>Pending</span>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

/* ADMIN DASHBOARD — not shown to users; separate admin app */
function AdminDashboard({sessions,onToast}){
  const [weights,setWeights]=useState({focus:0.45,output:0.30,consistency:0.25});
  const [users,setUsers]=useState(ADMIN_USERS);
  const total=weights.focus+weights.output+weights.consistency;
  const setW=(k,v)=>setWeights(w=>({...w,[k]:+v}));
  const toggleUser=(id)=>{
    setUsers(us=>us.map(u=>u.id===id?{...u,status:u.status==="active"?"suspended":"active"}:u));
    onToast("User status updated");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Admin Panel</h1>
        <p style={{fontSize:13,color:C.sub,marginTop:5}}>Manage users · Adjust WQI weights · Monitor platform</p>
      </div>

      {/* Platform stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {l:"Total users",    v:ADMIN_USERS.length, n:`${ADMIN_USERS.filter(u=>u.status==="active").length} active`},
          {l:"Total sessions", v:sessions.length,    n:"across all users"},
          {l:"Pro subscribers",v:ADMIN_USERS.filter(u=>u.plan==="Pro").length, n:"+ 1 Agency"},
          {l:"Platform revenue",v:"$35,740",          n:"MTD February"},
        ].map(m=>(
          <div key={m.l} style={{...card,padding:"18px 22px"}}>
            <div style={LBL}>{m.l}</div>
            <div style={{fontSize:26,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>{m.v}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:5}}>{m.n}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* WQI weight editor */}
        <div style={{...card}}>
          <div style={LBL}>WQI Formula weights</div>
          <div style={{fontSize:12,color:C.sub,marginBottom:18}}>Weights must add up to 1.00. Current sum: <strong style={{color:Math.abs(total-1)<.01?C.accent:C.danger}}>{total.toFixed(2)}</strong></div>
          {[
            {k:"focus",label:"Focus time ratio"},
            {k:"output",label:"Output signal weight"},
            {k:"consistency",label:"Consistency score"},
          ].map(f=>(
            <div key={f.k} style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:500,color:C.text}}>{f.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.accent}}>{weights[f.k].toFixed(2)}</span>
              </div>
              <input type="range" min={0.05} max={0.70} step={0.01} value={weights[f.k]}
                onChange={e=>setW(f.k,e.target.value)}
                style={{width:"100%",accentColor:C.accent}}/>
            </div>
          ))}
          <button style={btn("primary",{width:"100%"})} onClick={()=>onToast("WQI weights updated platform-wide")}>
            Save weights
          </button>
        </div>

        {/* User management */}
        <div style={{...card}}>
          <div style={LBL}>User management</div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {users.map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#0D5535)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,flexShrink:0}}>
                  {u.name.charAt(0)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.text}}>{u.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{u.email} · {u.plan}</div>
                </div>
                <div style={{textAlign:"right",marginRight:10}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.text}}>{u.sessions} sessions</div>
                  {u.revenue>0&&<div style={{fontSize:11,color:C.muted}}>${u.revenue.toLocaleString()}</div>}
                </div>
                <button onClick={()=>toggleUser(u.id)}
                  style={btn(u.status==="active"?"ghost":"danger",{padding:"5px 12px",fontSize:11})}>
                  {u.status==="active"?"Suspend":"Reactivate"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing overview */}
      <div style={{...card}}>
        <div style={LBL}>Billing — subscription tiers</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            {name:"Free",users:1,revenue:"$0",color:C.muted},
            {name:"Pro ($19/mo)",users:2,revenue:"$38/mo",color:C.accent},
            {name:"Agency ($49/mo)",users:1,revenue:"$49/mo",color:C.purple},
          ].map(t=>(
            <div key={t.name} style={{background:C.bg,borderRadius:10,padding:"16px",border:`1px solid ${C.borderLight}`}}>
              <div style={{fontSize:13,fontWeight:600,color:t.color,marginBottom:6}}>{t.name}</div>
              <div style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:"-0.03em"}}>{t.users}</div>
              <div style={{fontSize:12,color:C.sub,marginTop:2}}>users · {t.revenue}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════ */
const ROLE_NAVS = {
  freelancer:[{id:"dashboard",label:"Overview"},{id:"sessions",label:"Sessions"},{id:"heatmap",label:"Heatmap"},{id:"analytics",label:"Analytics"},{id:"badges",label:"Badges"}],
  client:    [{id:"client",label:"Client view"}],
};

export default function WorkRate({
  initialSessions = [],
  serverStats     = null,
  serverClients   = [],
  currentUser     = null,
  onAddSession    = null,
  onApproveSession= null,
  onAdjustSession = null,
  onLogout        = null,
  onRefresh       = null,
  onUpdateProfile = null,
  onLookupClients = null,
}){
  /* ── Role switcher ── */
  const [role,setRole]   = useState("freelancer");

  /* ── Tab ── */
  const [tab,setTab]     = useState("dashboard");

  /* ── Deep-link from Chrome Extension ──────────────────────────────────────
   * Extension opens: workrate.io/dashboard#session-{id}
   * On mount + hashchange: switch to Sessions tab, highlight + scroll to session.
   * ────────────────────────────────────────────────────────────────────────*/
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#session-(\d+)$/);
      if (match) {
        const id = parseInt(match[1], 10);
        setRole("freelancer");
        setTab("sessions");
        setFilter("All time");  // ensure session isn't hidden by active filter
        setHighlightId(id);
        setTimeout(() => { setHighlightId(null); window.history.replaceState(null,"",window.location.pathname); }, 4000);
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  /* ── Timer ── */
  const [running,setRunning] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [task,setTask]       = useState("");
  const iv = useRef(null);
  useEffect(()=>{
    if(running) iv.current=setInterval(()=>setElapsed(e=>e+1),1000);
    else clearInterval(iv.current);
    return()=>clearInterval(iv.current);
  },[running]);

  /* ── Deep work ── */
  const [deepWork,setDeepWork]=useState(false);

  /* ── Sessions ── */
  // Clean slate: only API data. New users see empty dashboard; no dummy data.
  const [sessions,setSessions]=useState(initialSessions ?? []);

  useEffect(() => {
    setSessions(prev => Array.isArray(initialSessions) ? initialSessions : prev);
  }, [initialSessions]);
  const [filter,setFilter]   =useState("All time");
  // Build client filter list from API clients + unique session clients
  const clientNamesFromApi = (serverClients ?? []).map(c => (typeof c === "string" ? c : c?.name)).filter(Boolean);
  const clientNamesFromSessions = [...new Set(sessions.map(s => s.client).filter(Boolean))];
  const allClientNames = [...new Set([...clientNamesFromApi, ...clientNamesFromSessions])].sort();
  const FILTERS = ["All time", "Today", "This week", ...allClientNames];
  const weekAgo = Date.now() - 7 * 86400000;
  const filtered = sessions.filter(s => {
    if (filter === "All time") return true;
    if (filter === "Today") return s.date === "Today" || (s.sessionStart && new Date(s.sessionStart).toDateString() === new Date().toDateString());
    if (filter === "This week") return s.date === "Today" || s.date === "Yesterday" || (s.sessionStart && new Date(s.sessionStart) >= weekAgo);
    return s.client === filter;
  });

  /* ── Modals ── */
  const [modal,setModal]       = useState(null);
  const [modalTarget,setModalTarget] = useState(null);
  const [aiSummary,setAiSummary]     = useState(null);
  const closeModal=()=>{setModal(null);setModalTarget(null);};

  /* ── Toast ── */
  const [toast,setToast]=useState(null);
  const showToast=(msg,type="success")=>setToast({msg,type});

  /* ── Timer stop → AI summary ── */
  const toggleTimer=()=>{
    if(running){
      const summary=generateAISummary(task||"Untitled session",elapsed,Math.min(97,84+Math.floor(elapsed/90)),rand(2,8),rand(4,18),sessions[0]?.client||"Client");
      setAiSummary(summary);
      setModal("aiSummary");
      setElapsed(0);
    }
    setRunning(r=>!r);
  };

  const liveWqi = running?Math.min(97,84+Math.floor(elapsed/90)):84;

  /* ── Session actions ── */
  const addSession=async(s)=>{
    if(onAddSession){
      const saved = await onAddSession(s);
      if(saved) setSessions(p=>[saved,...p.filter(x=>x.id!==saved.id)]);
    } else {
      setSessions(p=>[s,...p]);
    }
    showToast("Session saved");
  };
  const approveSession=(id)=>{
    setSessions(p=>p.map(s=>s.id===id?{...s,approved:true}:s)); // optimistic
    if(onApproveSession) onApproveSession(id).catch(()=>{}); // sync to server
  };
  const adjustSession=(updated)=>{
    setSessions(p=>p.map(s=>s.id===updated.id?updated:s)); // optimistic
    if(onAdjustSession) onAdjustSession(updated).catch(()=>{}); // sync to server
  };

  /* ── Role switch: freelancer vs client only (admin is separate app). Clear confirmation when switching to client. ── */
  const [clientModeConfirmed, setClientModeConfirmed] = useState(false);
  const switchRole=(r)=>{
    if (r === "client") setClientModeConfirmed(true);
    setRole(r);
    if(r==="freelancer") setTab("dashboard");
    if(r==="client")     setTab("client");
  };

  /* ── Copy proof link ── */
  const copyLink=()=>{
    navigator.clipboard.writeText("https://workrate.io/proof/alex-feb23")
      .then(()=>showToast("Proof link copied!"))
      .catch(()=>showToast("Copy failed","error"));
  };

  const navItems=ROLE_NAVS[role];

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Satoshi','Inter',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes wr-pulse{from{transform:scaleY(.6);opacity:.3}to{transform:scaleY(1.3);opacity:.8}}
        @keyframes wr-blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes wr-slidein{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
        input::placeholder,textarea::placeholder{color:${C.muted};}
        ::-webkit-scrollbar{width:4px;background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}
        button:active{opacity:.75;}
        select{appearance:auto;}
        input[type=range]{cursor:pointer;}
      `}</style>

      {/* ── Toasts ── */}
      {toast&&<Toast message={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* ── Modals ── */}
      {modal==="aiSummary"  && aiSummary && <AISummaryModal summary={aiSummary} task={task} onClose={closeModal} onInvoice={()=>{setModalTarget(sessions[0]);setModal("invoice");}} onSave={()=>{addSession({id:Date.now(),date:"Today",task:task||"Untitled session",start:"—",end:"—",duration:aiSummary.total*3600,wqi:aiSummary.wqi,switches:aiSummary.switches,idle:aiSummary.idleRatio,tags:[],client:"Volta Studio",approved:false,shared:false});setTask("");}}/>}
      {modal==="newSession" && <NewSessionModal onClose={closeModal} onSave={addSession} clients={serverClients ?? []} onLookupClients={onLookupClients}/>}
      {modal==="invoice"    && modalTarget && <InvoiceModal session={modalTarget} onClose={closeModal} onToast={showToast} currentUser={currentUser}/>}
      {modal==="export"     && modalTarget && <ExportModal  session={modalTarget} onClose={closeModal} onToast={showToast}/>}
      {modal==="adjust"     && modalTarget && <AdjustTimeModal session={modalTarget} onClose={closeModal} onSave={adjustSession} onToast={showToast}/>}
      {modal==="profile"    && <ProfileDrawer onClose={closeModal} onToast={showToast} currentUser={currentUser} onLogout={onLogout} role={role} onUpdateProfile={onUpdateProfile}/>}
      {modal==="deepWork"   && <DeepWorkModal active={deepWork} onToggle={()=>setDeepWork(d=>!d)} onClose={closeModal}/>}
      {modal==="subscription"&&<SubscriptionModal onClose={closeModal} onToast={showToast}/>}

      {/* ────────── HEADER ────────── */}
      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(247,246,243,.9)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.border}`,height:54,display:"flex",alignItems:"center",padding:"0 32px",gap:28}}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{width:26,height:26,borderRadius:7,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
              <rect x={1} y={6} width={2} height={7} rx={1} fill="white" opacity={.65}/>
              <rect x={4.5} y={3} width={2} height={10} rx={1} fill="white" opacity={.8}/>
              <rect x={8} y={1} width={2} height={12} rx={1} fill="white"/>
              <rect x={11.5} y={4} width={2} height={9} rx={1} fill="white" opacity={.7}/>
            </svg>
          </div>
          <span style={{fontSize:15,fontWeight:700,letterSpacing:"-0.02em",color:C.text}}>WorkRate</span>
        </div>

        {/* Role switcher: Freelancer | Client (admin is separate; not shown to users) */}
        <div style={{display:"flex",gap:2,background:C.borderLight,borderRadius:9,padding:3}}>
          {[["freelancer","Freelancer"],["client","Client"]].map(([r,l])=>(
            <button key={r} onClick={()=>switchRole(r)}
              style={{padding:"4px 12px",borderRadius:7,border:"none",fontSize:12,fontWeight:role===r?600:400,
                background:role===r?C.surface:"transparent",
                color:role===r?C.text:C.muted,
                cursor:"pointer",fontFamily:"inherit",
                boxShadow:role===r?"0 1px 3px rgba(0,0,0,.08)":"none",
                transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* Nav tabs */}
        <nav style={{display:"flex",gap:2,flex:1}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{padding:"5px 13px",borderRadius:8,border:"none",background:tab===n.id?C.accentLight:"transparent",
                color:tab===n.id?C.accent:C.sub,fontSize:13,fontWeight:tab===n.id?600:400,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-0.01em"}}>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {role==="freelancer"&&(
            <>
              <button onClick={()=>setModal("deepWork")}
                style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${deepWork?C.purpleBorder:C.border}`,background:deepWork?C.purpleLight:"transparent",color:deepWork?C.purple:C.sub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                {deepWork?"◈ Deep work on":"◈ Deep work"}
              </button>
              <button onClick={()=>setModal("subscription")}
                style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.sub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
                Pro ↑
              </button>
            </>
          )}
          {running&&(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:8,background:C.accentLight,border:`1px solid ${C.accentBorder}`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.accent,animation:"wr-blink 1.4s infinite"}}/>
              <span style={{fontSize:13,fontWeight:600,color:C.accent,fontVariantNumeric:"tabular-nums"}}>{fmt(elapsed)}</span>
            </div>
          )}
          {onRefresh&&(
            <button onClick={onRefresh} title="Refresh data" style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.sub,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>↻ Refresh</button>
          )}
          <div onClick={()=>setModal("profile")}
            style={{width:30,height:30,borderRadius:"50%",background:currentUser?.avatar_url ? `url(${currentUser.avatar_url}) center/cover` : `linear-gradient(135deg,${C.accent},#0D5535)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {!currentUser?.avatar_url && (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : (currentUser?.email?.charAt(0) || "?").toUpperCase())}
          </div>
        </div>
      </header>

      {/* ────────── MAIN ────────── */}
      <main style={{maxWidth:1060,margin:"0 auto",padding:"32px 36px"}}>

        {/* Client mode banner: make it clear they switched context */}
        {role==="client"&&(
          <div style={{background:C.accentLight,border:`1px solid ${C.accentBorder}`,borderRadius:12,padding:"12px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <span style={{color:C.accent,display:"flex",alignItems:"center"}}>{Icon.handshake(20)}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>Viewing as Client</div>
              <div style={{fontSize:12,color:C.sub,marginTop:2}}>Sessions shared with you appear here. Approve time or hire freelancers from this view.</div>
            </div>
          </div>
        )}

        {/* CLIENT VIEW */}
        {tab==="client"&&<ClientDashboard sessions={sessions} milestones={[]} onApprove={approveSession} onToast={showToast}/>}

        {/* ══ FREELANCER: OVERVIEW ══ */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            {(()=>{
              const todaySec = serverStats?.todayVerifiedSec ?? sessions.filter(s=>s.date==="Today"||(s.sessionStart&&new Date(s.sessionStart).toDateString()===new Date().toDateString())).reduce((a,s)=>a+(s.verifiedSec??s.duration??0),0);
              const weekSec = serverStats?.weekVerifiedSec ?? sessions.filter(s=>s.date==="Today"||s.date==="Yesterday"||(s.sessionStart&&new Date(s.sessionStart)>=weekAgo)).reduce((a,s)=>a+(s.verifiedSec??s.duration??0),0);
              const avgWqi = serverStats?.avgWqi ?? (sessions.length ? Math.round(sessions.reduce((a,s)=>a+(s.wqi??0),0)/sessions.length) : 0);
              const activeDays = serverStats?.activeDays ?? 0;
              const greeting = (()=>{ const h=new Date().getHours(); return h<12?"Good morning":h<18?"Good afternoon":"Good evening"; })();
              const userName = currentUser?.name || currentUser?.email?.split("@")[0] || "there";
              const dateLine = new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}) + (activeDays ? ` · ${activeDays} active day${activeDays!==1?"s":""}` : "");
              return (
            <>
            <div>
              <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>{greeting}, {userName}</h1>
              <p style={{fontSize:13,color:C.sub,marginTop:5}}>{dateLine}</p>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[
                {l:"Today",v:`${fmtHr(todaySec)}h`,n:sessions.length?"Verified time":"Add sessions to see stats",onClick:()=>{setFilter("Today");setTab("sessions");}},
                {l:"This week",v:`${fmtHr(weekSec)}h`,n:sessions.length?"Last 7 days":"—",onClick:()=>{setFilter("This week");setTab("sessions");}},
                {l:"Avg WQI",v:avgWqi?String(avgWqi):"—",n:avgWqi?wqiLabel(avgWqi):"—",onClick:()=>setTab("analytics")},
                {l:"Active days",v:activeDays?String(activeDays):"—",n:"Days with sessions",onClick:()=>setTab("badges")},
              ].map(m=>(
                <div key={m.l} onClick={m.onClick} style={{...card,padding:"18px 22px",cursor:"pointer",transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentBorder}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <div style={LBL}>{m.l}</div>
                  <div style={{fontSize:26,fontWeight:600,letterSpacing:"-0.03em",color:C.text,lineHeight:1.1}}>{m.v}</div>
                  <div style={{fontSize:12,color:C.accent,fontWeight:500,marginTop:6}}>{m.n}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 172px",gap:14}}>
              <TimerPanel running={running} elapsed={elapsed} onToggle={toggleTimer} task={task} setTask={setTask}/>
              <div style={{...card,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={LBL}>Session score</div>
                <WQIRing score={liveWqi}/>
                <p style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:10,lineHeight:1.6}}>Focus · Consistency<br/>Output signal</p>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {/* Weekly bars + earnings */}
              <div style={{...card,cursor:"pointer"}}
                onClick={()=>setTab("analytics")}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentBorder}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={LBL}>Earnings projection</div>
                <EarningsChart/>
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.borderLight}`,display:"flex",gap:20}}>
                  {[["Feb earned","$8,240",C.text],["Mar projection","$9,100",C.accent],["Apr projection","$9,800",C.muted]].map(([l,v,c])=>(
                    <div key={l}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:500}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:600,color:c,letterSpacing:"-0.02em",marginTop:2}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chrome extension — link and upload */}
              <div style={{...card,border:`1px solid ${C.accentBorder}`,background:C.accentLight}}>
                <div style={LBL}>Chrome extension</div>
                <p style={{fontSize:13,color:C.sub,lineHeight:1.5,marginBottom:12}}>Track time in the browser. Sessions sync here automatically. Install the WorkRate extension to record verified time and upload activity.</p>
                <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer" style={{...btn("accent",{display:"inline-flex",alignItems:"center",gap:6,textDecoration:"none"})}}>
                  {Icon.doc(16)} Connect extension
                </a>
              </div>

              {/* Recent sessions */}
              <div style={{...card}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={LBL}>Recent sessions</div>
                  <button onClick={()=>setTab("sessions")} style={{fontSize:12,fontWeight:600,color:C.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>View all</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sessions.length===0 ? (
                    <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:13}}>No sessions yet. Add one manually or use the Chrome extension to track time.</div>
                  ) : sessions.slice(0,3).map(s=>(
                    <div key={s.id} onClick={()=>setTab("sessions")}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:9,background:C.bg,border:`1px solid ${C.borderLight}`,cursor:"pointer",transition:"border-color .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentBorder}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.borderLight}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:wqiColor(s.wqi),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.task}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:1}}>{s.date} · {s.client}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{fmtHr(s.verifiedSec??s.duration)}h</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
          );
          })()}
          </div>
        )}

        {/* ══ FREELANCER: SESSIONS ══ */}
        {tab==="sessions"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div>
                <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Sessions</h1>
                <p style={{fontSize:13,color:C.sub,marginTop:5}}>Verified, timestamped work history</p>
              </div>
              <button style={btn("primary")} onClick={()=>setModal("newSession")}>+ New session</button>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {FILTERS.map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${filter===f?C.accentBorder:C.border}`,background:filter===f?C.accentLight:"transparent",color:filter===f?C.accent:C.sub,fontSize:12,fontWeight:filter===f?600:400,cursor:"pointer",fontFamily:"inherit"}}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,color:C.muted}}>{filtered.length} session{filtered.length!==1?"s":""}{filter!=="All time"?` · ${filter}`:""}</div>
            {filtered.length===0
              ?<div style={{...card,textAlign:"center",color:C.muted,padding:48}}>No sessions match this filter.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filtered.map(s=>(
                  <SessionRow key={s.id} s={s}
                    highlighted={highlightId === s.id}
                    onInvoice={s=>{setModalTarget(s);setModal("invoice");}}
                    onExport={s=>{setModalTarget(s);setModal("export");}}
                    onAdjust={s=>{setModalTarget(s);setModal("adjust");}}
                  />
                ))}
              </div>
            }
          </div>
        )}

        {/* ══ FREELANCER: HEATMAP ══ */}
        {tab==="heatmap"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div>
              <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Activity Heatmap</h1>
              <p style={{fontSize:13,color:C.sub,marginTop:5}}>5-minute blocks. Track time with the Chrome extension to see activity here.</p>
            </div>
            {sessions.length===0 ? (
              <div style={{...card,textAlign:"center",padding:48,color:C.muted}}>
                <p style={{fontSize:14,marginBottom:12}}>No activity data yet.</p>
                <p style={{fontSize:13}}>Install the WorkRate Chrome extension and track a session to see your heatmap.</p>
              </div>
            ) : (
            <>
            <div style={card}><Heatmap data={HEATMAP}/></div>

            {/* Context switch graph */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={card}>
                <div style={LBL}>Context switching frequency</div>
                <ContextSwitchGraph sessions={sessions}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignContent:"start"}}>
                {[
                  {lbl:"Peak focus hour", val:"10:00–11:00",note:"Highest avg intensity",color:C.accent,onClick:null},
                  {lbl:"Deep work blocks",val:"4 sessions",note:"45+ min uninterrupted",color:C.purple,onClick:()=>setModal("deepWork")},
                  {lbl:"Idle time today", val:"1h 12m",    note:"14% of tracked time", color:C.danger,onClick:null},
                  {lbl:"Avg focus/day",   val:"86%",        note:"Last 7 days",         color:C.accent,onClick:()=>setTab("analytics")},
                ].map(item=>(
                  <div key={item.lbl} style={{...card,cursor:item.onClick?"pointer":"default",padding:"16px 18px"}}
                    onClick={item.onClick||undefined}
                    onMouseEnter={e=>{if(item.onClick)e.currentTarget.style.borderColor=C.accentBorder;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
                    <div style={LBL}>{item.lbl}</div>
                    <div style={{fontSize:18,fontWeight:600,color:item.color,letterSpacing:"-0.02em"}}>{item.val}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:4}}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* ══ FREELANCER: ANALYTICS ══ */}
        {tab==="analytics"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div>
              <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Analytics</h1>
              <p style={{fontSize:13,color:C.sub,marginTop:5}}>WQI trends · Revenue · Proof score · Platform metrics</p>
            </div>

            {/* 4 analytics metrics from spec §8 */}
            <AnalyticsMetrics sessions={sessions}/>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {/* WQI trend */}
              <div style={card}>
                <div style={LBL}>WQI trend — 8 weeks</div>
                <WQITrendChart data={WQI_HISTORY}/>
                <div style={{marginTop:14,display:"flex",gap:16}}>
                  {[["Start","74",C.warn],["Now","87",C.accent],["Δ","+13",C.accent]].map(([l,v,c])=>(
                    <div key={l}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:500}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:600,color:c,letterSpacing:"-0.02em"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WQI formula */}
              <div style={card}>
                <div style={LBL}>WQI formula breakdown</div>
                <div style={{fontSize:32,fontWeight:700,color:C.accent,letterSpacing:"-0.04em",marginBottom:4}}>84</div>
                <div style={{fontSize:12,color:C.sub,marginBottom:18}}>Focus × Output × Consistency</div>
                {[
                  {name:"Focus time ratio",   v:.82,color:C.accent},
                  {name:"Output signal weight",v:.76,color:C.purple},
                  {name:"Consistency score",   v:.91,color:C.warn},
                ].map(m=>(
                  <div key={m.name} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:C.text}}>{m.name}</span>
                      <span style={{fontSize:13,fontWeight:600,color:m.color}}>{(m.v*100).toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={m.v*100} color={m.color}/>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div style={card}>
                <div style={LBL}>Revenue · February</div>
                <div style={{fontSize:34,fontWeight:700,color:C.text,letterSpacing:"-0.04em"}}>$8,240</div>
                <div style={{fontSize:12,color:C.accent,fontWeight:600,marginTop:4,marginBottom:18}}>↑ 18% vs January</div>
                {[["Avg hourly rate","$95 / hr"],["Hours tracked","86.7 h"],["Pending approval","12.4 h"],["Client approval rate","97.2%"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${C.borderLight}`}}>
                    <span style={{fontSize:13,color:C.sub}}>{k}</span>
                    <span style={{fontSize:14,fontWeight:600,color:C.text}}>{v}</span>
                  </div>
                ))}
                <button onClick={()=>{setFilter("All time");setTab("sessions");}} style={{...btn("ghost",{width:"100%",marginTop:14,textAlign:"center"})}}>View session breakdown →</button>
              </div>

              {/* Proof score */}
              <div style={{...card,border:`1px solid ${C.accentBorder}`,background:C.accentLight}}>
                <div style={{...LBL,color:C.accent}}>Shareable proof score</div>
                <div style={{fontSize:14,fontWeight:500,color:C.text,marginBottom:6}}>
                  workrate.io/proof/<span style={{color:C.accent,fontWeight:600}}>alex-feb23</span>
                </div>
                <p style={{fontSize:12,color:C.sub,lineHeight:1.6,marginBottom:16}}>Share verified work quality with clients. No sensitive data exposed.</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                  {[["Verified Hours","Tracked time"],["WQI Score","Quality index"],["Context Integrity","Tab focus"],["Idle Transparency","Idle logged"]].map(([name,sub])=>(
                    <div key={name} style={{padding:"10px",borderRadius:9,background:C.surface,border:`1px solid ${C.accentBorder}`,textAlign:"center"}}>
                      <div style={{display:"flex",justifyContent:"center",marginBottom:4,color:C.accent}}>{Icon.check(16)}</div>
                      <div style={{fontSize:11,fontWeight:500,color:C.sub}}>{name}</div>
                      <div style={{fontSize:10,color:C.muted}}>{sub}</div>
                    </div>
                  ))}
                </div>
                <button style={btn("accent",{width:"100%"})} onClick={copyLink}>Copy proof link</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ FREELANCER: BADGES ══ */}
        {tab==="badges"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div>
              <h1 style={{fontSize:24,fontWeight:600,letterSpacing:"-0.03em",color:C.text}}>Badges & Streak</h1>
              <p style={{fontSize:13,color:C.sub,marginTop:5}}>Transparency achievements · Earned through consistent quality work</p>
            </div>

            {/* Streak */}
            <div style={card}><StreakTracker streak={12}/></div>

            {/* Badges */}
            <div style={card}>
              <div style={LBL}>Transparency badges</div>
              <BadgeGrid badges={BADGES}/>
            </div>

            {/* What earns badges */}
            <div style={{...card,background:C.accentLight,border:`1px solid ${C.accentBorder}`}}>
              <div style={{...LBL,color:C.accent}}>How badges work</div>
              <p style={{fontSize:13,color:C.sub,lineHeight:1.7}}>
                Badges are earned automatically based on your tracked behavior — not self-reported. They reflect real patterns like sustained focus, low idle time, and consistent output. Clients can see your earned badges on your Proof Score page, building trust without sharing raw session data.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
