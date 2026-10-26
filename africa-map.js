import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
const host=document.getElementById('africa-map');
const status=document.getElementById('map-status');
const countries=new Set(['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Democratic Republic of the Congo','Republic of the Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','Sao Tome and Principe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe','Western Sahara']);
const aliases={'Côte d’Ivoire':'Ivory Coast',"Côte d'Ivoire":'Ivory Coast','Dem. Rep. Congo':'Democratic Republic of the Congo','Democratic Republic of Congo':'Democratic Republic of the Congo','Congo':'Republic of the Congo','Central African Rep.':'Central African Republic','S. Sudan':'South Sudan','eSwatini':'Eswatini','Cape Verde':'Cabo Verde','The Gambia':'Gambia','United Republic of Tanzania':'Tanzania','Somaliland':'Somalia'};
const overrides={'Ivory Coast':'CI','Democratic Republic of the Congo':'CD','Republic of the Congo':'CG','Eswatini':'SZ','Cabo Verde':'CV','Sao Tome and Principe':'ST','Tanzania':'TZ','Western Sahara':'EH'};
const display=new Intl.DisplayNames(['en'],{type:'region'});
const codes=['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'];
const byName=new Map(codes.map(code=>[display.of(code).toLowerCase(),code]));
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,200);
camera.position.set(0,0,35);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
host.append(renderer.domElement);
const group=new THREE.Group();scene.add(group);
group.rotation.x=-0.30;group.rotation.y=-0.12;
const zoomLimits={min:0.8,max:3.5};
const pan=new THREE.Vector2();
function clampPan(){
  const halfWidth=(camera.right-camera.left)/(2*camera.zoom);
  const halfHeight=(camera.top-camera.bottom)/(2*camera.zoom);
  const maxX=Math.max(0,(mapSize.x/2)-halfWidth*0.4);
  const maxY=Math.max(0,(mapSize.y/2)-halfHeight*0.4);
  pan.x=THREE.MathUtils.clamp(pan.x,-maxX,maxX);
  pan.y=THREE.MathUtils.clamp(pan.y,-maxY,maxY);
  group.position.x=mapCentre.x+pan.x;
  group.position.y=mapCentre.y+pan.y;
}
function setZoom(value){camera.zoom=THREE.MathUtils.clamp(value,zoomLimits.min,zoomLimits.max);camera.updateProjectionMatrix();if(camera.zoom<=1.01)pan.set(0,0);clampPan()}
function zoomBy(factor){setZoom(camera.zoom*factor)}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const targets=[];
const countryGroups=new Map();
let hoveredCode=null;
let broadcastCode=null;
let broadcastName='';
let pendingBroadcast=null;
const broadcastLabel=document.createElement('div');broadcastLabel.className='map-broadcast-label';broadcastLabel.hidden=true;host.append(broadcastLabel);
const broadcastClock=new THREE.Clock();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tooltip=document.createElement('div');tooltip.className='map-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;host.append(tooltip);
const bounds=new THREE.Box3();
let mapSize=new THREE.Vector3(17,17,0);
const mapCentre=new THREE.Vector2();
let selected=null,drag=false,down=null,frame=0;
function countryCode(name){return overrides[name]||byName.get(name.toLowerCase())}
function points(ring){return ring.map(([lon,lat])=>new THREE.Vector2((lon-18)*.22,(lat-2)*.22))}
function addPolygon(ring,name,code){
  if(ring.length<4)return;
  const outline=points(ring);
  let country=countryGroups.get(code);
  if(!country){country={group:new THREE.Group(),meshes:[],borders:[],rings:[],tracer:null,tracerPath:null,equaliser:[],lift:0,target:0,name,code};countryGroups.set(code,country);group.add(country.group)}
  const shape=new THREE.Shape(outline);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:0.20,bevelEnabled:false,curveSegments:1}),[new THREE.MeshLambertMaterial({color:0x253c4d,side:THREE.DoubleSide}),new THREE.MeshLambertMaterial({color:0x15232e,side:THREE.DoubleSide})]);
  mesh.position.z=0;mesh.userData={name,code};
  country.group.add(mesh);country.meshes.push(mesh);targets.push(mesh);bounds.expandByObject(mesh);
  const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline.map(p=>new THREE.Vector3(p.x,p.y,.215))),new THREE.LineBasicMaterial({color:0xa67b39,transparent:true,opacity:.6}));
  country.group.add(border);country.borders.push(border);
}
function styleCountry(code){
  const country=countryGroups.get(code);if(!country)return;
  const hovered=hoveredCode===code;
  const live=broadcastCode===code;
  country.target=hovered?1.4:live?.65:0;
  for(const mesh of country.meshes){
    mesh.material[0].color.setHex(hovered?0xe0a84f:live?0xb58b39:0x253c4d);
    mesh.material[1].color.setHex(hovered?0x80501b:live?0x5e451e:0x15232e);
  }
  for(const border of country.borders){
    border.material.color.setHex(hovered?0xffd079:live?0xf8c76c:0xa67b39);
    border.material.opacity=hovered||live?1:.6;
  }
}
function setHover(code){
  if(hoveredCode===code)return;
  const previous=hoveredCode;hoveredCode=code;
  if(previous)styleCountry(previous);
  if(code)styleCountry(code);
}
function setBroadcast(code,name){
  const next=countryGroups.has(code)?code:null;
  const previous=broadcastCode;
  broadcastCode=next;broadcastName=next?name:'';
  if(previous)styleCountry(previous);
  if(next)styleCountry(next);
  broadcastLabel.hidden=!next;
  if(next)broadcastLabel.textContent='● LIVE · '+countryGroups.get(next).name+' · '+broadcastName;
}
window.addEventListener('radio:playback',event=>{
  const {state,code,name}=event.detail||{};
  pendingBroadcast=(state==='playing'||state==='buffering')?{code,name:name||''}:null;
  setBroadcast(pendingBroadcast?.code||null,pendingBroadcast?.name||'');
});
function addBroadcastRings(country){
  const box=new THREE.Box3();
  for(const mesh of country.meshes)box.expandByObject(mesh);
  const centre=box.getCenter(new THREE.Vector3());
  const extent=box.getSize(new THREE.Vector3());
  const radius=Math.max(.13,Math.min(extent.x,extent.y)*.14);
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(radius*.85,radius,48),
      new THREE.MeshBasicMaterial({color:0xf4bc59,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false})
    );
    ring.position.set(centre.x,centre.y,.25);
    ring.renderOrder=3;
    country.group.add(ring);
    country.rings.push(ring);
  }
}

