import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, writeBatch,
} from "firebase/firestore";

/* ─── constants ─── */
const USERS = [
  { id:"seba", name:"Seba", avatar:"S", color:"#6366f1" },
  { id:"dani", name:"Dani", avatar:"D", color:"#f59e0b" },
  { id:"jime", name:"Jime", avatar:"J", color:"#10b981" },
];
const AREAS_DEFAULT = ["Abastecimiento","Calidad","Comercial","Finanzas","IT","Legal","Logística","Marketing","Operaciones","RRHH","Seguridad"];
const ITEM_TYPES    = { analisis:"Punto de análisis", dolor:"Dolor", pendiente:"Pendiente de área" };
const AREA_COLORS   = [
  { bg:"var(--color-background-info)",    fg:"var(--color-text-info)" },
  { bg:"var(--color-background-warning)", fg:"var(--color-text-warning)" },
  { bg:"var(--color-background-success)", fg:"var(--color-text-success)" },
  { bg:"var(--color-background-danger)",  fg:"var(--color-text-danger)" },
];
const TYPE_META = {
  analisis:  { label:"Análisis",  bg:"var(--color-background-info)",   fg:"var(--color-text-info)",    icon:"ti-chart-line" },
  dolor:     { label:"Dolor",     bg:"var(--color-background-danger)",  fg:"var(--color-text-danger)",  icon:"ti-alert-circle" },
  pendiente: { label:"Pendiente", bg:"var(--color-background-warning)", fg:"var(--color-text-warning)", icon:"ti-clock" },
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const fmt   = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtS  = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short"}) : "—";

function areaColor(area) {
  const idx = [...(area||"")].reduce((a,c) => a+c.charCodeAt(0), 0);
  return AREA_COLORS[idx % AREA_COLORS.length];
}

/* ─── Firebase helpers ─── */
const uPath  = (uid, col, id) => doc(db, `users/${uid}/${col}/${id}`);
const uCol   = (uid, col)     => collection(db, `users/${uid}/${col}`);
const uCfg   = (uid)          => doc(db, `users/${uid}/config/main`);

async function fbSet(uid, col, id, data) {
  try { await setDoc(uPath(uid, col, id), data); } catch(e) { console.error(e); }
}
async function fbDel(uid, col, id) {
  try { await deleteDoc(uPath(uid, col, id)); } catch(e) { console.error(e); }
}
async function fbSetCfg(uid, data) {
  try { await setDoc(uCfg(uid), data); } catch(e) { console.error(e); }
}

/* ─── Image compression (small enough for Firestore docs) ─── */
async function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400, scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg", 0.55));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ════════════════ UI ATOMS ════════════════ */
function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label:type, bg:"var(--color-background-secondary)", fg:"var(--color-text-secondary)", icon:"ti-tag" };
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.bg,color:m.fg,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,whiteSpace:"nowrap"}}>
    <i className={`ti ${m.icon}`} style={{fontSize:11}} />{m.label}
  </span>;
}
function AreaChip({ area, size="md" }) {
  const c = areaColor(area);
  return <span style={{background:c.bg,color:c.fg,fontSize:11,fontWeight:500,padding:size==="sm"?"1px 7px":"3px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{area}</span>;
}

function PhotoPicker({ photos=[], onChange, compact=false }) {
  const ref = useRef();
  const sz  = compact ? 52 : 68;
  async function handleFiles(e) {
    const files = Array.from(e.target.files); if (!files.length) return;
    const compressed = await Promise.all(files.map(compressImage));
    onChange([...photos, ...compressed.map((dataUrl,i)=>({id:genId(),dataUrl,name:files[i].name}))]);
    e.target.value="";
  }
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
      {photos.map(p=>(
        <div key={p.id} style={{position:"relative",width:sz,height:sz,flexShrink:0}}>
          <img src={p.dataUrl} alt={p.name} onClick={()=>window.open(p.dataUrl,"_blank")}
            style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:6,cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)"}}/>
          <button onClick={()=>onChange(photos.filter(x=>x.id!==p.id))}
            style={{position:"absolute",top:-5,right:-5,width:17,height:17,borderRadius:"50%",background:"var(--color-text-primary)",color:"var(--color-background-primary)",border:"none",cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
      ))}
      <label style={{width:sz,height:sz,border:"0.5px dashed var(--color-border-secondary)",borderRadius:6,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--color-text-tertiary)",gap:2,flexShrink:0}}>
        <i className="ti ti-camera-plus" style={{fontSize:compact?16:20}}/>
        {!compact && <span style={{fontSize:10}}>Foto</span>}
        <input ref={ref} type="file" accept="image/*" multiple onChange={handleFiles} style={{display:"none"}}/>
      </label>
    </div>
  );
}
function PhotoStrip({ photos=[] }) {
  if (!photos?.length) return null;
  return <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
    {photos.map(p=><img key={p.id} src={p.dataUrl} alt={p.name} onClick={()=>window.open(p.dataUrl,"_blank")}
      style={{width:56,height:56,objectFit:"cover",borderRadius:6,cursor:"pointer",border:"0.5px solid var(--color-border-tertiary)"}}/>)}
  </div>;
}

function BulletNotes({ bullets, onChange, placeholder="Agregar punto…" }) {
  const refs = useRef([]);
  function update(idx, val) { const n=[...bullets]; n[idx]=val; onChange(n); }
  function addAfter(idx) {
    const n=[...bullets]; n.splice(idx+1,0,""); onChange(n);
    setTimeout(()=>refs.current[idx+1]?.focus(), 30);
  }
  function removeAt(idx) {
    if (bullets.length===1) { onChange([""]); return; }
    const n=[...bullets]; n.splice(idx,1); onChange(n);
    setTimeout(()=>refs.current[Math.max(0,idx-1)]?.focus(), 30);
  }
  function onKey(e, idx) {
    if (e.key==="Enter") { e.preventDefault(); addAfter(idx); }
    if (e.key==="Backspace" && bullets[idx]==="" && bullets.length>1) { e.preventDefault(); removeAt(idx); }
  }
  return (
    <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",padding:"8px 10px"}}>
      {bullets.map((b,idx)=>(
        <div key={idx} style={{display:"flex",alignItems:"center",gap:6,marginBottom:idx<bullets.length-1?4:0}}>
          <span style={{color:"var(--color-text-tertiary)",fontSize:14,userSelect:"none",flexShrink:0}}>•</span>
          <input ref={el=>refs.current[idx]=el} value={b} onChange={e=>update(idx,e.target.value)} onKeyDown={e=>onKey(e,idx)}
            placeholder={idx===0?placeholder:""}
            style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:13,color:"var(--color-text-primary)",fontFamily:"inherit",padding:"2px 0"}}/>
          {bullets.length>1 && <button onClick={()=>removeAt(idx)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:12,padding:"0 2px",flexShrink:0}}>✕</button>}
        </div>
      ))}
      <button onClick={()=>addAfter(bullets.length-1)}
        style={{marginTop:6,fontSize:11,color:"var(--color-text-tertiary)",background:"none",border:"none",cursor:"pointer",padding:"2px 0",display:"flex",alignItems:"center",gap:4}}>
        <i className="ti ti-plus" style={{fontSize:11}}/>Agregar punto
      </button>
    </div>
  );
}
function BulletDisplay({ bullets }) {
  const items = (bullets||[]).filter(b=>b.trim());
  if (!items.length) return null;
  return <ul style={{margin:"4px 0 0",padding:"0 0 0 16px"}}>
    {items.map((b,i)=><li key={i} style={{fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.6}}>{b}</li>)}
  </ul>;
}

