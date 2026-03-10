import { useEffect } from "react";
import { S } from "../styles.js";

export function Sparkline({ data, color="#0ea5e9", invert=false }) {
  if(!data||data.length<2)return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1,w=72,h=26;
  const pts=data.map((v,i)=>{ const x=(i/(data.length-1))*w,y=invert?((v-min)/range)*h:h-((v-min)/range)*h; return `${x},${y}`; }).join(" ");
  const last=pts.split(" ").pop().split(",");
  return <svg width={w} height={h} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx={last[0]} cy={last[1]} r="3" fill={color}/></svg>;
}
export function StatPill({ label, value, color }) {
  return <div style={{background:color+"15",border:"1px solid "+(color)+"30",borderRadius:8,padding:"5px 10px",textAlign:"center"}}><div style={{color,fontWeight:700,fontSize:14}}>{value}</div><div style={{color:"#7a95b0",fontSize:10}}>{label}</div></div>;
}
export function FF({ label, children }) {
  return <div style={{marginBottom:12}}><label style={{display:"block",color:"#7a95b0",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{label}</label>{children}</div>;
}
export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,width:wide?660:440}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:0}}>{title}</h2>
          <button style={{background:"none",border:"none",color:"#7a95b0",cursor:"pointer",fontSize:20}} onClick={onClose}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Loader({ text="Chargement..." }) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",flexDirection:"column",gap:16}}>
    <div style={{width:40,height:40,border:"3px solid #1e293b",borderTop:"3px solid #22d3ee",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{color:"#7a95b0",fontSize:14}}>{text}</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
export function Toast({ message, type="success", onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2500); return()=>clearTimeout(t); },[]);
  return <div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#ef444420":"#4ade8020",border:`1px solid ${type==="error"?"#ef4444":"#4ade80"}`,color:type==="error"?"#ef4444":"#4ade80",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:700,zIndex:200,fontFamily:"'DM Mono',monospace"}}>{message}</div>;
}

// ==========================================================================================================================================================
// LOGIN