// Animate a beacon along the longest outline and simulated 3D equaliser bars.
function addLiveEffects(country){
  let longest=[];
  for(const border of country.borders){
    const coords=border.geometry.attributes.position;
    if(coords.count>longest.length)longest=Array.from({length:coords.count},(_,i)=>new THREE.Vector3(coords.getX(i),coords.getY(i),.34));
  }
  if(longest.length>2){
    country.tracerPath=longest;
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.095,10,8),new THREE.MeshBasicMaterial({color:0xffd477,depthTest:false}));
    dot.renderOrder=7;dot.visible=false;country.group.add(dot);country.tracer=dot;
  }
  const box=new THREE.Box3();
  for(const mesh of country.meshes)box.expandByObject(mesh);
  const centre=box.getCenter(new THREE.Vector3());
  const width=Math.max(.45,Math.min(box.getSize(new THREE.Vector3()).x*.6,2));
  for(let i=0;i<7;i++){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(width/12,.55,.11),new THREE.MeshBasicMaterial({color:i%2?0xf4b84e:0xffd477,transparent:true,opacity:.9,depthTest:false}));
    bar.position.set(centre.x+(i-3)*width/8,centre.y,.45);
    bar.renderOrder=6;bar.visible=false;country.group.add(bar);country.equaliser.push(bar);
  }
}