function CommentThread({ item, onAddComment, onResolve }) {
  const [text, setText] = useState("");
  const comments = item.comments||[];
  function submit() { if (!text.trim()) return; onAddComment(item.id, text); setText(""); }
  return (
    <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:12,marginTop:12}}>
      {comments.length>0 && <div style={{marginBottom:12}}>
        {comments.map(c=>(
          <div key={c.id} style={{display:"flex",gap:10,marginBottom:8}}>
            <div style={{width:2,flexShrink:0,background:"var(--color-border-secondary)",borderRadius:2}}/>
            <div>
              <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:2}}>{fmt(c.date)}</div>
              <div style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.55}}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="Agregar seguimiento o comentario…"
          style={{flex:1,fontSize:13,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontFamily:"inherit"}}/>
        <button onClick={submit} disabled={!text.trim()}
          style={{padding:"6px 12px",fontSize:12,fontWeight:500,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",cursor:text.trim()?"pointer":"not-allowed"}}>Enviar</button>
      </div>
      {item.status==="abierto"&&onResolve&&(
        <button onClick={()=>onResolve(item.id)} style={{marginTop:10,width:"100%",padding:"7px",fontSize:12,fontWeight:500,background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>
          <i className="ti ti-check" style={{fontSize:13,marginRight:4}}/>Marcar como resuelto
        </button>
      )}
    </div>
  );
}

function ItemCard({ item, locationName, visitDate, onResolve, onAddComment, onEditItem, showLocation=true }) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [editDesc, setEditDesc] = useState(item.description);
  const comments = item.comments||[];
  function saveEdit() { onEditItem(item.id, editDesc); setEditing(false); }
  return (
    <div style={{background:"var(--color-background-primary)",border:`0.5px solid ${item.status==="resuelto"?"var(--color-border-tertiary)":"var(--color-border-secondary)"}`,borderRadius:"var(--border-radius-lg)",padding:"14px 16px",marginBottom:8,opacity:item.status==="resuelto"?0.6:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
          <TypeBadge type={item.type}/>
          {item.area&&<AreaChip area={item.area}/>}
          {item.status==="resuelto"&&<span style={{fontSize:11,color:"var(--color-text-success)",fontWeight:500}}>✓ Resuelto</span>}
        </div>
        <span style={{fontSize:11,color:"var(--color-text-tertiary)",whiteSpace:"nowrap",flexShrink:0}}>{fmtS(visitDate)}</span>
      </div>
      {editing ? (
        <div style={{marginBottom:10}}>
          <input value={editDesc} onChange={e=>setEditDesc(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditing(false);}}
            autoFocus style={{width:"100%",fontSize:14,padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-warning)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontFamily:"inherit",boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
            <button onClick={()=>setEditing(false)} style={{fontSize:11,padding:"3px 10px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>Cancelar</button>
            <button onClick={saveEdit} style={{fontSize:11,padding:"3px 10px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontWeight:500}}>✓ Guardar</button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:6}}>
          <p style={{margin:0,fontSize:14,color:"var(--color-text-primary)",lineHeight:1.55,flex:1}}>{item.description}</p>
          {item.status==="abierto"&&onEditItem&&(
            <button onClick={()=>{setEditDesc(item.description);setEditing(true);}}
              style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",padding:"2px",flexShrink:0,marginTop:1}}>
              <i className="ti ti-pencil" style={{fontSize:13}}/>
            </button>
          )}
        </div>
      )}
      <PhotoStrip photos={item.photos}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          {showLocation&&locationName&&<span style={{fontSize:12,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-building-store" style={{fontSize:12}}/>{locationName}
          </span>}
          <span style={{fontSize:12,color:"var(--color-text-tertiary)",display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-calendar" style={{fontSize:12}}/>{fmt(visitDate)}
          </span>
        </div>
        <button onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",padding:0}}>
          <i className="ti ti-message-circle" style={{fontSize:13}}/>
          {comments.length>0?`${comments.length} comentario${comments.length>1?"s":""}` : "Comentar"}
          <i className={`ti ${expanded?"ti-chevron-up":"ti-chevron-down"}`} style={{fontSize:12}}/>
        </button>
      </div>
      {expanded&&<CommentThread item={item} onAddComment={onAddComment} onResolve={onResolve}/>}
    </div>
  );
}

function NavBtn({ icon, label, active, badge, onClick, sub }) {
  return (
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:sub?"7px 16px 7px 34px":"9px 16px",background:active?"var(--color-background-secondary)":"transparent",border:"none",borderLeft:active?"2px solid var(--color-text-warning)":"2px solid transparent",cursor:"pointer",textAlign:"left",color:active?"var(--color-text-primary)":"var(--color-text-secondary)",fontSize:sub?13:14,fontWeight:active?500:400}}>
      <i className={`ti ${icon}`} style={{fontSize:sub?14:16}}/>
      <span style={{flex:1}}>{label}</span>
      {badge>0&&<span style={{fontSize:11,background:"var(--color-background-warning)",color:"var(--color-text-warning)",padding:"1px 7px",borderRadius:10,fontWeight:500}}>{badge}</span>}
    </button>
  );
}

function InlineTypeAreaSelects({ type, setType, area, setArea, allFormAreas, allTypeOptions, areaAdding, setAreaAdding, areaNewVal, setAreaNewVal, confirmNewArea, typeAdding, setTypeAdding, typeNewVal, setTypeNewVal, confirmNewType }) {
  const sml = {padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <div>
        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>Tipo</label>
        {typeAdding ? (
          <div style={{display:"flex",gap:4}}>
            <input autoFocus value={typeNewVal} onChange={e=>setTypeNewVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){const v=confirmNewType();if(v)setType(v);}if(e.key==="Escape"){setTypeAdding(false);setTypeNewVal("");}}}
              placeholder="Nuevo tipo…" style={{...sml,flex:1}}/>
            <button onClick={()=>{const v=confirmNewType();if(v)setType(v);}} style={{padding:"6px 9px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13}}>✓</button>
            <button onClick={()=>{setTypeAdding(false);setTypeNewVal("");}} style={{padding:"6px 9px",background:"transparent",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        ) : (
          <select value={type} onChange={e=>{if(e.target.value==="__new__")setTypeAdding(true);else setType(e.target.value);}} style={sml}>
            {allTypeOptions.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
            <option value="__new__">＋ Agregar tipo nuevo…</option>
          </select>
        )}
      </div>
      <div>
        <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>Área (si aplica)</label>
        {areaAdding ? (
          <div style={{display:"flex",gap:4}}>
            <input autoFocus value={areaNewVal} onChange={e=>setAreaNewVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){const v=confirmNewArea();if(v)setArea(v);}if(e.key==="Escape"){setAreaAdding(false);setAreaNewVal("");}}}
              placeholder="Nueva área…" style={{...sml,flex:1}}/>
            <button onClick={()=>{const v=confirmNewArea();if(v)setArea(v);}} style={{padding:"6px 9px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13}}>✓</button>
            <button onClick={()=>{setAreaAdding(false);setAreaNewVal("");}} style={{padding:"6px 9px",background:"transparent",border:"0.5px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        ) : (
          <select value={area} onChange={e=>{if(e.target.value==="__new__")setAreaAdding(true);else setArea(e.target.value);}} style={sml}>
            <option value="">Sin área</option>
            {allFormAreas.map(a=><option key={a} value={a}>{a}</option>)}
            <option value="__new__">＋ Agregar área nueva…</option>
          </select>
        )}
      </div>
    </div>
  );
}

function InlineAddItem({ allFormAreas, allTypeOptions, onAdd, onCancel, showCancel=false, ...shared }) {
  const [type,   setType]   = useState("analisis");
  const [area,   setArea]   = useState("");
  const [desc,   setDesc]   = useState("");
  const [photos, setPhotos] = useState([]);
  function handleAdd() {
    if (!desc.trim()) return;
    onAdd({type,area,description:desc,photos});
    setType("analisis"); setArea(""); setDesc(""); setPhotos([]);
  }
  const sml = {padding:"6px 10px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"16px"}}>
      <InlineTypeAreaSelects type={type} setType={setType} area={area} setArea={setArea}
        allFormAreas={allFormAreas} allTypeOptions={allTypeOptions} {...shared}/>
      <div style={{marginBottom:10}}>
        <input value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()}
          placeholder="Descripción del ítem…" style={sml}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <PhotoPicker photos={photos} onChange={setPhotos} compact/>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          {showCancel&&<button onClick={onCancel} style={{padding:"6px 12px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13}}>Cancelar</button>}
          <button onClick={handleAdd} style={{padding:"6px 14px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap"}}>
            <i className="ti ti-plus"/> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

const baseInp = {padding:"7px 12px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",fontSize:14,width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
const smlInp  = {...baseInp,fontSize:13,padding:"6px 10px"};

/* ════════════════════════════════════════
   LOGIN SCREEN
════════════════════════════════════════ */
function LoginScreen({ onSelect }) {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--color-background-tertiary)",fontFamily:"var(--font-sans)",padding:24}}>
      <div style={{marginBottom:32,textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:500,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--color-text-tertiary)",marginBottom:8}}>Regional SR</div>
        <div style={{fontSize:26,fontWeight:500,color:"var(--color-text-primary)"}}>Gestión de Visitas</div>
        <div style={{fontSize:14,color:"var(--color-text-secondary)",marginTop:6}}>¿Quién está ingresando?</div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
        {USERS.map(u=>(
          <button key={u.id} onClick={()=>onSelect(u)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"28px 32px",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",cursor:"pointer",minWidth:130}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:u.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:600,color:"#fff"}}>
              {u.avatar}
            </div>
            <div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>{u.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN APP
════════════════════════════════════════ */
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loaded,    setLoaded]    = useState(false);
  const unsubRef = useRef([]);

  /* data */
  const [locations,   setLocations]   = useState([]);
  const [visits,      setVisits]      = useState([]);
  const [items,       setItems]       = useState([]);
  const [customAreas, setCustomAreas] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);

  /* nav */
  const [view,     setView]     = useState("dashboard");
  const [selLocId, setSelLocId] = useState(null);

  /* location form */
  const [newLocName,   setNewLocName]   = useState("");
  const [showAddLoc,   setShowAddLoc]   = useState(false);
  const [editingLocId, setEditingLocId] = useState(null);
  const [editLocName,  setEditLocName]  = useState("");

  /* filters */
  const [fArea, setFArea] = useState("");
  const [fType, setFType] = useState("");
  const [fLoc,  setFLoc]  = useState("");

  /* new visit */
  const [nvLocId,   setNvLocId]   = useState("");
  const [nvDate,    setNvDate]    = useState(today());
  const [nvBullets, setNvBullets] = useState([""]);
  const [nvPhotos,  setNvPhotos]  = useState([]);
  const [nvItems,   setNvItems]   = useState([]);

  /* custom type/area */
  const [areaAdding, setAreaAdding] = useState(false);
  const [areaNewVal, setAreaNewVal] = useState("");
  const [typeAdding, setTypeAdding] = useState(false);
  const [typeNewVal, setTypeNewVal] = useState("");

  /* edit visit */
  const [editVid,       setEditVid]       = useState(null);
  const [editDate,      setEditDate]      = useState("");
  const [editBullets,   setEditBullets]   = useState([""]);
  const [editPhotos,    setEditPhotos]    = useState([]);
  const [editItems,     setEditItems]     = useState([]);
  const [editDelIds,    setEditDelIds]    = useState(new Set());
  const [editItemId,    setEditItemId]    = useState(null);
  const [eiType,        setEiType]        = useState("");
  const [eiArea,        setEiArea]        = useState("");
  const [eiDesc,        setEiDesc]        = useState("");
  const [eiPhotos,      setEiPhotos]      = useState([]);
  const [showAddInEdit, setShowAddInEdit] = useState(false);

  /* ── Firebase: login / listeners ── */
  function selectUser(u) {
    // Tear down previous listeners
    unsubRef.current.forEach(fn => fn());

    setCurrentUser(u);
    setLoaded(false);
    setLocations([]); setVisits([]); setItems([]);
    setCustomAreas([]); setCustomTypes([]);

    const uid = u.id;
    const fired = { locs:false, visits:false, items:false, cfg:false };
    function check() {
      if (Object.values(fired).every(Boolean)) setLoaded(true);
    }

    unsubRef.current = [
      onSnapshot(uCol(uid,"locations"), snap => {
        setLocations(snap.docs.map(d=>d.data()));
        if (!fired.locs) { fired.locs=true; check(); }
      }),
      onSnapshot(uCol(uid,"visits"), snap => {
        setVisits(snap.docs.map(d=>d.data()));
        if (!fired.visits) { fired.visits=true; check(); }
      }),
      onSnapshot(uCol(uid,"items"), snap => {
        setItems(snap.docs.map(d=>d.data()));
        if (!fired.items) { fired.items=true; check(); }
      }),
      onSnapshot(uCfg(uid), snap => {
        if (snap.exists()) {
          const d=snap.data();
          setCustomAreas(d.customAreas||[]);
          setCustomTypes(d.customTypes||[]);
        }
        if (!fired.cfg) { fired.cfg=true; check(); }
      }),
    ];

    setView("dashboard");
  }

  function logout() {
    unsubRef.current.forEach(fn => fn());
    unsubRef.current = [];
    setCurrentUser(null); setLoaded(false);
    setLocations([]); setVisits([]); setItems([]);
    setCustomAreas([]); setCustomTypes([]);
  }

  // Cleanup on unmount
  useEffect(() => () => unsubRef.current.forEach(fn=>fn()), []);

  /* ── helpers ── */
  const uid = currentUser?.id;
  const allFormAreas   = [...AREAS_DEFAULT, ...customAreas];
  const allTypeOptions = [...Object.entries(ITEM_TYPES).map(([k,v])=>({key:k,label:v})), ...customTypes.map(t=>({key:t,label:t}))];
  const allItemTypes   = [...new Set(items.map(i=>i.type))];

  function confirmNewArea() {
    const val=areaNewVal.trim(); setAreaAdding(false); setAreaNewVal("");
    if (!val) return null;
    const newAreas = [...AREAS_DEFAULT,...customAreas].includes(val) ? customAreas : [...customAreas,val];
    setCustomAreas(newAreas);
    fbSetCfg(uid,{customAreas:newAreas,customTypes});
    return val;
  }
  function confirmNewType() {
    const val=typeNewVal.trim(); setTypeAdding(false); setTypeNewVal("");
    if (!val) return null;
    const newTypes = [...Object.keys(ITEM_TYPES),...customTypes].includes(val) ? customTypes : [...customTypes,val];
    setCustomTypes(newTypes);
    fbSetCfg(uid,{customAreas,customTypes:newTypes});
    return val;
  }
  const sharedTAProps = { allFormAreas, allTypeOptions, areaAdding, setAreaAdding, areaNewVal, setAreaNewVal, confirmNewArea, typeAdding, setTypeAdding, typeNewVal, setTypeNewVal, confirmNewType };

  /* ── CRUD actions ── */
  function addLocation() {
    if (!newLocName.trim()) return;
    const loc = { id:genId(), name:newLocName.trim() };
    fbSet(uid,'locations',loc.id,loc);
    setNewLocName(""); setShowAddLoc(false);
  }
  function saveLocName(id) {
    if (!editLocName.trim()) return;
    const loc = locations.find(l=>l.id===id); if (!loc) return;
    const updated = {...loc,name:editLocName.trim()};
    setLocations(p=>p.map(l=>l.id===id?updated:l));
    fbSet(uid,'locations',id,updated);
    setEditingLocId(null);
  }

  async function submitVisit() {
    if (!nvLocId||!nvDate) return;
    const visitId = genId();
    const visit   = {id:visitId,locationId:nvLocId,date:nvDate,bullets:nvBullets,photos:nvPhotos};
    const newItems = nvItems.map(it=>({...it,id:genId(),visitId,locationId:nvLocId,createdAt:nvDate,status:"abierto",comments:[]}));

    const batch = writeBatch(db);
    batch.set(doc(db,`users/${uid}/visits/${visitId}`), visit);
    newItems.forEach(item => batch.set(doc(db,`users/${uid}/items/${item.id}`), item));
    await batch.commit();

    setNvItems([]); setNvBullets([""]); setNvDate(today()); setNvPhotos([]);
    setSelLocId(nvLocId); setView("location");
  }

  function resolveItem(id) {
    const item = items.find(it=>it.id===id); if (!item) return;
    const updated = {...item,status:"resuelto",resolvedAt:today()};
    setItems(p=>p.map(it=>it.id===id?updated:it));
    fbSet(uid,'items',id,updated);
  }
  function addComment(itemId, text) {
    const item = items.find(it=>it.id===itemId); if (!item) return;
    const comment = {id:genId(),text:text.trim(),date:today()};
    const updated = {...item,comments:[...(item.comments||[]),comment]};
    setItems(p=>p.map(it=>it.id===itemId?updated:it));
    fbSet(uid,'items',itemId,updated);
  }
  function editItemText(itemId, newDesc) {
    const item = items.find(it=>it.id===itemId); if (!item) return;
    const updated = {...item,description:newDesc};
    setItems(p=>p.map(it=>it.id===itemId?updated:it));
    fbSet(uid,'items',itemId,updated);
  }

  /* edit visit */
  function startEdit(visitId) {
    const v=visits.find(v=>v.id===visitId); if (!v) return;
    setEditVid(visitId); setEditDate(v.date);
    setEditBullets(v.bullets?.length?v.bullets:[v.notes||""]);
    setEditPhotos(v.photos||[]);
    setEditItems(items.filter(i=>i.visitId===visitId).map(i=>({...i})));
    setEditDelIds(new Set()); setEditItemId(null); setShowAddInEdit(false);
    setView("editvisit");
  }
  function startEditItem(item) { setEditItemId(item.id); setEiType(item.type); setEiArea(item.area||""); setEiDesc(item.description); setEiPhotos(item.photos||[]); }
  function saveEditItem(id)    { setEditItems(p=>p.map(it=>it.id===id?{...it,type:eiType,area:eiArea,description:eiDesc,photos:eiPhotos}:it)); setEditItemId(null); }
  function deleteEditItem(id)  { setEditDelIds(p=>new Set([...p,id])); if(editItemId===id) setEditItemId(null); }
  function addEditItem(item)   {
    const newItem={...item,id:genId(),visitId:editVid,locationId:visits.find(v=>v.id===editVid)?.locationId,createdAt:editDate,status:"abierto",comments:[]};
    setEditItems(p=>[...p,newItem]); setShowAddInEdit(false);
  }
  async function saveEdit() {
    const origVisit = visits.find(v=>v.id===editVid);
    const updVisit  = {...origVisit,date:editDate,bullets:editBullets,photos:editPhotos};
    const keptItems = editItems.filter(i=>!editDelIds.has(i.id));

    const batch = writeBatch(db);
    batch.set(doc(db,`users/${uid}/visits/${editVid}`), updVisit);
    keptItems.forEach(item => batch.set(doc(db,`users/${uid}/items/${item.id}`), item));
    editDelIds.forEach(id => batch.delete(doc(db,`users/${uid}/items/${id}`)));
    await batch.commit();

    setVisits(p=>p.map(v=>v.id===editVid?updVisit:v));
    setItems(p=>[...p.filter(i=>i.visitId!==editVid),...keptItems]);
    setView("location");
  }

  /* ── derived ── */
  const openItems = items.filter(i=>i.status==="abierto");
  const allAreas  = [...new Set(openItems.filter(i=>i.area).map(i=>i.area))].sort();
  const selLoc    = locations.find(l=>l.id===selLocId);
  const locVisits = selLoc ? visits.filter(v=>v.locationId===selLocId).sort((a,b)=>b.date.localeCompare(a.date)) : [];
  const locOpen   = selLoc ? items.filter(i=>i.locationId===selLocId&&i.status==="abierto") : [];
  const prevOpen  = nvLocId ? items.filter(i=>i.locationId===nvLocId&&i.status==="abierto") : [];
  const editLoc   = editVid ? locations.find(l=>l.id===visits.find(v=>v.id===editVid)?.locationId) : null;
  const pendFiltered = openItems
    .filter(i=>!fArea||i.area===fArea)
    .filter(i=>!fType||i.type===fType)
    .filter(i=>!fLoc||i.locationId===fLoc)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  /* ── render login ── */
  if (!currentUser) return <LoginScreen onSelect={selectUser}/>;
  if (!loaded) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--color-background-tertiary)",fontFamily:"var(--font-sans)"}}>
      <div style={{textAlign:"center",color:"var(--color-text-secondary)"}}>
        <div style={{width:36,height:36,border:"3px solid var(--color-border-secondary)",borderTopColor:"var(--color-text-warning)",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.8s linear infinite"}}/>
        Cargando datos…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const SL = ({children}) => <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--color-text-tertiary)",padding:"6px 18px 4px"}}>{children}</div>;

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"var(--font-sans)",background:"var(--color-background-tertiary)"}}>

      {/* ── Sidebar ── */}
      <aside style={{width:224,background:"var(--color-background-primary)",borderRight:"0.5px solid var(--color-border-tertiary)",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"18px 18px 14px"}}>
          <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--color-text-tertiary)",marginBottom:8}}>Regional SR</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:currentUser.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0}}>{currentUser.avatar}</div>
            <div>
              <div style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)"}}>{currentUser.name}</div>
              <button onClick={logout} style={{fontSize:11,color:"var(--color-text-tertiary)",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:3}}>
                <i className="ti ti-logout" style={{fontSize:11}}/>Cambiar usuario
              </button>
            </div>
          </div>
        </div>
        <nav style={{flex:1}}>
          <SL>General</SL>
          <NavBtn icon="ti-layout-dashboard" label="Inicio"      active={view==="dashboard"}                           onClick={()=>setView("dashboard")}/>
          <NavBtn icon="ti-building-store"   label="Mis Locales" active={["locations","location","editvisit"].includes(view)} onClick={()=>setView("locations")}/>
          <div style={{height:"0.5px",background:"var(--color-border-tertiary)",margin:"8px 0"}}/>
          <SL>Pendientes</SL>
          <NavBtn icon="ti-clock-exclamation" label="Todos" active={view==="pending"&&!fArea} badge={openItems.length}
            onClick={()=>{setFArea("");setFType("");setFLoc("");setView("pending");}}/>
          {allAreas.slice(0,7).map(area=>{
            const n=openItems.filter(i=>i.area===area).length;
            return <NavBtn key={area} icon="ti-tag" label={area} sub active={view==="pending"&&fArea===area} badge={n}
              onClick={()=>{setFArea(area);setFType("");setFLoc("");setView("pending");}}/>;
          })}
          <div style={{height:"0.5px",background:"var(--color-border-tertiary)",margin:"8px 0"}}/>
          <NavBtn icon="ti-calendar-plus" label="Nueva Visita" active={view==="newvisit"} onClick={()=>{setNvLocId("");setView("newvisit");}}/>
        </nav>
        <div style={{padding:"12px 18px",borderTop:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{locations.length} locales · {visits.length} visitas</div>
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={{flex:1,overflow:"auto"}}>

        {/* DASHBOARD */}
        {view==="dashboard" && (
          <div style={{padding:"28px",maxWidth:760}}>
            <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 22px"}}>Inicio</h1>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:28}}>
              {[{label:"Locales activos",value:locations.length,icon:"ti-building-store",warn:false},{label:"Visitas totales",value:visits.length,icon:"ti-calendar-event",warn:false},{label:"Pendientes abiertos",value:openItems.length,icon:"ti-clock-exclamation",warn:openItems.length>0},{label:"Con comentarios",value:openItems.filter(i=>(i.comments||[]).length>0).length,icon:"ti-message-circle",warn:false}].map(s=>(
                <div key={s.label} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"14px 16px"}}>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><i className={`ti ${s.icon}`} style={{fontSize:14}}/>{s.label}</div>
                  <div style={{fontSize:26,fontWeight:500,color:s.warn?"var(--color-text-warning)":"var(--color-text-primary)"}}>{s.value}</div>
                </div>
              ))}
            </div>
            {allAreas.length>0 && (
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Pendientes por área</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
                  {allAreas.map(area=>{const n=openItems.filter(i=>i.area===area).length;const c=areaColor(area);return(
                    <button key={area} onClick={()=>{setFArea(area);setFType("");setFLoc("");setView("pending");}}
                      style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:13,color:"var(--color-text-primary)",fontWeight:500}}>{area}</span>
                      <span style={{background:c.bg,color:c.fg,fontSize:12,padding:"2px 10px",borderRadius:10,fontWeight:500}}>{n}</span>
                    </button>
                  );})}
                </div>
              </div>
            )}
            {openItems.length>0 && (
              <div>
                <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Últimos pendientes</div>
                {[...openItems].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,4).map(item=>{
                  const loc=locations.find(l=>l.id===item.locationId);const v=visits.find(v=>v.id===item.visitId);
                  return <ItemCard key={item.id} item={item} locationName={loc?.name} visitDate={v?.date} onResolve={resolveItem} onAddComment={addComment} onEditItem={editItemText}/>;
                })}
                {openItems.length>4 && <button onClick={()=>{setFArea("");setFType("");setFLoc("");setView("pending");}}
                  style={{width:"100%",padding:"9px",border:"0.5px dashed var(--color-border-secondary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13}}>
                  Ver todos los pendientes ({openItems.length}) ↗
                </button>}
              </div>
            )}
            {locations.length===0 && <div style={{textAlign:"center",padding:"56px 24px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",color:"var(--color-text-secondary)"}}>
              <i className="ti ti-building-store" style={{fontSize:36,display:"block",marginBottom:12,color:"var(--color-text-tertiary)"}}/>
              <p style={{margin:"0 0 16px",fontSize:15}}>Agregá tu primer local para comenzar</p>
              <button onClick={()=>setView("locations")} style={{padding:"8px 20px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-warning)",background:"var(--color-background-warning)",color:"var(--color-text-warning)",cursor:"pointer",fontSize:14,fontWeight:500}}>Agregar local ↗</button>
            </div>}
          </div>
        )}

        {/* LOCATIONS */}
        {view==="locations" && (
          <div style={{padding:"28px",maxWidth:740}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <h1 style={{fontSize:22,fontWeight:500,margin:0}}>Mis Locales</h1>
              <button onClick={()=>setShowAddLoc(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500}}>
                <i className="ti ti-plus" style={{fontSize:14}}/> Agregar local
              </button>
            </div>
            {showAddLoc && <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>Nuevo local</div>
              <div style={{display:"flex",gap:8}}>
                <input value={newLocName} onChange={e=>setNewLocName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()} placeholder="Nombre del local" style={{...baseInp,flex:1}} autoFocus/>
                <button onClick={addLocation} style={{padding:"7px 16px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap"}}>Guardar</button>
                <button onClick={()=>{setShowAddLoc(false);setNewLocName("");}} style={{padding:"7px 12px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>✕</button>
              </div>
            </div>}
            {locations.length===0&&!showAddLoc && <div style={{textAlign:"center",padding:"48px",color:"var(--color-text-secondary)",fontSize:14}}>Aún no hay locales.</div>}
            {locations.map(loc=>{
              const lv=visits.filter(v=>v.locationId===loc.id);
              const lo=openItems.filter(i=>i.locationId===loc.id).length;
              const last=[...lv].sort((a,b)=>b.date.localeCompare(a.date))[0];
              const ap=[...new Set(openItems.filter(i=>i.locationId===loc.id&&i.area).map(i=>i.area))];
              const isEditing=editingLocId===loc.id;
              return (
                <div key={loc.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px 16px",marginBottom:8}}>
                  {isEditing ? (
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input value={editLocName} onChange={e=>setEditLocName(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveLocName(loc.id);if(e.key==="Escape")setEditingLocId(null);}}
                        autoFocus style={{...baseInp,flex:1,fontSize:15,fontWeight:500}}/>
                      <button onClick={()=>saveLocName(loc.id)} style={{padding:"7px 14px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap"}}>✓ Guardar</button>
                      <button onClick={()=>setEditingLocId(null)} style={{padding:"7px 10px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>✕</button>
                    </div>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>{setSelLocId(loc.id);setView("location");}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                          <span style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)"}}>{loc.name}</span>
                          <button onClick={e=>{e.stopPropagation();setEditingLocId(loc.id);setEditLocName(loc.name);}}
                            style={{display:"flex",alignItems:"center",gap:4,fontSize:11,padding:"3px 8px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",cursor:"pointer"}}>
                            <i className="ti ti-pencil" style={{fontSize:12}}/>Renombrar
                          </button>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:12,color:"var(--color-text-tertiary)"}}>{lv.length} visita{lv.length!==1?"s":""}{last?` · última: ${fmt(last.date)}`:" · sin visitas"}</span>
                          {ap.map(a=><AreaChip key={a} area={a} size="sm"/>)}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                        {lo>0&&<span style={{fontSize:12,background:"var(--color-background-warning)",color:"var(--color-text-warning)",padding:"3px 10px",borderRadius:10,fontWeight:500}}>{lo}</span>}
                        <i className="ti ti-chevron-right" style={{fontSize:16,color:"var(--color-text-tertiary)"}}/>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* LOCATION DETAIL */}
        {view==="location" && selLoc && (
          <div style={{padding:"28px",maxWidth:740}}>
            <button onClick={()=>setView("locations")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:13,padding:"0 0 14px",display:"flex",alignItems:"center",gap:4}}>
              <i className="ti ti-arrow-left" style={{fontSize:13}}/> Locales
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <h1 style={{fontSize:22,fontWeight:500,margin:0}}>{selLoc.name}</h1>
                  <button onClick={()=>{setView("locations");setEditingLocId(selLoc.id);setEditLocName(selLoc.name);}}
                    style={{display:"flex",alignItems:"center",gap:4,fontSize:11,padding:"3px 8px",borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",cursor:"pointer",flexShrink:0}}>
                    <i className="ti ti-pencil" style={{fontSize:12}}/>Renombrar
                  </button>
                </div>
                <div style={{fontSize:13,color:"var(--color-text-tertiary)"}}>{locVisits.length} visita{locVisits.length!==1?"s":""} registrada{locVisits.length!==1?"s":""}</div>
              </div>
              <button onClick={()=>{setNvLocId(selLoc.id);setView("newvisit");}} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500,flexShrink:0}}>
                <i className="ti ti-plus" style={{fontSize:14}}/> Nueva visita
              </button>
            </div>
            {locOpen.length>0 && <div style={{marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Pendientes abiertos ({locOpen.length})</div>
              {locOpen.map(item=>{const v=visits.find(v=>v.id===item.visitId);return <ItemCard key={item.id} item={item} visitDate={v?.date} onResolve={resolveItem} onAddComment={addComment} onEditItem={editItemText} showLocation={false}/>;})}</div>}
            <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Historial de visitas</div>
            {locVisits.length===0&&<div style={{textAlign:"center",padding:"32px",color:"var(--color-text-secondary)",fontSize:14,background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}>Aún no hay visitas registradas.</div>}
            {locVisits.map(visit=>{
              const vis=items.filter(i=>i.visitId===visit.id);
              const openCount=vis.filter(i=>i.status==="abierto").length;
              const bullets=(visit.bullets?.length)?visit.bullets.filter(b=>b.trim()):(visit.notes?[visit.notes]:[]);
              return (
                <div key={visit.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px 16px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:vis.length?10:0}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",marginBottom:bullets.length?4:0}}>{fmt(visit.date)}</div>
                      <BulletDisplay bullets={bullets}/>
                      <PhotoStrip photos={visit.photos}/>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:12}}>
                      {vis.length>0&&<span style={{fontSize:11,fontWeight:500,color:openCount>0?"var(--color-text-warning)":"var(--color-text-success)"}}>{openCount>0?`${openCount} abierto${openCount!==1?"s":""}`:"✓ Todo ok"}</span>}
                      <button onClick={()=>startEdit(visit.id)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,padding:"4px 10px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer"}}>
                        <i className="ti ti-pencil" style={{fontSize:13}}/> Editar
                      </button>
                    </div>
                  </div>
                  {vis.map(item=>(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderTop:"0.5px solid var(--color-border-tertiary)",flexWrap:"wrap"}}>
                      <TypeBadge type={item.type}/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                      <span style={{fontSize:13,color:"var(--color-text-primary)",flex:1,minWidth:120}}>{item.description}</span>
                      {(item.photos||[]).length>0&&<span style={{fontSize:11,color:"var(--color-text-tertiary)",display:"flex",alignItems:"center",gap:3}}><i className="ti ti-photo" style={{fontSize:12}}/>{item.photos.length}</span>}
                      {(item.comments||[]).length>0&&<span style={{fontSize:11,color:"var(--color-text-tertiary)",display:"flex",alignItems:"center",gap:3}}><i className="ti ti-message-circle" style={{fontSize:12}}/>{item.comments.length}</span>}
                      {item.status==="abierto"?<button onClick={()=>resolveItem(item.id)} style={{fontSize:11,padding:"2px 8px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",flexShrink:0}}>✓ Resolver</button>:<span style={{fontSize:11,color:"var(--color-text-success)",fontWeight:500}}>✓ Resuelto</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* NEW VISIT */}
        {view==="newvisit" && (
          <div style={{padding:"28px",maxWidth:680}}>
            <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 22px"}}>Nueva Visita</h1>
            <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"20px",marginBottom:20}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5}}>Local *</label>
                  <select value={nvLocId} onChange={e=>setNvLocId(e.target.value)} style={baseInp}>
                    <option value="">Seleccioná un local</option>
                    {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5}}>Fecha *</label>
                  <input type="date" value={nvDate} onChange={e=>setNvDate(e.target.value)} style={baseInp}/>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Notas generales</label>
                <BulletNotes bullets={nvBullets} onChange={setNvBullets}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Fotos de la visita</label>
                <PhotoPicker photos={nvPhotos} onChange={setNvPhotos}/>
              </div>
            </div>
            {prevOpen.length>0 && <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px",marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                <i className="ti ti-history" style={{fontSize:14}}/>Pendientes anteriores — marcá los resueltos hoy
              </div>
              {prevOpen.map(item=>{const v=visits.find(v=>v.id===item.visitId);return(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderTop:"0.5px solid var(--color-border-tertiary)",flexWrap:"wrap"}}>
                  <TypeBadge type={item.type}/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                  <span style={{fontSize:13,flex:1,minWidth:120,color:"var(--color-text-primary)"}}>{item.description}</span>
                  <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{fmt(v?.date)}</span>
                  <button onClick={()=>resolveItem(item.id)} style={{fontSize:11,padding:"3px 10px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",flexShrink:0}}>✓ Resolver</button>
                </div>
              );})}
            </div>}
            <div style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",marginBottom:10}}>Agregar ítems</div>
            <InlineAddItem {...sharedTAProps} onAdd={item=>setNvItems(p=>[...p,item])}/>
            {nvItems.length>0 && <div style={{marginTop:10,marginBottom:16}}>
              {nvItems.map((item,idx)=>(
                <div key={item.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <TypeBadge type={item.type}/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                    <span style={{fontSize:13,flex:1,minWidth:120,color:"var(--color-text-primary)"}}>{item.description}</span>
                    <button onClick={()=>setNvItems(p=>p.filter((_,i)=>i!==idx))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:14,padding:2,flexShrink:0}}><i className="ti ti-x"/></button>
                  </div>
                  <PhotoStrip photos={item.photos}/>
                </div>
              ))}
            </div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setView("dashboard")} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:14}}>Cancelar</button>
              <button onClick={submitVisit} disabled={!nvLocId} style={{padding:"8px 22px",background:nvLocId?"var(--color-background-warning)":"var(--color-background-secondary)",color:nvLocId?"var(--color-text-warning)":"var(--color-text-tertiary)",border:`0.5px solid ${nvLocId?"var(--color-border-warning)":"var(--color-border-tertiary)"}`,borderRadius:"var(--border-radius-md)",cursor:nvLocId?"pointer":"not-allowed",fontSize:14,fontWeight:500}}>Guardar visita</button>
            </div>
          </div>
        )}

        {/* EDIT VISIT */}
        {view==="editvisit" && editVid && (
          <div style={{padding:"28px",maxWidth:700}}>
            <button onClick={()=>setView("location")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:13,padding:"0 0 14px",display:"flex",alignItems:"center",gap:4}}>
              <i className="ti ti-arrow-left" style={{fontSize:13}}/> {editLoc?.name||"Volver"}
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <h1 style={{fontSize:22,fontWeight:500,margin:0}}>Editar Visita</h1>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>setView("location")} style={{padding:"7px 14px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13}}>Cancelar</button>
                <button onClick={saveEdit} style={{padding:"7px 16px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,fontWeight:500}}>Guardar cambios</button>
              </div>
            </div>
            <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"20px",marginBottom:20}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5}}>Fecha</label>
                  <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={baseInp}/>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}>
                  <div style={{fontSize:12,color:"var(--color-text-tertiary)"}}>Local: <span style={{color:"var(--color-text-primary)",fontWeight:500}}>{editLoc?.name}</span></div>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Notas generales</label>
                <BulletNotes bullets={editBullets} onChange={setEditBullets}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Fotos de la visita</label>
                <PhotoPicker photos={editPhotos} onChange={setEditPhotos}/>
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Ítems ({editItems.filter(i=>!editDelIds.has(i.id)).length})</div>
            {editItems.filter(i=>!editDelIds.has(i.id)).map(item=>(
              <div key={item.id} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"12px 14px",marginBottom:8}}>
                {editItemId===item.id ? (
                  <div>
                    <InlineTypeAreaSelects type={eiType} setType={setEiType} area={eiArea} setArea={setEiArea}
                      allFormAreas={allFormAreas} allTypeOptions={allTypeOptions} {...sharedTAProps}/>
                    <input value={eiDesc} onChange={e=>setEiDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEditItem(item.id)}
                      style={{...smlInp,marginBottom:10}} placeholder="Descripción…"/>
                    <div style={{marginBottom:10}}>
                      <label style={{fontSize:11,color:"var(--color-text-secondary)",display:"block",marginBottom:5}}>Fotos</label>
                      <PhotoPicker photos={eiPhotos} onChange={setEiPhotos} compact/>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditItemId(null)} style={{padding:"5px 12px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:12}}>Cancelar</button>
                      <button onClick={()=>saveEditItem(item.id)} style={{padding:"5px 14px",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:12,fontWeight:500}}>✓ Guardar ítem</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <TypeBadge type={item.type}/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                      <span style={{fontSize:13,flex:1,minWidth:120,color:"var(--color-text-primary)"}}>{item.description}</span>
                      {item.status==="resuelto"&&<span style={{fontSize:11,color:"var(--color-text-success)",fontWeight:500}}>✓ Resuelto</span>}
                      <button onClick={()=>startEditItem(item)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:13,padding:"2px 4px"}}><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                      <button onClick={()=>deleteEditItem(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-danger)",fontSize:13,padding:"2px 4px"}}><i className="ti ti-trash" style={{fontSize:13}}/></button>
                    </div>
                    <PhotoStrip photos={item.photos}/>
                  </div>
                )}
              </div>
            ))}
            {showAddInEdit ? (
              <div style={{marginTop:8}}><InlineAddItem {...sharedTAProps} onAdd={addEditItem} onCancel={()=>setShowAddInEdit(false)} showCancel/></div>
            ) : (
              <button onClick={()=>setShowAddInEdit(true)} style={{width:"100%",padding:"9px",marginTop:8,border:"0.5px dashed var(--color-border-secondary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <i className="ti ti-plus" style={{fontSize:14}}/> Agregar ítem
              </button>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
              <button onClick={()=>setView("location")} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:14}}>Cancelar</button>
              <button onClick={saveEdit} style={{padding:"8px 22px",background:"var(--color-background-warning)",color:"var(--color-text-warning)",border:"0.5px solid var(--color-border-warning)",borderRadius:"var(--border-radius-md)",cursor:"pointer",fontSize:14,fontWeight:500}}>Guardar cambios</button>
            </div>
          </div>
        )}

        {/* PENDING */}
        {view==="pending" && (
          <div style={{padding:"28px",maxWidth:760}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <h1 style={{fontSize:22,fontWeight:500,margin:"0 0 4px"}}>Pendientes</h1>
                <div style={{fontSize:13,color:"var(--color-text-tertiary)",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  {pendFiltered.length} ítem{pendFiltered.length!==1?"s":""}
                  {fArea&&<><span>·</span><AreaChip area={fArea} size="sm"/></>}
                  {fType&&<><span>·</span><span>{allTypeOptions.find(t=>t.key===fType)?.label||fType}</span></>}
                  {fLoc&&<><span>·</span><span>{locations.find(l=>l.id===fLoc)?.name}</span></>}
                </div>
              </div>
              {(fArea||fType||fLoc)&&<button onClick={()=>{setFArea("");setFType("");setFLoc("");}}
                style={{fontSize:12,padding:"5px 12px",border:"0.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-secondary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                <i className="ti ti-x" style={{fontSize:12}}/> Limpiar
              </button>}
            </div>
            {allAreas.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16,paddingBottom:16,borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <button onClick={()=>setFArea("")} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:`0.5px solid ${!fArea?"var(--color-border-primary)":"var(--color-border-tertiary)"}`,background:!fArea?"var(--color-background-secondary)":"transparent",color:"var(--color-text-secondary)",cursor:"pointer",fontWeight:!fArea?500:400}}>Todas</button>
              {allAreas.map(area=>{const c=areaColor(area);const active=fArea===area;return(
                <button key={area} onClick={()=>setFArea(active?"":area)}
                  style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:`0.5px solid ${active?"transparent":"var(--color-border-tertiary)"}`,background:active?c.bg:"transparent",color:active?c.fg:"var(--color-text-secondary)",cursor:"pointer",fontWeight:active?500:400}}>{area}</button>
              );})}
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <select value={fType} onChange={e=>setFType(e.target.value)} style={smlInp}>
                <option value="">Todos los tipos</option>
                {allTypeOptions.filter(t=>allItemTypes.includes(t.key)).map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={smlInp}>
                <option value="">Todos los locales</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {pendFiltered.length===0 ? (
              <div style={{textAlign:"center",padding:"48px",color:"var(--color-text-secondary)",fontSize:14,background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}>
                {openItems.length===0?"¡Sin pendientes! Todo al día. ✓":"Sin resultados con los filtros aplicados."}
              </div>
            ) : pendFiltered.map(item=>{
              const loc=locations.find(l=>l.id===item.locationId);const v=visits.find(v=>v.id===item.visitId);
              return <ItemCard key={item.id} item={item} locationName={loc?.name} visitDate={v?.date} onResolve={resolveItem} onAddComment={addComment} onEditItem={editItemText}/>;
            })}
          </div>
        )}

      </main>
    </div>
  );
}
