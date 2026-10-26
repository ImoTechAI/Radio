import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
const modal=document.getElementById('player-expanded');
const stage=document.getElementById('expanded-stage');
const artwork=document.getElementById('expanded-art');
const label=document.getElementById('expanded-country');
const bars=document.getElementById('expanded-equaliser');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let playing=false,raf=0,renderer=null,scene=null,camera=null,rings=[],lastPointer=null;
function resetTilt(){stage.style.setProperty('--tilt-x','0deg');stage.style.setProperty('--tilt-y','0deg')}
function setPlaying(state){playing=state==='playing';modal.classList.toggle('is-live',playing);bars.setAttribute('aria-hidden','true');if(!playing)resetTilt()}
function setStation(code,name){
  let country='';
  if(code){try{country=new Intl.DisplayNames(['en'],{type:'region'}).of(code)}catch{country=code}}
  label.textContent=country?'● LIVE FROM '+country.toUpperCase():'';
  label.hidden=!country;
}
window.addEventListener('radio:playback',e=>{
  const d=e.detail||{};setPlaying(d.state);setStation(d.code,d.name);
});
window.addEventListener('radio:expanded',e=>{
  const open=!!e.detail?.open;
  if(open){start();setStation(e.detail?.code||null);setPlaying(e.detail?.state)}
  else stop();
});
stage.addEventListener('pointermove',e=>{
  if(reduced.matches||e.pointerType==='touch')return;
  const b=stage.getBoundingClientRect();
  const x=Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1));
  const y=Math.max(-1,Math.min(1,(e.clientY-b.top)/b.height*2-1));
  stage.style.setProperty('--tilt-x',(-y*7).toFixed(2)+'deg');
  stage.style.setProperty('--tilt-y',(x*9).toFixed(2)+'deg');
});
stage.addEventListener('pointerleave',resetTilt);
reduced.addEventListener('change',()=>{if(reduced.matches)resetTilt()});
function setup(){
  if(renderer)return;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    renderer.setSize(340,340,false);
    renderer.domElement.setAttribute('aria-hidden','true');
    renderer.domElement.className='expanded-three-canvas';
    stage.prepend(renderer.domElement);
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(38,1,.1,100);
    camera.position.z=8;
    for(let i=0;i<3;i++){
      const material=new THREE.MeshBasicMaterial({color:0xe7b457,transparent:true,opacity:0,depthWrite:false});
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.024,8,100),material);
      scene.add(ring);rings.push(ring);
    }
  }catch(err){renderer?.dispose();renderer=null;stage.classList.add('three-fallback')}
}
function tick(ms){
  if(modal.hidden){stop();return}
  if(renderer&&scene&&!reduced.matches){
    const t=ms*.001;
    rings.forEach((ring,i)=>{
      const phase=(t*.36+i/3)%1;
      ring.scale.setScalar(1+phase*.8);
      ring.material.opacity=playing?(1-phase)*.6:0;
      ring.rotation.x=Math.sin(t*.45)*.16;
      ring.rotation.y=Math.cos(t*.4)*.12;
    });
    renderer.render(scene,camera);
  }
  raf=requestAnimationFrame(tick);
}
function start(){if(raf)return;setup();raf=requestAnimationFrame(tick)}
function stop(){cancelAnimationFrame(raf);raf=0;resetTilt()}