function setSelected(mesh){
  if(!mesh)return;
  selected=mesh;
  status.textContent=mesh.userData.name+' selected · Showing stations';
  window.dispatchEvent(new CustomEvent('radio:country',{detail:{code:mesh.userData.code,name:mesh.userData.name}}));
}
function hitTest(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(targets)[0]?.object||null}
function pick(event){const hit=hitTest(event);if(hit)setSelected(hit)}
function hover(event){if(down||!targets.length){tooltip.hidden=true;setHover(null);return}const hit=hitTest(event);setHover(hit?.userData.code||null);tooltip.hidden=!hit;renderer.domElement.style.cursor=hit?'pointer':'grab';if(!hit)return;tooltip.textContent=hit.userData.name;const rect=host.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(event.clientX-rect.left+14,rect.width-tooltip.offsetWidth-8))+'px';tooltip.style.top=Math.max(8,Math.min(event.clientY-rect.top-36,rect.height-40))+'px'}
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*0.0012))},{passive:false});
document.getElementById('map-zoom-in').addEventListener('click',()=>zoomBy(1.25));
document.getElementById('map-zoom-out').addEventListener('click',()=>zoomBy(1/1.25));
document.getElementById('map-zoom-reset').addEventListener('click',()=>{pan.set(0,0);setZoom(1)});
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,mode:camera.zoom>1.01&&!e.shiftKey?'pan':'rotate'};drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!down){hover(e);return}
  tooltip.hidden=true;setHover(null);
  const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;
  down.lastX=e.clientX;down.lastY=e.clientY;
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)drag=true;
  if(!drag)return;
  if(down.mode==='pan'){
    const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight;
    pan.x+=dx*(camera.right-camera.left)/(width*camera.zoom);
    pan.y-=dy*(camera.top-camera.bottom)/(height*camera.zoom);
    clampPan();
  }else{
    group.rotation.y=THREE.MathUtils.clamp(group.rotation.y+dx*.003,-.45,.45);
    group.rotation.x=THREE.MathUtils.clamp(group.rotation.x+dy*.003,-.55,.55);
  }
});
renderer.domElement.addEventListener('pointerup',e=>{if(!drag)pick(e);down=null;hover(e)});
renderer.domElement.addEventListener('pointerleave',()=>{tooltip.hidden=true;setHover(null)});
renderer.domElement.addEventListener('pointercancel',()=>{down=null;drag=false;setHover(null);tooltip.hidden=true});
function resize(){
  const w=host.clientWidth,h=host.clientHeight;
  if(!w||!h)return;
  const aspect=w/h;
  // Fit both axes with padding. All polygons are centred around the geometry bounds.
  const halfHeight=Math.max(mapSize.y*0.62,mapSize.x*0.62/aspect,1);
  const halfWidth=halfHeight*aspect;
  camera.left=-halfWidth;camera.right=halfWidth;
  camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.position.set(0,0,35);camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();renderer.setSize(w,h);
  clampPan();
}
new ResizeObserver(resize).observe(host);resize();
const ambient=new THREE.AmbientLight(0xffffff,1.6);scene.add(ambient);
const keyLight=new THREE.DirectionalLight(0xffd7a0,1.5);keyLight.position.set(-7,12,18);scene.add(keyLight);
function animate(){
  frame=requestAnimationFrame(animate);
  const time=broadcastClock.getElapsedTime();
  for(const country of countryGroups.values()){
    country.lift=reducedMotion?country.target:country.lift+(country.target-country.lift)*.18;
    const live=country.code===broadcastCode;
    const pulse=live&&!reducedMotion?.12*Math.sin(time*2.8):0;
    country.group.position.z=country.lift+pulse;
    if(country.tracer){
      country.tracer.visible=live&&!reducedMotion;
      if(country.tracer.visible){
        const path=country.tracerPath;
        const position=(time*.65)%path.length;
        const index=Math.floor(position),next=(index+1)%path.length;
        country.tracer.position.copy(path[index]).lerp(path[next],position-index);
      }
    }
    for(let i=0;i<country.equaliser.length;i++){
      const bar=country.equaliser[i];bar.visible=live&&!reducedMotion;
      if(bar.visible)bar.scale.y=.35+.65*(.5+.5*Math.sin(time*(5+i*.27)+i*1.8));
    }
    for(let i=0;i<country.rings.length;i++){
      const ring=country.rings[i];
      ring.visible=live&&!reducedMotion;
      if(!ring.visible)continue;
      const phase=(time*.32+i/3)%1;
      ring.scale.setScalar(1+phase*5);
      ring.material.opacity=(1-phase)*.55;
    }
  }
  renderer.render(scene,camera);
}animate();
async function init(){try{const res=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');if(!res.ok)throw Error('Map data unavailable');const geo=await res.json();for(const feature of geo.features){const raw=feature.properties?.name||'';const name=aliases[raw]||raw;if(!countries.has(name))continue;const code=countryCode(name);if(!code)continue;const geometry=feature.geometry;if(!geometry)continue;const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];for(const polygon of polys){if(polygon[0])addPolygon(polygon[0],name,code)}}if(!targets.length)throw Error('No countries available');for(const country of countryGroups.values()){addBroadcastRings(country);addLiveEffects(country)}if(pendingBroadcast)setBroadcast(pendingBroadcast.code,pendingBroadcast.name);const centre=bounds.getCenter(new THREE.Vector3());mapSize=bounds.getSize(new THREE.Vector3());mapCentre.set(-centre.x,-centre.y);group.position.set(mapCentre.x,mapCentre.y,0);resize();status.textContent='Select a country on the 3D map to explore its stations';}catch(e){status.textContent='3D map data unavailable. Use the country selector below.';host.replaceChildren();cancelAnimationFrame(frame)}}
init();
