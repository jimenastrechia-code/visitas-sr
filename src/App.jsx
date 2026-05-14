import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";

const USERS = [
  { id:"seba", name:"Seba", avatar:"S", color:"#6366f1" },
  { id:"dani", name:"Dani", avatar:"D", color:"#f59e0b" },
  { id:"jime", name:"Jime", avatar:"J", color:"#10b981" },
];
const PALETTE = {
  indigo: { bg:"#eef2ff", fg:"#4338ca", border:"#c7d2fe" },
  amber:  { bg:"#fffbeb", fg:"#b45309", border:"#fcd34d" },
  green:  { bg:"#f0fdf4", fg:"#166534", border:"#86efac" },
  red:    { bg:"#fef2f2", fg:"#b91c1c", border:"#fca5a5" },
  sky:    { bg:"#f0f9ff", fg:"#0369a1", border:"#7dd3fc" },
  purple: { bg:"#faf5ff", fg:"#7e22ce", border:"#d8b4fe" },
  rose:   { bg:"#fff1f2", fg:"#be123c", border:"#fda4af" },
  teal:   { bg:"#f0fdfa", fg:"#115e59", border:"#5eead4" },
  orange: { bg:"#fff7ed", fg:"#c2410c", border:"#fdba74" },
  gray:   { bg:"#f9fafb", fg:"#374151", border:"#d1d5db" },
};
const AREA_PAL = ["indigo","amber","green","red","sky","purple","rose","teal","orange","gray"];
const TYPE_PAL = { analisis:"sky", dolor:"red", pendiente:"amber" };
const AREAS_DEFAULT = ["Abastecimiento","Calidad","Comercial","Finanzas","IT","Legal","Logística","Marketing","Operaciones","RRHH","Seguridad"];
const ITEM_TYPES = { analisis:"Punto de análisis", dolor:"Dolor", pendiente:"Pendiente de área" };
const TYPE_ICON  = { analisis:"ti-chart-line", dolor:"ti-alert-circle", pendiente:"ti-clock" };

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const fmt   = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtS  = d => d ? new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short"}) : "—";
const areaPal = area => { const i=[...(area||"")].reduce((a,c)=>a+c.charCodeAt(0),0); return PALETTE[AREA_PAL[i%AREA_PAL.length]]; };
const typePal = type => PALETTE[TYPE_PAL[type]||"gray"];

/* Firebase */
const uCol = (uid,col) => collection(db,`users/${uid}/${col}`);
const uDoc = (uid,col,id) => doc(db,`users/${uid}/${col}/${id}`);
const uCfg = uid => doc(db,`users/${uid}/config/main`);
const fbSet = async (uid,col,id,data) => { try { await setDoc(uDoc(uid,col,id),data); } catch(e){console.error(e);} };
const fbSetCfg = async (uid,data) => { try { await setDoc(uCfg(uid),data); } catch(e){console.error(e);} };

/* Image compress */
async function compressImage(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX=700, s=Math.min(1,MAX/Math.max(img.width,img.height));
        const c=document.createElement("canvas");
        c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg",0.68));
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  });
}

/* ── Atoms ── */
function Badge({label,palette,icon,size="md"}) {
  const p=palette||PALETTE.gray, pad=size==="sm"?"1px 7px":"3px 10px";
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:p.bg,color:p.fg,border:`1px solid ${p.border}`,fontSize:11,fontWeight:600,padding:pad,borderRadius:20,whiteSpace:"nowrap"}}>
    {icon&&<i className={`ti ${icon}`} style={{fontSize:11}}/>}{label}
  </span>;
}
const TypeBadge = ({type,size="md"}) => <Badge label={ITEM_TYPES[type]||type} palette={typePal(type)} icon={TYPE_ICON[type]||"ti-tag"} size={size}/>;
const AreaChip  = ({area,size="md"}) => <Badge label={area} palette={areaPal(area)} size={size}/>;

