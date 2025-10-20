import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import {
  Brain,
  LayoutDashboard,
  BookOpenText,
  Plus,
  Search,
  TrendingUp,
  Star,
  MessageSquare,
} from "lucide-react";
import Papa from "papaparse";

// Minimal UI elements (no shadcn) so it runs out of the box
function Btn({ children, onClick, disabled, className="" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg font-medium ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"} ${className}`}
    >
      {children}
    </button>
  );
}
function Card({ children }) { return <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl">{children}</div>}
function CardHeader({ children }) { return <div className="px-4 pt-4">{children}</div>}
function CardTitle({ children }) { return <div className="text-zinc-200 text-sm">{children}</div>}
function CardContent({ children }) { return <div className="px-4 pb-4">{children}</div>}
function Input(props){ return <input {...props} className={`px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 ${props.className||""}`} /> }
function Textarea(props){ return <textarea {...props} className={`px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 ${props.className||""}`} /> }
function Select({value,onChange,children,className}){
  return <select value={value} onChange={(e)=>onChange(e.target.value)} className={`px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 ${className||""}`}>{children}</select>
}
function Option({value,children}){ return <option value={value}>{children}</option> }

const ASPECTS = [
  "Service","Cleanliness","Location","Food","Price","Amenities","RoomComfort","StaffBehavior","Facilities",
];
const SENTIMENTS = ["positive", "neutral", "negative"];
const SENTIMENT_COLORS = { positive: "#22c55e", neutral: "#a3a3a3", negative: "#ef4444" };
const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// Mock data
const MOCK_LONG = [
  {review_id:"R0001",hotel_id:"H001",hotel_name:"Grand Nusantara Hotel",language:"id",review_date:"2024-10-15",rating:5,aspect:"Service",sentiment:"positive",confidence:0.92,review_text:"Pelayanan staf sangat ramah dan cepat. Kamar bersih, sarapan enak, lokasi strategis."},
  {review_id:"R0001",hotel_id:"H001",hotel_name:"Grand Nusantara Hotel",language:"id",review_date:"2024-10-15",rating:5,aspect:"Cleanliness",sentiment:"positive",confidence:0.9,review_text:"Pelayanan staf sangat ramah dan cepat. Kamar bersih, sarapan enak, lokasi strategis."},
  {review_id:"R0002",hotel_id:"H002",hotel_name:"Seaside Bay Resort",language:"en",review_date:"2024-11-20",rating:3,aspect:"Amenities",sentiment:"negative",confidence:0.78,review_text:"Pool was dirty and the gym was cramped. Breakfast was average."},
  {review_id:"R0003",hotel_id:"H003",hotel_name:"Mountain View Lodge",language:"en",review_date:"2025-01-08",rating:4,aspect:"Location",sentiment:"positive",confidence:0.86,review_text:"Great location near the trails; staff were helpful."},
];

function classNames(...c) { return c.filter(Boolean).join(" "); }
function titleCase(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Support wide CSV to long
function wideToLong(rows) {
  const out = [];
  for (const r of rows) {
    for (const a of ASPECTS) {
      const s = r[`aspect_${a}_sentiment`];
      const c = r[`aspect_${a}_confidence`];
      if (s && String(s).length > 0) {
        out.push({
          review_id: r.review_id || uuid(),
          hotel_id: r.hotel_id || "",
          hotel_name: r.hotel_name || "",
          language: r.language || "",
          review_date: r.review_date || "",
          rating: Number(r.rating || 0),
          aspect: a,
          sentiment: String(s).toLowerCase(),
          confidence: Number(c || 0),
          review_text: r.review_text || "",
        });
      }
    }
  }
  return out;
}

// Simple keyword extractor for explainability
const STOPWORDS = new Set("the a an and or to of in on at for dengan dan yang untuk di ke dari sangat sekali was were is are itu ini pada dekat lokasi nyaman bersih kotor".split(/\s+/));
function topKeywords(text, k = 6) {
  if (!text) return [];
  const freq = {};
  text.toLowerCase().replace(/[^a-zA-Z\u00C0-\u024F\s]/g, " ")
    .split(/\s+/).filter(w => w && !STOPWORDS.has(w) && w.length > 2)
    .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

function kpiFromData(longData) {
  const totalReviews = new Set(longData.map(d=>d.review_id)).size;
  const positive = longData.filter(d=>d.sentiment==="positive").length;
  const neutral = longData.filter(d=>d.sentiment==="neutral").length;
  const negative = longData.filter(d=>d.sentiment==="negative").length;
  const positiveRate = ((positive/(positive+neutral+negative||1))*100).toFixed(0);
  const rated = longData.filter(d=>Number(d.rating)>0);
  const avgRating = (rated.reduce((s,d)=>s+(Number(d.rating)||0),0)/(rated.length||1)).toFixed(1);
  return { totalReviews, positiveRate, avgRating };
}

function groupByAspectSentiment(longData) {
  const agg = {}; for (const a of ASPECTS) agg[a] = {positive:0, neutral:0, negative:0};
  longData.forEach(d=>{ if(!agg[d.aspect]) agg[d.aspect]={positive:0,neutral:0,negative:0}; if(SENTIMENTS.includes(d.sentiment)) agg[d.aspect][d.sentiment]+=1; });
  return Object.entries(agg).map(([aspect, counts]) => ({ aspect, ...counts }));
}

function aspectHeatmap(longData) {
  const byHotel = {};
  longData.forEach(d=>{
    const h = d.hotel_name || d.hotel_id || "Unknown";
    byHotel[h] = byHotel[h] || {};
    byHotel[h][d.aspect] = byHotel[h][d.aspect] || {pos:0,neg:0,tot:0};
    if(d.sentiment==="positive") byHotel[h][d.aspect].pos++;
    if(d.sentiment==="negative") byHotel[h][d.aspect].neg++;
    byHotel[h][d.aspect].tot++;
  });
  const hotels = Object.keys(byHotel);
  return hotels.map(h=>{
    const row={hotel:h};
    ASPECTS.forEach(a=>{
      const cell = byHotel[h][a];
      row[a] = (!cell||cell.tot===0) ? null : (cell.pos-cell.neg)/cell.tot;
    });
    return row;
  });
}
function colorForScore(v){ if(v===null||Number.isNaN(v)) return "bg-zinc-800/40 text-zinc-300"; const pct=(Number(v)+1)/2; const hue=Math.round(120*pct); return `text-white bg-[hsl(${hue}deg_70%_35%)]`; }

function useFilteredData(longData){
  const [hotel,setHotel]=useState("all"); const [sentFilter,setSentFilter]=useState("all");
  const [lang,setLang]=useState("all"); const [aspect,setAspect]=useState("all"); const [q,setQ]=useState("");
  const hotels = React.useMemo(()=>Array.from(new Set(longData.map(d=>d.hotel_name))).filter(Boolean),[longData]);
  const filtered = React.useMemo(()=> longData.filter(d=>{
    if(hotel!=="all" && d.hotel_name!==hotel) return false;
    if(sentFilter!=="all" && d.sentiment!==sentFilter) return false;
    if(lang!=="all" && d.language!==lang) return false;
    if(aspect!=="all" && d.aspect!==aspect) return false;
    if(q && !`${d.review_text} ${d.hotel_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }),[longData,hotel,sentFilter,lang,aspect,q]);
  return { filtered, controls:{hotel,setHotel,sentFilter,setSentFilter,lang,setLang,aspect,setAspect,q,setQ,hotels} };
}

function NavTab({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} className={classNames("flex items-center gap-2 px-4 py-2 rounded-xl border",
      active? "bg-indigo-500/20 border-indigo-400 text-indigo-200":"bg-zinc-800/40 border-zinc-700 text-zinc-300 hover:bg-zinc-700/40")}>
      <Icon size={18} /><span className="font-medium">{label}</span>
    </button>
  );
}

function KPICard({ title, value, subtitle, icon: Icon }){
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        <Icon className="text-indigo-300" size={18} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-zinc-100">{value}</div>
        {subtitle && <div className="text-zinc-400 text-xs mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function Section({title, subtitle, children}){
  return (
    <div className="bg-zinc-900/50 border border-zinc-700 rounded-2xl p-5">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-zinc-200 font-semibold">{title}</div>
            {subtitle && <div className="text-zinc-400 text-sm">{subtitle}</div>}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Heatmap({data}){
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-separate border-spacing-1">
        <thead><tr>
          <th className="text-left text-zinc-400 font-medium sticky left-0 bg-zinc-900/80 backdrop-blur px-2 py-1 rounded-md">Hotel</th>
          {ASPECTS.map(a=><th key={a} className="text-zinc-400 font-medium px-2 py-1">{a}</th>)}
        </tr></thead>
        <tbody>
          {data.map((row,idx)=>(
            <tr key={idx}>
              <td className="sticky left-0 bg-zinc-900/80 backdrop-blur px-2 py-1 rounded-md text-zinc-200">{row.hotel}</td>
              {ASPECTS.map(a=>(
                <td key={a} className="px-1 py-1">
                  <div className={classNames("rounded-md h-8 flex items-center justify-center text-xs", colorForScore(row[a]))} title={row[a]===null?"No data":Number(row[a]).toFixed(2)}>
                    {row[a]===null? "–" : Number(row[a]).toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SentiScopeApp(){
  const [tab,setTab]=useState("dashboard");
  const [longData,setLongData]=useState(MOCK_LONG);
  const [uploadInfo,setUploadInfo]=useState("Loaded mock data (you can upload CSV)");
  const [hybridRunning,setHybridRunning]=useState(false);
  const [hybridInfo,setHybridInfo]=useState("");

  const {filtered,controls}=useFilteredData(longData);
  const kpi = React.useMemo(()=>kpiFromData(filtered.length?filtered:longData),[filtered,longData]);
  const aspectAgg = React.useMemo(()=>groupByAspectSentiment(filtered),[filtered]);
  const sentimentsAgg = React.useMemo(()=>{
    const counts={positive:0,neutral:0,negative:0};
    (filtered.length?filtered:longData).forEach(d=>{counts[d.sentiment]+=1});
    return [{name:"Positive",value:counts.positive,key:"positive"},
            {name:"Neutral",value:counts.neutral,key:"neutral"},
            {name:"Negative",value:counts.negative,key:"negative"}];
  },[filtered,longData]);
  const heatmapData = React.useMemo(()=>aspectHeatmap(filtered.length?filtered:longData),[filtered,longData]);

  const handleFile=(file)=>{
    Papa.parse(file,{
      header:true, skipEmptyLines:true,
      complete:(results)=>{
        const rows=results.data||[];
        const hasLong = rows[0] && rows[0].aspect && rows[0].sentiment;
        const data = hasLong ? rows : wideToLong(rows);
        if(!data.length){ setUploadInfo("Failed to read rows from CSV"); }
        else { setLongData(data); setUploadInfo(`Loaded ${data.length} aspect-rows from ${file.name}`); }
      },
      error:()=>setUploadInfo("Failed to parse CSV"),
    });
  };

  // Hybrid analysis (simulated ensemble)
  const POS_WORDS=["bersih","ramah","cepat","strategis","enak","lezat","nyaman","bagus","rapi","clean","friendly","tasty","delicious","comfy","comfortable","great","helpful","convenient"];
  const NEG_WORDS=["kotor","lambat","berisik","bau","mahal","rusak","sempit","buruk","panas","dirty","slow","noisy","smelly","overpriced","broken","cramped","bad","hot"];
  function scoreText(t){ t=(t||"").toLowerCase(); const pos=POS_WORDS.reduce((s,w)=>s+(t.includes(w)?1:0),0); const neg=NEG_WORDS.reduce((s,w)=>s+(t.includes(w)?1:0),0); return {pos,neg}; }
  async function runHybridAnalysis(){
    setHybridRunning(true); setHybridInfo(""); await new Promise(r=>setTimeout(r,800));
    let changed=0;
    const updated = longData.map(d=>{
      const {pos,neg}=scoreText(d.review_text); const rating=Number(d.rating||0);
      let vote=0; if(pos>neg) vote+=1; else if(neg>pos) vote-=1; if(rating>=4) vote+=0.5; else if(rating<=2) vote-=0.5;
      let newSent = vote>0.25? "positive" : vote<-0.25? "negative" : "neutral";
      const evidence=Math.max(pos,neg);
      let conf=0.65 + Math.min(0.3, evidence*0.08) + (rating? (rating-3)*0.05 : 0);
      conf=Math.max(0.6, Math.min(0.98, conf));
      if(newSent!==d.sentiment || Math.abs((d.confidence||0)-conf)>0.05) changed++;
      return {...d, sentiment:newSent, confidence:Number(conf.toFixed(2))};
    });
    setLongData(updated); setHybridRunning(false); setHybridInfo(`Hybrid ensemble updated ${changed} aspect-rows.`);
  }

  // Add review
  const [form,setForm]=useState({hotel_name:"", user:"", rating:5, language:"id", review_text:"", aspects:ASPECTS.reduce((acc,a)=>({...acc,[a]:""}),{})});
  const addReview=()=>{
    const reviewId=uuid(); const date=new Date().toISOString().slice(0,10); const rows=[];
    Object.entries(form.aspects).forEach(([a,s])=>{ if(s){ rows.push({review_id:reviewId,hotel_id:"",hotel_name:form.hotel_name,language:form.language,review_date:date,rating:form.rating,aspect:a,sentiment:s,confidence:0.8,review_text:form.review_text}); }});
    if(rows.length){ setLongData(prev=>[...rows,...prev]); setTab("analysis"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1022] via-[#0e1530] to-[#0b1022] text-zinc-100">
      <header className="sticky top-0 z-20 backdrop-blur bg-[#0e1530]/70 border-b border-indigo-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-200">
            <Brain size={20} />
            <div>
              <div className="text-sm font-semibold">SentiScope</div>
              <div className="text-[10px] text-indigo-300/70">Aspect-Based Analysis</div>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <NavTab label="Dashboard" icon={LayoutDashboard} active={tab==="dashboard"} onClick={()=>setTab("dashboard")} />
            <NavTab label="Review Analysis" icon={BookOpenText} active={tab==="analysis"} onClick={()=>setTab("analysis")} />
            <NavTab label="Topic Modeling" icon={Brain} active={tab==="topics"} onClick={()=>setTab("topics")} />
            <NavTab label="Add Review" icon={Plus} active={tab==="add"} onClick={()=>setTab("add")} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-300 via-cyan-200 to-indigo-100 bg-clip-text text-transparent">Dashboard Analisis Sentimen</h1>
          <p className="mt-2 text-zinc-300/80">Analisis sentimen berbasis aspek untuk ulasan hotel dengan arsitektur AI hybrid</p>
        </div>

        <Section title="Upload / Load Data" subtitle={uploadInfo}>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <Input type="file" accept=".csv" onChange={(e)=>e.target.files && handleFile(e.target.files[0])} />
            <div className="text-xs text-zinc-400">Supports <b>long</b> format (aspect,sentiment,confidence,review_text,hotel_name,language,review_date,rating) or <b>wide</b> (aspect_*_sentiment & aspect_*_confidence).</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Btn onClick={runHybridAnalysis} disabled={hybridRunning} className="bg-indigo-600 text-white">
              {hybridRunning ? (<span className="inline-flex items-center gap-2"><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Running Hybrid Analysis…</span>) : ("Run Hybrid Analysis (GPT-5 + Claude + Gemini)")}
            </Btn>
            {hybridInfo && <div className="text-xs text-indigo-300 pt-2">{hybridInfo}</div>}
          </div>
        </Section>

        {tab==="dashboard" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <KPICard title="Total Reviews" value={kpi.totalReviews} subtitle="Reviews analyzed" icon={MessageSquare} />
              <KPICard title="Positive Rate" value={`${kpi.positiveRate}%`} subtitle="Customer satisfaction" icon={TrendingUp} />
              <KPICard title="Average Rating" value={kpi.avgRating} subtitle="Out of 5.0" icon={Star} />
              <KPICard title="AI Analyses" value={longData.length} subtitle="Multi-model results" icon={Brain} />
            </div>

            <Section title="Filters" subtitle="Refine the analysis views">
              <div className="grid md:grid-cols-5 gap-3">
                <div className="col-span-2 flex items-center gap-2">
                  <Search size={16} className="text-zinc-400" />
                  <Input placeholder="Search reviews or hotel name" value={controls.q} onChange={(e)=>controls.setQ(e.target.value)} />
                </div>
                <Select value={controls.hotel} onChange={(v)=>controls.setHotel(v)}>
                  <Option value="all">All Hotels</Option>
                  {controls.hotels.map(h=><Option key={h} value={h}>{h}</Option>)}
                </Select>
                <Select value={controls.aspect} onChange={(v)=>controls.setAspect(v)}>
                  <Option value="all">All Aspects</Option>
                  {ASPECTS.map(a=><Option key={a} value={a}>{a}</Option>)}
                </Select>
                <Select value={controls.lang} onChange={(v)=>controls.setLang(v)}>
                  <Option value="all">All Languages</Option>
                  <Option value="id">Bahasa Indonesia</Option>
                  <Option value="en">English</Option>
                </Select>
                <Select value={controls.sentFilter} onChange={(v)=>controls.setSentFilter(v)}>
                  <Option value="all">All Sentiments</Option>
                  {SENTIMENTS.map(s=><Option key={s} value={s}>{titleCase(s)}</Option>)}
                </Select>
              </div>
            </Section>

            <div className="grid md:grid-cols-2 gap-6">
              <Section title="Sentiment Distribution" subtitle="Overall sentiment breakdown across all reviews">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentimentsAgg}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                      <XAxis dataKey="name" stroke="#c7d2fe" />
                      <YAxis stroke="#c7d2fe" />
                      <Tooltip contentStyle={{ background: "#0b1022", border: "1px solid #334155", color: "#e5e7eb" }} />
                      <Bar dataKey="value">
                        {sentimentsAgg.map((e,i)=><Cell key={`c-${i}`} fill={SENTIMENT_COLORS[e.key]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Aspect Performance" subtitle="Counts per sentiment by aspect">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aspectAgg}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                      <XAxis dataKey="aspect" stroke="#c7d2fe" />
                      <YAxis stroke="#c7d2fe" />
                      <Tooltip contentStyle={{ background: "#0b1022", border: "1px solid #334155", color: "#e5e7eb" }} />
                      <Bar dataKey="positive" stackId="s" fill={SENTIMENT_COLORS.positive} />
                      <Bar dataKey="neutral" stackId="s" fill={SENTIMENT_COLORS.neutral} />
                      <Bar dataKey="negative" stackId="s" fill={SENTIMENT_COLORS.negative} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            <Section title="Hotel × Aspect Heatmap" subtitle="Sentiment score (−1 to +1) across hotels and aspects">
              <Heatmap data={heatmapData} />
            </Section>
          </div>
        )}

        {tab==="analysis" && (
          <div className="grid md:grid-cols-3 gap-6">
            <Section title={`Reviews (${filtered.length})`} subtitle="Select a review to view detailed analysis">
              <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
                {filtered.slice(0,250).map((r,idx)=>(
                  <div key={idx} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-700">
                    <div className="text-sm text-indigo-200 font-medium">{r.hotel_name} • {r.language?.toUpperCase?.() || ""} • {r.rating}★</div>
                    <div className="text-xs text-zinc-400">{r.review_date}</div>
                    <div className="mt-2 text-sm text-zinc-200 line-clamp-3">{r.review_text}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">{r.aspect}</span>
                      <span className="text-[10px] px-2 py-1 rounded-full border" style={{ background: SENTIMENT_COLORS[r.sentiment], borderColor: "transparent", color: "#0b1022" }}>{titleCase(r.sentiment)} ({r.confidence})</span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-zinc-400">Explainable tokens</summary>
                      <div className="mt-1 text-xs text-zinc-300 flex flex-wrap gap-1">
                        {topKeywords(r.review_text).map(k=>(<span key={k} className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">{k}</span>))}
                      </div>
                    </details>
                  </div>
                ))}
                {filtered.length===0 && (<div className="text-zinc-400">No reviews match your filters.</div>)}
              </div>
            </Section>

            <div className="md:col-span-2 space-y-6">
              <Section title="Aspect Breakdown" subtitle="Distribution within current filter">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aspectAgg}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                      <XAxis dataKey="aspect" stroke="#c7d2fe" />
                      <YAxis stroke="#c7d2fe" />
                      <Tooltip contentStyle={{ background: "#0b1022", border: "1px solid #334155", color: "#e5e7eb" }} />
                      <Bar dataKey="positive" stackId="s" fill={SENTIMENT_COLORS.positive} />
                      <Bar dataKey="neutral" stackId="s" fill={SENTIMENT_COLORS.neutral} />
                      <Bar dataKey="negative" stackId="s" fill={SENTIMENT_COLORS.negative} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Sentiment Over Time" subtitle="By review date (rolling view)">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      const m={}; filtered.forEach(d=>{ const key=d.review_date||""; m[key]=m[key]||{pos:0,neg:0,tot:0}; if(d.sentiment==="positive") m[key].pos++; if(d.sentiment==="negative") m[key].neg++; m[key].tot++; });
                      return Object.entries(m).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([date,v])=>({date, score: v.tot? (v.pos-v.neg)/v.tot : 0}));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                      <XAxis dataKey="date" stroke="#c7d2fe" />
                      <YAxis stroke="#c7d2fe" domain={[-1,1]} />
                      <Tooltip contentStyle={{ background: "#0b1022", border: "1px solid #334155", color: "#e5e7eb" }} />
                      <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>
          </div>
        )}

        {tab==="topics" && (
          <div className="space-y-6">
            <Section title="Topic Analysis" subtitle="Quick keyword-based topic sketch (demo – can be replaced with BERTopic/GPT)">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const freq={}; (filtered.length?filtered:longData).forEach(d=>{ topKeywords(d.review_text,12).forEach(w=>freq[w]=(freq[w]||0)+1) });
                      return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([w,c])=>({word:w,count:c}));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
                      <XAxis dataKey="word" stroke="#c7d2fe" />
                      <YAxis stroke="#c7d2fe" />
                      <Tooltip contentStyle={{ background: "#0b1022", border: "1px solid #334155", color: "#e5e7eb" }} />
                      <Bar dataKey="count" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 overflow-auto max-h-72">
                  {(() => {
                    const freq={}; (filtered.length?filtered:longData).forEach(d=>{ topKeywords(d.review_text,12).forEach(w=>freq[w]=(freq[w]||0)+1) });
                    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([w,c])=>(
                      <span key={w} className="inline-block m-1 px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-sm">
                        {w} <span className="text-indigo-300/70">×{c}</span>
                      </span>
                    ));
                  })()}
                </div>
              </div>
            </Section>
          </div>
        )}

        {tab==="add" && (
          <div className="grid md:grid-cols-3 gap-6">
            <Section title="Hotel Review Form" subtitle="Provide detailed feedback untuk analisis sentimen yang akurat">
              <div className="space-y-3">
                <Input placeholder="Hotel Name *" value={form.hotel_name} onChange={(e)=>setForm({...form, hotel_name:e.target.value})} />
                <Input placeholder="Your name / initials" value={form.user} onChange={(e)=>setForm({...form, user:e.target.value})} />
                <div className="flex items-center gap-3">
                  <div className="text-sm text-zinc-300">Rating</div>
                  <Input type="number" min={1} max={5} value={form.rating} onChange={(e)=>setForm({...form, rating:Number(e.target.value)})} style={{width:"100px"}} />
                  <Select value={form.language} onChange={(v)=>setForm({...form, language:v})} className="w-40">
                    <Option value="id">Bahasa Indonesia</Option>
                    <Option value="en">English</Option>
                  </Select>
                </div>
                <Textarea placeholder="Detailed Review *" className="min-h-[120px]" value={form.review_text} onChange={(e)=>setForm({...form, review_text:e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  {ASPECTS.map(a=>(
                    <div key={a} className="flex items-center gap-2">
                      <div className="w-28 text-xs text-zinc-300">{a}</div>
                      <Select value={form.aspects[a]} onChange={(v)=>setForm({...form, aspects:{...form.aspects, [a]:v}})}>
                        <Option value="">—</Option>
                        {SENTIMENTS.map(s=>(<Option key={s} value={s}>{titleCase(s)}</Option>))}
                      </Select>
                    </div>
                  ))}
                </div>
                <div className="pt-2"><Btn onClick={addReview} className="bg-indigo-600 text-white">Submit Review</Btn></div>
              </div>
            </Section>

            <Section title="Review Guidelines" subtitle="Tips agar analisis lebih akurat">
              <ul className="list-disc list-inside text-sm text-zinc-300 space-y-2">
                <li>Be Specific — sebutkan aspek: service, cleanliness, location, food, price, amenities, room comfort, staff behavior, facilities.</li>
                <li>Balanced Feedback — sertakan poin positif & negatif.</li>
                <li>Detailed Description — beri konteks agar model memahami nuansa.</li>
                <li>Minimum Length — hindari ulasan &lt; 50 karakter.</li>
              </ul>
            </Section>

            <Section title="Preview Token Highlights" subtitle="Kata yang sering muncul dari teks Anda">
              <div className="min-h-[200px]">
                {topKeywords(form.review_text,10).map(w=>(<span key={w} className="inline-block m-1 px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-sm">{w}</span>))}
                {!form.review_text && (<div className="text-zinc-500 text-sm">Ketik ulasan di kiri untuk melihat highlight otomatis.</div>)}
              </div>
            </Section>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-zinc-400">© {new Date().getFullYear()} SentiScope • ABSA Research Dashboard</footer>
    </div>
  );
}