function StatCard({label,value,icon,palette,onClick}) {
  const p=palette||PALETTE.gray;
  return <div onClick={onClick} style={{background:p.bg,border:`1px solid ${p.border}`,borderRadius:12,padding:"16px 18px",cursor:onClick?"pointer":"default"}}>
    <div style={{fontSize:12,color:p.fg,fontWeight:500,marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
      <i className={`ti ${icon}`} style={{fontSize:14}}/>{label}
    </div>
    <div style={{fontSize:28,fontWeight:700,color:p.fg}}>{value}</div>
  </div>;
}

function PhotoPicker({photos=[],onChange,compact=false}) {
  const ref=useRef(); const sz=compact?52:68;
  async function handleFiles(e) {
    const files=Array.from(e.target.files); if(!files.length)return;
    const compressed=await Promise.all(files.map(compressImage));
    onChange([...photos,...compressed.map((d,i)=>({id:genId(),dataUrl:d,name:files[i].name}))]);
    e.target.value="";
  }
  return <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
    {photos.map(p=><div key={p.id} style={{position:"relative",width:sz,height:sz,flexShrink:0}}>
      <img src={p.dataUrl} alt={p.name} onClick={()=>window.open(p.dataUrl,"_blank")}
        style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:8,cursor:"pointer",border:"1px solid #e5e7eb"}}/>
      <button onClick={()=>onChange(photos.filter(x=>x.id!==p.id))}
        style={{position:"absolute",top:-5,right:-5,width:18,height:18,borderRadius:"50%",background:"#111",color:"#fff",border:"none",cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
    </div>)}
    <label style={{width:sz,height:sz,border:"1.5px dashed #d1d5db",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#9ca3af",gap:2,flexShrink:0,background:"#f9fafb"}}>
      <i className="ti ti-camera-plus" style={{fontSize:compact?16:20}}/>
      {!compact&&<span style={{fontSize:10}}>Foto</span>}
      <input ref={ref} type="file" accept="image/*" multiple onChange={handleFiles} style={{display:"none"}}/>
    </label>
  </div>;
}
function PhotoStrip({photos=[]}) {
  if(!photos?.length)return null;
  return <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
    {photos.map(p=><img key={p.id} src={p.dataUrl} alt={p.name} onClick={()=>window.open(p.dataUrl,"_blank")}
      style={{width:56,height:56,objectFit:"cover",borderRadius:8,cursor:"pointer",border:"1px solid #e5e7eb"}}/>)}
  </div>;
}

function BulletNotes({bullets,onChange,placeholder="Agregar punto…"}) {
  const refs=useRef([]);
  const update=(i,v)=>{const n=[...bullets];n[i]=v;onChange(n);};
  const addAfter=i=>{const n=[...bullets];n.splice(i+1,0,"");onChange(n);setTimeout(()=>refs.current[i+1]?.focus(),30);};
  const removeAt=i=>{if(bullets.length===1){onChange([""]);return;}const n=[...bullets];n.splice(i,1);onChange(n);setTimeout(()=>refs.current[Math.max(0,i-1)]?.focus(),30);};
  const onKey=(e,i)=>{if(e.key==="Enter"){e.preventDefault();addAfter(i);}if(e.key==="Backspace"&&bullets[i]===""&&bullets.length>1){e.preventDefault();removeAt(i);}};
  return <div style={{background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb",padding:"10px 12px"}}>
    {bullets.map((b,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<bullets.length-1?6:0}}>
      <span style={{color:"#6366f1",fontSize:16,userSelect:"none",flexShrink:0}}>•</span>
      <input ref={el=>refs.current[i]=el} value={b} onChange={e=>update(i,e.target.value)} onKeyDown={e=>onKey(e,i)}
        placeholder={i===0?placeholder:""}
        style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:13,color:"#111827",fontFamily:"inherit",padding:"2px 0"}}/>
      {bullets.length>1&&<button onClick={()=>removeAt(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:12,padding:"0 2px",flexShrink:0}}>✕</button>}
    </div>)}
    <button onClick={()=>addAfter(bullets.length-1)} style={{marginTop:8,fontSize:11,color:"#6366f1",background:"none",border:"none",cursor:"pointer",padding:"2px 0",display:"flex",alignItems:"center",gap:4,fontWeight:500}}>
      <i className="ti ti-plus" style={{fontSize:11}}/>Agregar punto
    </button>
  </div>;
}
function BulletDisplay({bullets}) {
  const items=(bullets||[]).filter(b=>b.trim());
  if(!items.length)return null;
  return <ul style={{margin:"6px 0 0",padding:"0 0 0 14px",listStyleType:"none"}}>
    {items.map((b,i)=><li key={i} style={{fontSize:13,color:"#4b5563",lineHeight:1.6,display:"flex",gap:8,alignItems:"baseline"}}>
      <span style={{color:"#6366f1",fontSize:14,flexShrink:0}}>•</span>{b}
    </li>)}
  </ul>;
}

function CommentThread({item,onAddComment,onResolve}) {
  const [text,setText]=useState("");
  const comments=item.comments||[];
  const submit=()=>{if(!text.trim())return;onAddComment(item.id,text);setText("");};
  return <div style={{borderTop:"1px solid #f3f4f6",paddingTop:12,marginTop:12}}>
    {comments.length>0&&<div style={{marginBottom:12}}>
      {comments.map(c=><div key={c.id} style={{display:"flex",gap:10,marginBottom:8}}>
        <div style={{width:3,flexShrink:0,background:"#e0e7ff",borderRadius:2}}/>
        <div>
          <div style={{fontSize:11,color:"#9ca3af",marginBottom:2}}>{fmt(c.date)}</div>
          <div style={{fontSize:13,color:"#374151",lineHeight:1.55}}>{c.text}</div>
        </div>
      </div>)}
    </div>}
    <div style={{display:"flex",gap:8}}>
      <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Agregar seguimiento o comentario…"
        style={{flex:1,fontSize:13,padding:"7px 11px",borderRadius:8,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#111827",fontFamily:"inherit"}}/>
      <button onClick={submit} disabled={!text.trim()}
        style={{padding:"7px 14px",fontSize:12,fontWeight:600,background:text.trim()?"#6366f1":"#f3f4f6",color:text.trim()?"#fff":"#9ca3af",border:"none",borderRadius:8,cursor:text.trim()?"pointer":"not-allowed"}}>Enviar</button>
    </div>
    {item.status==="abierto"&&onResolve&&<button onClick={()=>onResolve(item.id)}
      style={{marginTop:10,width:"100%",padding:"8px",fontSize:12,fontWeight:600,background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
      <i className="ti ti-check" style={{fontSize:13}}/>Marcar como resuelto
    </button>}
  </div>;
}

function ItemCard({item,locationName,visitDate,onResolve,onAddComment,onEditItem,showLocation=true}) {
  const [expanded,setExpanded]=useState(false);
  const [editing,setEditing]=useState(false);
  const [editDesc,setEditDesc]=useState(item.description);
  const comments=item.comments||[]; const p=typePal(item.type);
  const saveEdit=()=>{onEditItem(item.id,editDesc);setEditing(false);};
  return <div style={{background:"#fff",border:`1px solid ${item.status==="resuelto"?"#f3f4f6":p.border}`,borderRadius:12,padding:"14px 16px",marginBottom:8,opacity:item.status==="resuelto"?0.65:1,borderLeft:`3px solid ${item.status==="resuelto"?"#e5e7eb":p.fg}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
        <TypeBadge type={item.type}/>
        {item.area&&<AreaChip area={item.area}/>}
        {item.status==="resuelto"&&<Badge label="Resuelto" palette={PALETTE.green} icon="ti-check" size="sm"/>}
      </div>
      <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap",flexShrink:0}}>{fmtS(visitDate)}</span>
    </div>
    {editing?<div style={{marginBottom:10}}>
      <input value={editDesc} onChange={e=>setEditDesc(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditing(false);}}
        autoFocus style={{width:"100%",fontSize:14,padding:"7px 11px",borderRadius:8,border:"2px solid #6366f1",background:"#f9fafb",color:"#111827",fontFamily:"inherit",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
        <button onClick={()=>setEditing(false)} style={{fontSize:11,padding:"4px 12px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:6,cursor:"pointer"}}>Cancelar</button>
        <button onClick={saveEdit} style={{fontSize:11,padding:"4px 12px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:6,cursor:"pointer",fontWeight:600}}>✓ Guardar</button>
      </div>
    </div>:<div style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:6}}>
      <p style={{margin:0,fontSize:14,color:"#111827",lineHeight:1.55,flex:1}}>{item.description}</p>
      {item.status==="abierto"&&onEditItem&&<button onClick={()=>{setEditDesc(item.description);setEditing(true);}}
        style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af",padding:"2px",flexShrink:0}}>
        <i className="ti ti-pencil" style={{fontSize:13}}/>
      </button>}
    </div>}
    <PhotoStrip photos={item.photos}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        {showLocation&&locationName&&<span style={{fontSize:12,color:"#6b7280",display:"flex",alignItems:"center",gap:4}}>
          <i className="ti ti-building-store" style={{fontSize:12}}/>{locationName}
        </span>}
        <span style={{fontSize:12,color:"#9ca3af",display:"flex",alignItems:"center",gap:4}}>
          <i className="ti ti-calendar" style={{fontSize:12}}/>{fmt(visitDate)}
        </span>
      </div>
      <button onClick={()=>setExpanded(e=>!e)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,background:"none",border:"none",cursor:"pointer",color:"#6366f1",padding:0,fontWeight:500}}>
        <i className="ti ti-message-circle" style={{fontSize:13}}/>
        {comments.length>0?`${comments.length} comentario${comments.length>1?"s":""}` : "Comentar"}
        <i className={`ti ${expanded?"ti-chevron-up":"ti-chevron-down"}`} style={{fontSize:12}}/>
      </button>
    </div>
    {expanded&&<CommentThread item={item} onAddComment={onAddComment} onResolve={onResolve}/>}
  </div>;
}

function NavBtn({icon,label,active,badge,onClick,sub,color}) {
  return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:sub?"7px 16px 7px 34px":"9px 16px",background:active?"#eef2ff":"transparent",border:"none",borderLeft:active?`3px solid ${color||"#6366f1"}`:"3px solid transparent",cursor:"pointer",textAlign:"left",color:active?"#4338ca":"#6b7280",fontSize:sub?13:14,fontWeight:active?600:400}}>
    <i className={`ti ${icon}`} style={{fontSize:sub?14:16,color:active?(color||"#6366f1"):"inherit"}}/>
    <span style={{flex:1}}>{label}</span>
    {badge>0&&<span style={{fontSize:11,background:"#fef3c7",color:"#92400e",padding:"1px 8px",borderRadius:10,fontWeight:700,border:"1px solid #fcd34d"}}>{badge}</span>}
  </button>;
}

function InlineTA({type,setType,area,setArea,allFormAreas,allTypeOptions,areaAdding,setAreaAdding,areaNewVal,setAreaNewVal,confirmNewArea,typeAdding,setTypeAdding,typeNewVal,setTypeNewVal,confirmNewType}) {
  const inp={padding:"7px 11px",borderRadius:8,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#111827",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
    <div>
      <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4,fontWeight:500}}>Tipo</label>
      {typeAdding?<div style={{display:"flex",gap:4}}>
        <input autoFocus value={typeNewVal} onChange={e=>setTypeNewVal(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){const v=confirmNewType();if(v)setType(v);}if(e.key==="Escape"){setTypeAdding(false);setTypeNewVal("");}}}
          placeholder="Nuevo tipo…" style={{...inp,flex:1}}/>
        <button onClick={()=>{const v=confirmNewType();if(v)setType(v);}} style={{padding:"7px 10px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:8,cursor:"pointer"}}>✓</button>
        <button onClick={()=>{setTypeAdding(false);setTypeNewVal("");}} style={{padding:"7px 10px",background:"transparent",border:"1px solid #e5e7eb",color:"#6b7280",borderRadius:8,cursor:"pointer"}}>✕</button>
      </div>:<select value={type} onChange={e=>{if(e.target.value==="__new__")setTypeAdding(true);else setType(e.target.value);}} style={inp}>
        {allTypeOptions.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
        <option value="__new__">＋ Agregar tipo nuevo…</option>
      </select>}
    </div>
    <div>
      <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4,fontWeight:500}}>Área (si aplica)</label>
      {areaAdding?<div style={{display:"flex",gap:4}}>
        <input autoFocus value={areaNewVal} onChange={e=>setAreaNewVal(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){const v=confirmNewArea();if(v)setArea(v);}if(e.key==="Escape"){setAreaAdding(false);setAreaNewVal("");}}}
          placeholder="Nueva área…" style={{...inp,flex:1}}/>
        <button onClick={()=>{const v=confirmNewArea();if(v)setArea(v);}} style={{padding:"7px 10px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:8,cursor:"pointer"}}>✓</button>
        <button onClick={()=>{setAreaAdding(false);setAreaNewVal("");}} style={{padding:"7px 10px",background:"transparent",border:"1px solid #e5e7eb",color:"#6b7280",borderRadius:8,cursor:"pointer"}}>✕</button>
      </div>:<select value={area} onChange={e=>{if(e.target.value==="__new__")setAreaAdding(true);else setArea(e.target.value);}} style={inp}>
        <option value="">Sin área</option>
        {allFormAreas.map(a=><option key={a} value={a}>{a}</option>)}
        <option value="__new__">＋ Agregar área nueva…</option>
      </select>}
    </div>
  </div>;
}

function InlineAddItem({allFormAreas,allTypeOptions,onAdd,onCancel,showCancel=false,...shared}) {
  const [type,setType]=useState("analisis");
  const [area,setArea]=useState("");
  const [desc,setDesc]=useState("");
  const [photos,setPhotos]=useState([]);
  const inp={padding:"7px 11px",borderRadius:8,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#111827",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const handleAdd=()=>{if(!desc.trim())return;onAdd({type,area,description:desc,photos});setType("analisis");setArea("");setDesc("");setPhotos([]);};
  return <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
    <InlineTA type={type} setType={setType} area={area} setArea={setArea} allFormAreas={allFormAreas} allTypeOptions={allTypeOptions} {...shared}/>
    <div style={{marginBottom:10}}><input value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()} placeholder="Descripción del ítem…" style={inp}/></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
      <PhotoPicker photos={photos} onChange={setPhotos} compact/>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        {showCancel&&<button onClick={onCancel} style={{padding:"7px 14px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancelar</button>}
        <button onClick={handleAdd} style={{padding:"7px 16px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}>
          <i className="ti ti-plus"/>Agregar
        </button>
      </div>
    </div>
  </div>;
}

const bInp={padding:"8px 12px",borderRadius:8,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#111827",fontSize:14,width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
const sInp={...bInp,fontSize:13,padding:"7px 11px"};

function LoginScreen({onSelect}) {
  return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#eef2ff 0%,#f0fdf4 100%)",fontFamily:"system-ui,sans-serif",padding:24}}>
    <div style={{marginBottom:40,textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:14,background:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 4px 14px rgba(99,102,241,.35)"}}>
        <i className="ti ti-building-store" style={{fontSize:26,color:"#fff"}}/>
      </div>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:"#6366f1",marginBottom:6}}>Regional SR</div>
      <div style={{fontSize:28,fontWeight:700,color:"#111827",marginBottom:6}}>Gestión de Visitas</div>
      <div style={{fontSize:15,color:"#6b7280"}}>¿Quién está ingresando?</div>
    </div>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
      {USERS.map(u=><button key={u.id} onClick={()=>onSelect(u)}
        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"28px 36px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,cursor:"pointer",minWidth:140,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:u.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"#fff",boxShadow:`0 4px 12px ${u.color}66`}}>{u.avatar}</div>
        <div style={{fontSize:17,fontWeight:600,color:"#111827"}}>{u.name}</div>
      </button>)}
    </div>
  </div>;
}

export default function App() {
  /* ── all hooks first, unconditionally ── */
  const [currentUser,setCurrentUser] = useState(null);
  const [loaded,setLoaded]           = useState(false);
  const unsubRef = useRef([]);

  const [locations,setLocations]     = useState([]);
  const [visits,setVisits]           = useState([]);
  const [items,setItems]             = useState([]);
  const [customAreas,setCustomAreas] = useState([]);
  const [customTypes,setCustomTypes] = useState([]);

  const [view,setView]               = useState("dashboard");
  const [selLocId,setSelLocId]       = useState(null);
  const [newLocName,setNewLocName]   = useState("");
  const [showAddLoc,setShowAddLoc]   = useState(false);
  const [editingLocId,setEditingLocId] = useState(null);
  const [editLocName,setEditLocName] = useState("");
  const [fArea,setFArea]             = useState("");
  const [fType,setFType]             = useState("");
  const [fLoc,setFLoc]               = useState("");
  const [showResolved,setShowResolved] = useState(false);
  const [nvLocId,setNvLocId]         = useState("");
  const [nvDate,setNvDate]           = useState(today());
  const [nvBullets,setNvBullets]     = useState([""]);
  const [nvPhotos,setNvPhotos]       = useState([]);
  const [nvItems,setNvItems]         = useState([]);
  const [areaAdding,setAreaAdding]   = useState(false);
  const [areaNewVal,setAreaNewVal]   = useState("");
  const [typeAdding,setTypeAdding]   = useState(false);
  const [typeNewVal,setTypeNewVal]   = useState("");
  const [editVid,setEditVid]         = useState(null);
  const [editDate,setEditDate]       = useState("");
  const [editBullets,setEditBullets] = useState([""]);
  const [editPhotos,setEditPhotos]   = useState([]);
  const [editItems,setEditItems]     = useState([]);
  const [editDelIds,setEditDelIds]   = useState(new Set());
  const [editItemId,setEditItemId]   = useState(null);
  const [eiType,setEiType]           = useState("");
  const [eiArea,setEiArea]           = useState("");
  const [eiDesc,setEiDesc]           = useState("");
  const [eiPhotos,setEiPhotos]       = useState([]);
  const [showAddInEdit,setShowAddInEdit] = useState(false);
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [isMobile,setIsMobile]       = useState(false);

  useEffect(()=>{
    const check=()=>{ const m=window.innerWidth<640; setIsMobile(m); if(!m)setSidebarOpen(true); };
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>()=>unsubRef.current.forEach(fn=>fn()),[]);

  /* ── actions ── */
  function selectUser(u) {
    unsubRef.current.forEach(fn=>fn());
    setCurrentUser(u);
    setLocations([]); setVisits([]); setItems([]);
    setCustomAreas([]); setCustomTypes([]);
    setLoaded(true);
    setView("dashboard");
    const uid=u.id;
    unsubRef.current=[
      onSnapshot(uCol(uid,"locations"), s=>setLocations(s.docs.map(d=>d.data())), e=>console.error(e)),
      onSnapshot(uCol(uid,"visits"),    s=>setVisits(s.docs.map(d=>d.data())),    e=>console.error(e)),
      onSnapshot(uCol(uid,"items"),     s=>setItems(s.docs.map(d=>d.data())),     e=>console.error(e)),
      onSnapshot(uCfg(uid), s=>{ if(s.exists()){const d=s.data();setCustomAreas(d.customAreas||[]);setCustomTypes(d.customTypes||[]);} }, e=>console.error(e)),
    ];
  }

  function logout() {
    unsubRef.current.forEach(fn=>fn()); unsubRef.current=[];
    setCurrentUser(null); setLoaded(false);
    setLocations([]); setVisits([]); setItems([]);
    setCustomAreas([]); setCustomTypes([]);
  }

  function navAndClose(fn) { fn(); if(isMobile) setSidebarOpen(false); }

  const uid=currentUser?.id;
  const allFormAreas=[...AREAS_DEFAULT,...customAreas];
  const allTypeOptions=[...Object.entries(ITEM_TYPES).map(([k,v])=>({key:k,label:v})),...customTypes.map(t=>({key:t,label:t}))];
  const allItemTypes=[...new Set(items.map(i=>i.type))];

  function confirmNewArea(){
    const val=areaNewVal.trim(); setAreaAdding(false); setAreaNewVal("");
    if(!val)return null;
    const n=[...AREAS_DEFAULT,...customAreas].includes(val)?customAreas:[...customAreas,val];
    setCustomAreas(n); fbSetCfg(uid,{customAreas:n,customTypes}); return val;
  }
  function confirmNewType(){
    const val=typeNewVal.trim(); setTypeAdding(false); setTypeNewVal("");
    if(!val)return null;
    const n=[...Object.keys(ITEM_TYPES),...customTypes].includes(val)?customTypes:[...customTypes,val];
    setCustomTypes(n); fbSetCfg(uid,{customAreas,customTypes:n}); return val;
  }
  const sharedTA={allFormAreas,allTypeOptions,areaAdding,setAreaAdding,areaNewVal,setAreaNewVal,confirmNewArea,typeAdding,setTypeAdding,typeNewVal,setTypeNewVal,confirmNewType};

  function addLocation(){
    if(!newLocName.trim())return;
    const loc={id:genId(),name:newLocName.trim()};
    fbSet(uid,"locations",loc.id,loc); setNewLocName(""); setShowAddLoc(false);
  }
  function saveLocName(id){
    if(!editLocName.trim())return;
    const loc=locations.find(l=>l.id===id); if(!loc)return;
    const u={...loc,name:editLocName.trim()};
    setLocations(p=>p.map(l=>l.id===id?u:l)); fbSet(uid,"locations",id,u); setEditingLocId(null);
  }
  async function submitVisit(){
    if(!nvLocId||!nvDate)return;
    const visitId=genId();
    const visit={id:visitId,locationId:nvLocId,date:nvDate,bullets:nvBullets,photos:nvPhotos};
    const newItems=nvItems.map(it=>({...it,id:genId(),visitId,locationId:nvLocId,createdAt:nvDate,status:"abierto",comments:[]}));
    const batch=writeBatch(db);
    batch.set(doc(db,`users/${uid}/visits/${visitId}`),visit);
    newItems.forEach(it=>batch.set(doc(db,`users/${uid}/items/${it.id}`),it));
    await batch.commit();
    setNvItems([]); setNvBullets([""]); setNvDate(today()); setNvPhotos([]);
    setSelLocId(nvLocId); setView("location");
  }
  function resolveItem(id){
    const it=items.find(i=>i.id===id); if(!it)return;
    const u={...it,status:"resuelto",resolvedAt:today()};
    setItems(p=>p.map(i=>i.id===id?u:i)); fbSet(uid,"items",id,u);
  }
  function addComment(itemId,text){
    const it=items.find(i=>i.id===itemId); if(!it)return;
    const c={id:genId(),text:text.trim(),date:today()};
    const u={...it,comments:[...(it.comments||[]),c]};
    setItems(p=>p.map(i=>i.id===itemId?u:i)); fbSet(uid,"items",itemId,u);
  }
  function editItemText(itemId,newDesc){
    const it=items.find(i=>i.id===itemId); if(!it)return;
    const u={...it,description:newDesc};
    setItems(p=>p.map(i=>i.id===itemId?u:i)); fbSet(uid,"items",itemId,u);
  }
  function startEdit(visitId){
    const v=visits.find(v=>v.id===visitId); if(!v)return;
    setEditVid(visitId); setEditDate(v.date);
    setEditBullets(v.bullets?.length?v.bullets:[v.notes||""]);
    setEditPhotos(v.photos||[]);
    setEditItems(items.filter(i=>i.visitId===visitId).map(i=>({...i})));
    setEditDelIds(new Set()); setEditItemId(null); setShowAddInEdit(false);
    setView("editvisit");
  }
  function startEditItem(it){setEditItemId(it.id);setEiType(it.type);setEiArea(it.area||"");setEiDesc(it.description);setEiPhotos(it.photos||[]);}
  function saveEditItem(id){setEditItems(p=>p.map(it=>it.id===id?{...it,type:eiType,area:eiArea,description:eiDesc,photos:eiPhotos}:it));setEditItemId(null);}
  function deleteEditItem(id){setEditDelIds(p=>new Set([...p,id]));if(editItemId===id)setEditItemId(null);}
  function addEditItem(item){
    setEditItems(p=>[...p,{...item,id:genId(),visitId:editVid,locationId:visits.find(v=>v.id===editVid)?.locationId,createdAt:editDate,status:"abierto",comments:[]}]);
    setShowAddInEdit(false);
  }
  async function saveEdit(){
    const orig=visits.find(v=>v.id===editVid);
    const updV={...orig,date:editDate,bullets:editBullets,photos:editPhotos};
    const kept=editItems.filter(i=>!editDelIds.has(i.id));
    const batch=writeBatch(db);
    batch.set(doc(db,`users/${uid}/visits/${editVid}`),updV);
    kept.forEach(it=>batch.set(doc(db,`users/${uid}/items/${it.id}`),it));
    editDelIds.forEach(id=>batch.delete(doc(db,`users/${uid}/items/${id}`)));
    await batch.commit();
    setVisits(p=>p.map(v=>v.id===editVid?updV:v));
    setItems(p=>[...p.filter(i=>i.visitId!==editVid),...kept]);
    setView("location");
  }

  /* derived */
  const openItems=items.filter(i=>i.status==="abierto");
  const resolvedItems=items.filter(i=>i.status==="resuelto");
  const allAreas=[...new Set(openItems.filter(i=>i.area).map(i=>i.area))].sort();
  const allResolvedAreas=[...new Set(resolvedItems.filter(i=>i.area).map(i=>i.area))].sort();
  const selLoc=locations.find(l=>l.id===selLocId);
  const locVisits=selLoc?visits.filter(v=>v.locationId===selLocId).sort((a,b)=>b.date.localeCompare(a.date)):[];
  const locOpen=selLoc?items.filter(i=>i.locationId===selLocId&&i.status==="abierto"):[];
  const prevOpen=nvLocId?items.filter(i=>i.locationId===nvLocId&&i.status==="abierto"):[];
  const editLoc=editVid?locations.find(l=>l.id===visits.find(v=>v.id===editVid)?.locationId):null;
  const pendFiltered=openItems.filter(i=>!fArea||i.area===fArea).filter(i=>!fType||i.type===fType).filter(i=>!fLoc||i.locationId===fLoc).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const resolvedFiltered=resolvedItems.filter(i=>!fArea||i.area===fArea).filter(i=>!fLoc||i.locationId===fLoc).sort((a,b)=>(b.resolvedAt||b.createdAt||"").localeCompare(a.resolvedAt||a.createdAt||""));
  const allAnalysis=items.filter(i=>i.type==="analisis").filter(i=>!fLoc||i.locationId===fLoc).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  /* ── conditional renders ── */
  if(!currentUser) return <LoginScreen onSelect={selectUser}/>;

  const SL=({children})=><div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#9ca3af",padding:"8px 18px 4px"}}>{children}</div>;

  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"system-ui,sans-serif",background:"#f8f9fb",position:"relative"}}>

      {/* overlay mobile */}
      {sidebarOpen&&isMobile&&<div onClick={()=>setSidebarOpen(false)}
        style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:40}}/>}

      {/* hamburger */}
      <button onClick={()=>setSidebarOpen(o=>!o)}
        style={{position:"fixed",top:12,left:12,zIndex:50,width:36,height:36,borderRadius:9,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 1px 4px rgba(0,0,0,.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#374151"}}>
        <i className={`ti ${sidebarOpen?"ti-x":"ti-menu-2"}`} style={{fontSize:17}}/>
      </button>

      {/* sidebar */}
      <aside style={{width:228,background:"#fff",borderRight:"1px solid #f3f4f6",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"2px 0 8px rgba(0,0,0,.06)",position:isMobile?"fixed":"sticky",top:0,left:0,height:"100vh",zIndex:45,transform:sidebarOpen?"translateX(0)":"translateX(-100%)",transition:"transform .22s ease"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #f3f4f6",paddingLeft:56}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#9ca3af",marginBottom:10}}>Regional SR</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:currentUser.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{currentUser.avatar}</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#111827"}}>{currentUser.name}</div>
              <button onClick={logout} style={{fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:3,marginTop:1}}>
                <i className="ti ti-logout" style={{fontSize:11}}/>Cambiar usuario
              </button>
            </div>
          </div>
        </div>
        <nav style={{flex:1,paddingTop:6,overflowY:"auto"}}>
          <SL>General</SL>
          <NavBtn icon="ti-layout-dashboard" label="Inicio" active={view==="dashboard"} onClick={()=>navAndClose(()=>setView("dashboard"))} color={currentUser.color}/>
          <NavBtn icon="ti-building-store" label="Mis Locales" active={["locations","location","editvisit"].includes(view)} onClick={()=>navAndClose(()=>setView("locations"))} color={currentUser.color}/>
          <div style={{height:"1px",background:"#f3f4f6",margin:"8px 0"}}/>
          <SL>Seguimiento</SL>
          <NavBtn icon="ti-clock-exclamation" label="Pendientes" active={view==="pending"&&!showResolved} badge={openItems.length}
            onClick={()=>navAndClose(()=>{setFArea("");setFType("");setFLoc("");setShowResolved(false);setView("pending");})} color={currentUser.color}/>
          <NavBtn icon="ti-circle-check" label="Historial resueltos" active={view==="pending"&&showResolved} badge={resolvedItems.length}
            onClick={()=>navAndClose(()=>{setFArea("");setFType("");setFLoc("");setShowResolved(true);setView("pending");})} color="#10b981"/>
          <NavBtn icon="ti-chart-line" label="Histórico análisis" active={view==="analisis"} onClick={()=>navAndClose(()=>{setFLoc("");setView("analisis");})} color="#6366f1"/>
          {!showResolved&&allAreas.slice(0,6).map(area=>{
            const n=openItems.filter(i=>i.area===area).length;
            return <NavBtn key={area} icon="ti-tag" label={area} sub active={view==="pending"&&fArea===area&&!showResolved} badge={n}
              onClick={()=>navAndClose(()=>{setFArea(area);setFType("");setFLoc("");setShowResolved(false);setView("pending");})}/>;
          })}
          <div style={{height:"1px",background:"#f3f4f6",margin:"8px 0"}}/>
          <NavBtn icon="ti-calendar-plus" label="Nueva Visita" active={view==="newvisit"} onClick={()=>navAndClose(()=>{setNvLocId("");setView("newvisit");})} color={currentUser.color}/>
        </nav>
        <div style={{padding:"12px 18px",borderTop:"1px solid #f3f4f6"}}>
          <div style={{fontSize:11,color:"#9ca3af"}}>{locations.length} locales · {visits.length} visitas</div>
        </div>
      </aside>

      {/* main */}
      <main style={{flex:1,overflow:"auto",paddingTop:isMobile?52:0}}>

        {/* DASHBOARD */}
        {view==="dashboard"&&(
          <div style={{padding:"28px",maxWidth:780}}>
            <div style={{marginBottom:24,paddingTop:isMobile?0:0}}>
              <h1 style={{fontSize:24,fontWeight:700,margin:"0 0 4px",color:"#111827",paddingLeft:isMobile?0:48}}>Inicio</h1>
              <div style={{fontSize:14,color:"#6b7280",paddingLeft:isMobile?0:48}}>Bienvenido, {currentUser.name}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:28}}>
              <StatCard label="Locales activos" value={locations.length} icon="ti-building-store" palette={PALETTE.indigo}/>
              <StatCard label="Visitas totales" value={visits.length} icon="ti-calendar-event" palette={PALETTE.sky}/>
              <StatCard label="Pendientes abiertos" value={openItems.length} icon="ti-clock-exclamation" palette={openItems.length>0?PALETTE.amber:PALETTE.green}
                onClick={()=>{setFArea("");setFType("");setFLoc("");setShowResolved(false);setView("pending");}}/>
              <StatCard label="Resueltos" value={resolvedItems.length} icon="ti-circle-check" palette={PALETTE.green}
                onClick={()=>{setFArea("");setFType("");setFLoc("");setShowResolved(true);setView("pending");}}/>
            </div>
            {allAreas.length>0&&<div style={{marginBottom:28}}>
              <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Pendientes por área</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
                {allAreas.map(area=>{const n=openItems.filter(i=>i.area===area).length;const p=areaPal(area);return(
                  <button key={area} onClick={()=>{setFArea(area);setFType("");setFLoc("");setShowResolved(false);setView("pending");}}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:p.bg,border:`1px solid ${p.border}`,borderRadius:10,cursor:"pointer",textAlign:"left"}}>
                    <span style={{fontSize:13,color:p.fg,fontWeight:600}}>{area}</span>
                    <span style={{background:"#fff",color:p.fg,fontSize:12,padding:"2px 10px",borderRadius:10,fontWeight:700,border:`1px solid ${p.border}`}}>{n}</span>
                  </button>
                );})}
              </div>
            </div>}
            {allResolvedAreas.length>0&&<div style={{marginBottom:28}}>
              <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Resueltos por área</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {allResolvedAreas.map(area=>{const n=resolvedItems.filter(i=>i.area===area).length;const p=areaPal(area);return(
                  <button key={area} onClick={()=>{setFArea(area);setFLoc("");setShowResolved(true);setView("pending");}}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:20,cursor:"pointer"}}>
                    <span style={{fontSize:12,color:"#374151",fontWeight:500}}>{area}</span>
                    <span style={{background:p.bg,color:p.fg,fontSize:11,padding:"0 7px",borderRadius:10,fontWeight:700,border:`1px solid ${p.border}`}}>{n}</span>
                  </button>
                );})}
              </div>
            </div>}
            {openItems.length>0&&<div>
              <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Últimos pendientes</div>
              {[...openItems].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,4).map(item=>{
                const loc=locations.find(l=>l.id===item.locationId);const v=visits.find(v=>v.id===item.visitId);
                return <ItemCard key={item.id} item={item} locationName={loc?.name} visitDate={v?.date} onResolve={resolveItem} onAddComment={addComment} onEditItem={editItemText}/>;
              })}
              {openItems.length>4&&<button onClick={()=>{setFArea("");setFType("");setFLoc("");setShowResolved(false);setView("pending");}}
                style={{width:"100%",padding:"10px",border:"1.5px dashed #c7d2fe",background:"#eef2ff",color:"#4338ca",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600}}>
                Ver todos los pendientes ({openItems.length}) ↗
              </button>}
            </div>}
            {locations.length===0&&<div style={{textAlign:"center",padding:"60px 24px",background:"#f0f9ff",borderRadius:16,border:"1px dashed #7dd3fc"}}>
              <i className="ti ti-building-store" style={{fontSize:40,display:"block",marginBottom:12,color:"#7dd3fc"}}/>
              <p style={{margin:"0 0 16px",fontSize:15,color:"#6b7280"}}>Agregá tu primer local para comenzar</p>
              <button onClick={()=>setView("locations")} style={{padding:"9px 22px",borderRadius:9,border:"none",background:"#6366f1",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600}}>Agregar local ↗</button>
            </div>}
          </div>
        )}

        {/* LOCATIONS */}
        {view==="locations"&&(
          <div style={{padding:"28px",maxWidth:740}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,paddingLeft:isMobile?0:48}}>
              <h1 style={{fontSize:22,fontWeight:700,margin:0,color:"#111827"}}>Mis Locales</h1>
              <button onClick={()=>setShowAddLoc(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>
                <i className="ti ti-plus" style={{fontSize:14}}/> Agregar local
              </button>
            </div>
            {showAddLoc&&<div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10,color:"#374151"}}>Nuevo local</div>
              <div style={{display:"flex",gap:8}}>
                <input value={newLocName} onChange={e=>setNewLocName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()} placeholder="Nombre del local" style={{...bInp,flex:1}} autoFocus/>
                <button onClick={addLocation} style={{padding:"8px 18px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>Guardar</button>
                <button onClick={()=>{setShowAddLoc(false);setNewLocName("");}} style={{padding:"8px 12px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer"}}>✕</button>
              </div>
            </div>}
            {locations.length===0&&!showAddLoc&&<div style={{textAlign:"center",padding:"48px",color:"#9ca3af",fontSize:14}}>Aún no hay locales.</div>}
            {locations.map(loc=>{
              const lv=visits.filter(v=>v.locationId===loc.id);
              const lo=openItems.filter(i=>i.locationId===loc.id).length;
              const lr=resolvedItems.filter(i=>i.locationId===loc.id).length;
              const last=[...lv].sort((a,b)=>b.date.localeCompare(a.date))[0];
              const ap=[...new Set(openItems.filter(i=>i.locationId===loc.id&&i.area).map(i=>i.area))];
              return <div key={loc.id} style={{background:"#fff",border:"1px solid #f3f4f6",borderRadius:12,padding:"14px 16px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                {editingLocId===loc.id?<div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input value={editLocName} onChange={e=>setEditLocName(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")saveLocName(loc.id);if(e.key==="Escape")setEditingLocId(null);}}
                    autoFocus style={{...bInp,flex:1,fontSize:15,fontWeight:600}}/>
                  <button onClick={()=>saveLocName(loc.id)} style={{padding:"8px 16px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>✓ Guardar</button>
                  <button onClick={()=>setEditingLocId(null)} style={{padding:"8px 10px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer"}}>✕</button>
                </div>:<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>{setSelLocId(loc.id);setView("location");}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <span style={{fontSize:15,fontWeight:700,color:"#111827"}}>{loc.name}</span>
                      <button onClick={e=>{e.stopPropagation();setEditingLocId(loc.id);setEditLocName(loc.name);}}
                        style={{display:"flex",alignItems:"center",gap:4,fontSize:11,padding:"2px 8px",borderRadius:6,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#6b7280",cursor:"pointer",fontWeight:500}}>
                        <i className="ti ti-pencil" style={{fontSize:11}}/>Renombrar
                      </button>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:12,color:"#9ca3af"}}>{lv.length} visita{lv.length!==1?"s":""}{last?` · última: ${fmt(last.date)}`:" · sin visitas"}</span>
                      {lr>0&&<span style={{fontSize:11,color:"#166534",background:"#f0fdf4",padding:"1px 7px",borderRadius:10,border:"1px solid #86efac",fontWeight:600}}>✓ {lr} resueltos</span>}
                      {ap.map(a=><AreaChip key={a} area={a} size="sm"/>)}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    {lo>0&&<span style={{fontSize:12,background:"#fef3c7",color:"#92400e",padding:"3px 10px",borderRadius:10,fontWeight:700,border:"1px solid #fcd34d"}}>{lo}</span>}
                    <i className="ti ti-chevron-right" style={{fontSize:16,color:"#d1d5db"}}/>
                  </div>
                </div>}
              </div>;
            })}
          </div>
        )}

        {/* LOCATION DETAIL */}
        {view==="location"&&selLoc&&(
          <div style={{padding:"28px",maxWidth:740}}>
            <button onClick={()=>setView("locations")} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:13,padding:"0 0 14px",display:"flex",alignItems:"center",gap:4,fontWeight:500,paddingLeft:isMobile?0:48}}>
              <i className="ti ti-arrow-left" style={{fontSize:13}}/> Locales
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <h1 style={{fontSize:22,fontWeight:700,margin:0,color:"#111827"}}>{selLoc.name}</h1>
                  <button onClick={()=>{setView("locations");setEditingLocId(selLoc.id);setEditLocName(selLoc.name);}}
                    style={{display:"flex",alignItems:"center",gap:4,fontSize:11,padding:"3px 8px",borderRadius:6,border:"1px solid #e5e7eb",background:"#f9fafb",color:"#6b7280",cursor:"pointer",fontWeight:500}}>
                    <i className="ti ti-pencil" style={{fontSize:11}}/>Renombrar
                  </button>
                </div>
                <div style={{fontSize:13,color:"#9ca3af"}}>{locVisits.length} visita{locVisits.length!==1?"s":""} · {locOpen.length} pendiente{locOpen.length!==1?"s":""}</div>
              </div>
              <button onClick={()=>{setNvLocId(selLoc.id);setView("newvisit");}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,flexShrink:0}}>
                <i className="ti ti-plus" style={{fontSize:14}}/> Nueva visita
              </button>
            </div>
            {locOpen.length>0&&<div style={{marginBottom:28}}>
              <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Pendientes abiertos ({locOpen.length})</div>
              {locOpen.map(item=>{const v=visits.find(v=>v.id===item.visitId);return <ItemCard key={item.id} item={item} visitDate={v?.date} onResolve={resolveItem} onAddComment={addComment} onEditItem={editItemText} showLocation={false}/>;})}</div>}
            <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Historial de visitas</div>
            {locVisits.length===0&&<div style={{textAlign:"center",padding:"32px",color:"#9ca3af",fontSize:14,background:"#f9fafb",borderRadius:12,border:"1px dashed #e5e7eb"}}>Aún no hay visitas registradas.</div>}
            {locVisits.map(visit=>{
              const vis=items.filter(i=>i.visitId===visit.id);
              const oc=vis.filter(i=>i.status==="abierto").length;
              const bl=visit.bullets?.length?visit.bullets.filter(b=>b.trim()):(visit.notes?[visit.notes]:[]);
              return <div key={visit.id} style={{background:"#fff",border:"1px solid #f3f4f6",borderRadius:12,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:vis.length?10:0}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:bl.length?4:0}}>{fmt(visit.date)}</div>
                    <BulletDisplay bullets={bl}/><PhotoStrip photos={visit.photos}/>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:12}}>
                    {vis.length>0&&<span style={{fontSize:11,fontWeight:600,color:oc>0?"#b45309":"#166534",background:oc>0?"#fffbeb":"#f0fdf4",padding:"2px 8px",borderRadius:8,border:`1px solid ${oc>0?"#fcd34d":"#86efac"}`}}>{oc>0?`${oc} abierto${oc!==1?"s":""}` :"✓ Todo ok"}</span>}
                    <button onClick={()=>startEdit(visit.id)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,padding:"5px 11px",border:"1px solid #e5e7eb",background:"#f9fafb",color:"#6b7280",borderRadius:7,cursor:"pointer",fontWeight:500}}>
                      <i className="ti ti-pencil" style={{fontSize:12}}/> Editar
                    </button>
                  </div>
                </div>
                {vis.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderTop:"1px solid #f9fafb",flexWrap:"wrap"}}>
                  <TypeBadge type={item.type} size="sm"/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                  <span style={{fontSize:13,color:"#374151",flex:1,minWidth:120}}>{item.description}</span>
                  {(item.photos||[]).length>0&&<span style={{fontSize:11,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><i className="ti ti-photo" style={{fontSize:12}}/>{item.photos.length}</span>}
                  {(item.comments||[]).length>0&&<span style={{fontSize:11,color:"#9ca3af",display:"flex",alignItems:"center",gap:3}}><i className="ti ti-message-circle" style={{fontSize:12}}/>{item.comments.length}</span>}
                  {item.status==="abierto"?<button onClick={()=>resolveItem(item.id)} style={{fontSize:11,padding:"2px 9px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:6,cursor:"pointer",flexShrink:0,fontWeight:600}}>✓ Resolver</button>:<span style={{fontSize:11,color:"#166534",fontWeight:700}}>✓ Resuelto</span>}
                </div>)}
              </div>;
            })}
          </div>
        )}

        {/* NEW VISIT */}
        {view==="newvisit"&&(
          <div style={{padding:"28px",maxWidth:680}}>
            <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 22px",color:"#111827",paddingLeft:isMobile?0:48}}>Nueva Visita</h1>
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px",marginBottom:20,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Local *</label>
                  <select value={nvLocId} onChange={e=>setNvLocId(e.target.value)} style={bInp}>
                    <option value="">Seleccioná un local</option>
                    {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Fecha *</label>
                  <input type="date" value={nvDate} onChange={e=>setNvDate(e.target.value)} style={bInp}/>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Notas generales</label>
                <BulletNotes bullets={nvBullets} onChange={setNvBullets}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Fotos de la visita</label>
                <PhotoPicker photos={nvPhotos} onChange={setNvPhotos}/>
              </div>
            </div>
            {prevOpen.length>0&&<div style={{background:"#fffbeb",borderRadius:12,padding:"16px",marginBottom:20,border:"1px solid #fcd34d"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#92400e",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                <i className="ti ti-history" style={{fontSize:14}}/>Pendientes anteriores — marcá los resueltos hoy
              </div>
              {prevOpen.map(item=>{const v=visits.find(v=>v.id===item.visitId);return(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderTop:"1px solid #fde68a",flexWrap:"wrap"}}>
                  <TypeBadge type={item.type} size="sm"/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                  <span style={{fontSize:13,flex:1,minWidth:120,color:"#374151"}}>{item.description}</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>{fmt(v?.date)}</span>
                  <button onClick={()=>resolveItem(item.id)} style={{fontSize:11,padding:"3px 10px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:6,cursor:"pointer",flexShrink:0,fontWeight:600}}>✓ Resolver</button>
                </div>
              );})}
            </div>}
            <div style={{fontSize:14,fontWeight:700,color:"#374151",marginBottom:10}}>Agregar ítems</div>
            <InlineAddItem {...sharedTA} onAdd={item=>setNvItems(p=>[...p,item])}/>
            {nvItems.length>0&&<div style={{marginTop:10,marginBottom:16}}>
              {nvItems.map((item,idx)=><div key={item.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 14px",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <TypeBadge type={item.type} size="sm"/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                  <span style={{fontSize:13,flex:1,minWidth:120,color:"#374151"}}>{item.description}</span>
                  <button onClick={()=>setNvItems(p=>p.filter((_,i)=>i!==idx))} style={{background:"none",border:"none",cursor:"pointer",color:"#d1d5db",fontSize:14,padding:2,flexShrink:0}}><i className="ti ti-x"/></button>
                </div>
                <PhotoStrip photos={item.photos}/>
              </div>)}
            </div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setView("dashboard")} style={{padding:"9px 18px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:500}}>Cancelar</button>
              <button onClick={submitVisit} disabled={!nvLocId} style={{padding:"9px 24px",background:nvLocId?"#6366f1":"#f3f4f6",color:nvLocId?"#fff":"#9ca3af",border:"none",borderRadius:8,cursor:nvLocId?"pointer":"not-allowed",fontSize:14,fontWeight:700}}>Guardar visita</button>
            </div>
          </div>
        )}

        {/* EDIT VISIT */}
        {view==="editvisit"&&editVid&&(
          <div style={{padding:"28px",maxWidth:700}}>
            <button onClick={()=>setView("location")} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:13,padding:"0 0 14px",display:"flex",alignItems:"center",gap:4,fontWeight:500}}>
              <i className="ti ti-arrow-left" style={{fontSize:13}}/> {editLoc?.name||"Volver"}
            </button>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <h1 style={{fontSize:22,fontWeight:700,margin:0,color:"#111827"}}>Editar Visita</h1>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>setView("location")} style={{padding:"8px 16px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancelar</button>
                <button onClick={saveEdit} style={{padding:"8px 18px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700}}>Guardar cambios</button>
              </div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px",marginBottom:20}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5}}>Fecha</label>
                  <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={bInp}/>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}>
                  <div style={{fontSize:12,color:"#9ca3af"}}>Local: <span style={{color:"#374151",fontWeight:600}}>{editLoc?.name}</span></div>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Notas generales</label>
                <BulletNotes bullets={editBullets} onChange={setEditBullets}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:6}}>Fotos de la visita</label>
                <PhotoPicker photos={editPhotos} onChange={setEditPhotos}/>
              </div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Ítems ({editItems.filter(i=>!editDelIds.has(i.id)).length})</div>
            {editItems.filter(i=>!editDelIds.has(i.id)).map(item=>(
              <div key={item.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                {editItemId===item.id?<div>
                  <InlineTA type={eiType} setType={setEiType} area={eiArea} setArea={setEiArea} allFormAreas={allFormAreas} allTypeOptions={allTypeOptions} {...sharedTA}/>
                  <input value={eiDesc} onChange={e=>setEiDesc(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEditItem(item.id)} style={{...sInp,marginBottom:10}} placeholder="Descripción…"/>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:5,fontWeight:500}}>Fotos</label>
                    <PhotoPicker photos={eiPhotos} onChange={setEiPhotos} compact/>
                  </div>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button onClick={()=>setEditItemId(null)} style={{padding:"5px 12px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:7,cursor:"pointer",fontSize:12}}>Cancelar</button>
                    <button onClick={()=>saveEditItem(item.id)} style={{padding:"5px 14px",background:"#f0fdf4",color:"#166534",border:"1px solid #86efac",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Guardar ítem</button>
                  </div>
                </div>:<div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <TypeBadge type={item.type} size="sm"/>{item.area&&<AreaChip area={item.area} size="sm"/>}
                    <span style={{fontSize:13,flex:1,minWidth:120,color:"#374151"}}>{item.description}</span>
                    {item.status==="resuelto"&&<span style={{fontSize:11,color:"#166534",fontWeight:700}}>✓ Resuelto</span>}
                    <button onClick={()=>startEditItem(item)} style={{background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontSize:13,padding:"2px 4px"}}><i className="ti ti-pencil" style={{fontSize:13}}/></button>
                    <button onClick={()=>deleteEditItem(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:13,padding:"2px 4px"}}><i className="ti ti-trash" style={{fontSize:13}}/></button>
                  </div>
                  <PhotoStrip photos={item.photos}/>
                </div>}
              </div>
            ))}
            {showAddInEdit?<div style={{marginTop:8}}><InlineAddItem {...sharedTA} onAdd={addEditItem} onCancel={()=>setShowAddInEdit(false)} showCancel/></div>
            :<button onClick={()=>setShowAddInEdit(true)} style={{width:"100%",padding:"10px",marginTop:8,border:"1.5px dashed #c7d2fe",background:"#eef2ff",color:"#4338ca",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <i className="ti ti-plus" style={{fontSize:14}}/> Agregar ítem
            </button>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:"1px solid #f3f4f6"}}>
              <button onClick={()=>setView("location")} style={{padding:"9px 18px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:8,cursor:"pointer",fontSize:14}}>Cancelar</button>
              <button onClick={saveEdit} style={{padding:"9px 24px",background:"#6366f1",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:700}}>Guardar cambios</button>
            </div>
          </div>
        )}

        {/* PENDING / RESOLVED */}
        {view==="pending"&&(
          <div style={{padding:"28px",maxWidth:760}}>
            <div style={{display:"flex",gap:0,marginBottom:22,background:"#f3f4f6",borderRadius:10,padding:4,width:"fit-content"}}>
              <button onClick={()=>setShowResolved(false)} style={{padding:"7px 18px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:!showResolved?"#fff":"transparent",color:!showResolved?"#4338ca":"#9ca3af",boxShadow:!showResolved?"0 1px 3px rgba(0,0,0,.1)":"none"}}>
                <i className="ti ti-clock" style={{fontSize:12,marginRight:5}}/>Abiertos ({openItems.length})
              </button>
              <button onClick={()=>setShowResolved(true)} style={{padding:"7px 18px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:showResolved?"#fff":"transparent",color:showResolved?"#166534":"#9ca3af",boxShadow:showResolved?"0 1px 3px rgba(0,0,0,.1)":"none"}}>
                <i className="ti ti-circle-check" style={{fontSize:12,marginRight:5}}/>Resueltos ({resolvedItems.length})
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div style={{fontSize:13,color:"#6b7280",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                {(showResolved?resolvedFiltered:pendFiltered).length} ítem{(showResolved?resolvedFiltered:pendFiltered).length!==1?"s":""}
                {fArea&&<><span>·</span><AreaChip area={fArea} size="sm"/></>}
                {fLoc&&<><span>·</span><span>{locations.find(l=>l.id===fLoc)?.name}</span></>}
              </div>
              {(fArea||fType||fLoc)&&<button onClick={()=>{setFArea("");setFType("");setFLoc("");}}
                style={{fontSize:12,padding:"5px 12px",border:"1px solid #e5e7eb",background:"transparent",color:"#6b7280",borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontWeight:500}}>
                <i className="ti ti-x" style={{fontSize:12}}/> Limpiar
              </button>}
            </div>
            {(showResolved?allResolvedAreas:allAreas).length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16,paddingBottom:16,borderBottom:"1px solid #f3f4f6"}}>
              <button onClick={()=>setFArea("")} style={{fontSize:12,padding:"4px 13px",borderRadius:20,border:`1px solid ${!fArea?"#6366f1":"#e5e7eb"}`,background:!fArea?"#eef2ff":"transparent",color:!fArea?"#4338ca":"#6b7280",cursor:"pointer",fontWeight:!fArea?700:400}}>Todas</button>
              {(showResolved?allResolvedAreas:allAreas).map(area=>{const p=areaPal(area);const active=fArea===area;return(
                <button key={area} onClick={()=>setFArea(active?"":area)}
                  style={{fontSize:12,padding:"4px 13px",borderRadius:20,border:`1px solid ${active?p.border:"#e5e7eb"}`,background:active?p.bg:"transparent",color:active?p.fg:"#6b7280",cursor:"pointer",fontWeight:active?700:400}}>{area}</button>
              );})}
            </div>}
            {!showResolved&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <select value={fType} onChange={e=>setFType(e.target.value)} style={sInp}>
                <option value="">Todos los tipos</option>
                {allTypeOptions.filter(t=>allItemTypes.includes(t.key)).map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={sInp}>
                <option value="">Todos los locales</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>}
            {showResolved&&<div style={{marginBottom:20}}>
              <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={{...sInp,maxWidth:280}}>
                <option value="">Todos los locales</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>}
            {(showResolved?resolvedFiltered:pendFiltered).length===0?
              <div style={{textAlign:"center",padding:"48px",color:"#9ca3af",fontSize:14,background:"#f9fafb",borderRadius:12,border:"1px dashed #e5e7eb"}}>
                {showResolved?"No hay ítems resueltos con estos filtros.":(openItems.length===0?"¡Sin pendientes! Todo al día. ✓":"Sin resultados con los filtros aplicados.")}
              </div>
            :(showResolved?resolvedFiltered:pendFiltered).map(item=>{
              const loc=locations.find(l=>l.id===item.locationId);const v=visits.find(v=>v.id===item.visitId);
              return <ItemCard key={item.id} item={item} locationName={loc?.name} visitDate={v?.date}
                onResolve={!showResolved?resolveItem:undefined} onAddComment={addComment} onEditItem={!showResolved?editItemText:undefined}/>;
            })}
          </div>
        )}

        {/* HISTÓRICO ANÁLISIS */}
        {view==="analisis"&&(
          <div style={{padding:"28px",maxWidth:760}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
              <div>
                <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 4px",color:"#111827"}}>Histórico de Análisis</h1>
                <div style={{fontSize:13,color:"#6b7280"}}>Todos los puntos de análisis registrados</div>
              </div>
              <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={{...sInp,width:"auto",minWidth:180}}>
                <option value="">Todos los locales</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {allAnalysis.length>0&&<div style={{marginBottom:24}}>
              <div style={{fontSize:12,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Análisis por local</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {locations.filter(l=>items.some(i=>i.type==="analisis"&&i.locationId===l.id)).map(loc=>{
                  const n=items.filter(i=>i.type==="analisis"&&i.locationId===loc.id).length;
                  return <button key={loc.id} onClick={()=>setFLoc(fLoc===loc.id?"":loc.id)}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",background:fLoc===loc.id?"#eef2ff":"#f9fafb",border:`1px solid ${fLoc===loc.id?"#c7d2fe":"#e5e7eb"}`,borderRadius:20,cursor:"pointer"}}>
                    <span style={{fontSize:13,color:fLoc===loc.id?"#4338ca":"#374151",fontWeight:fLoc===loc.id?700:400}}>{loc.name}</span>
                    <span style={{fontSize:11,background:fLoc===loc.id?"#c7d2fe":"#e5e7eb",color:fLoc===loc.id?"#4338ca":"#6b7280",padding:"0 7px",borderRadius:10,fontWeight:700}}>{n}</span>
                  </button>;
                })}
              </div>
            </div>}
            {allAnalysis.length===0?
              <div style={{textAlign:"center",padding:"48px",color:"#9ca3af",fontSize:14,background:"#f9fafb",borderRadius:12,border:"1px dashed #e5e7eb"}}>Aún no hay puntos de análisis registrados.</div>
            :allAnalysis.map(item=>{
              const loc=locations.find(l=>l.id===item.locationId);const v=visits.find(v=>v.id===item.visitId);
              return <div key={item.id} style={{background:"#fff",border:"1px solid #e0e7ff",borderLeft:"3px solid #6366f1",borderRadius:12,padding:"14px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {loc&&<span style={{fontSize:12,color:"#4338ca",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-building-store" style={{fontSize:12}}/>{loc.name}</span>}
                    {item.status==="resuelto"&&<Badge label="Resuelto" palette={PALETTE.green} icon="ti-check" size="sm"/>}
                  </div>
                  <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap",flexShrink:0}}>{fmt(v?.date)}</span>
                </div>
                <p style={{margin:"0 0 6px",fontSize:14,color:"#111827",lineHeight:1.55}}>{item.description}</p>
                <PhotoStrip photos={item.photos}/>
                {(item.comments||[]).length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #f0f0ff"}}>
                  {item.comments.map(c=><div key={c.id} style={{display:"flex",gap:8,marginBottom:4}}>
                    <div style={{width:2,flexShrink:0,background:"#e0e7ff",borderRadius:2}}/>
                    <div><span style={{fontSize:11,color:"#9ca3af",marginRight:8}}>{fmt(c.date)}</span><span style={{fontSize:13,color:"#374151"}}>{c.text}</span></div>
                  </div>)}
                </div>}
              </div>;
            })}
          </div>
        )}

      </main>
    </div>
  );
}
