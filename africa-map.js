import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
const host=document.getElementById('africa-map');
const status=document.getElementById('map-status');
const countries=new Set(['Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon','Central African Republic','Chad','Comoros','Democratic Republic of the Congo','Republic of the Congo','Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea','Guinea-Bissau','Ivory Coast','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria','Rwanda','Sao Tome and Principe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe','Western Sahara']);
const aliases={'Côte d’Ivoire':'Ivory Coast',"Côte d'Ivoire":'Ivory Coast','Dem. Rep. Congo':'Democratic Republic of the Congo','Democratic Republic of Congo':'Democratic Republic of the Congo','Congo':'Republic of the Congo','Central African Rep.':'Central African Republic','S. Sudan':'South Sudan','eSwatini':'Eswatini','Cape Verde':'Cabo Verde','The Gambia':'Gambia','United Republic of Tanzania':'Tanzania','Somaliland':'Somalia'};
const overrides={'Ivory Coast':'CI','Democratic Republic of the Congo':'CD','Republic of the Congo':'CG','Eswatini':'SZ','Cabo Verde':'CV','Sao Tome and Principe':'ST','Tanzania':'TZ','Western Sahara':'EH'};
const display=new Intl.DisplayNames(['en'],{type:'region'});
const codes=['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'];
const byName=new Map(codes.map(code=>[display.of(code).toLowerCase(),code]));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,200);
camera.position.set(0,0,35);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
host.append(renderer.domElement);
const group=new THREE.Group();scene.add(group);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const targets=[];
let selected=null,drag=false,down=null,angle=0,frame=0;
function countryCode(name){return overrides[name]||byName.get(name.toLowerCase())}
function points(ring){return ring.map(([lon,lat])=>new THREE.Vector2((lon-18)*.22,(lat-2)*.22))}
function addPolygon(ring,name,code){if(ring.length<4)return;const outline=points(ring);const shape=new THREE.Shape(outline);const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0x253c4d,side:THREE.DoubleSide,transparent:true,opacity:.98}));mesh.position.z=.01;mesh.userData={name,code};group.add(mesh);targets.push(mesh);const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline.map(p=>new THREE.Vector3(p.x,p.y,.025))),new THREE.LineBasicMaterial({color:0xa67b39,transparent:true,opacity:.6}));group.add(border)}
function setSelected(mesh){if(selected)selected.material.color.setHex(0x253c4d);selected=mesh;if(mesh){mesh.material.color.setHex(0xb88a43);status.textContent=mesh.userData.name+' selected · Showing stations';window.dispatchEvent(new CustomEvent('radio:country',{detail:{code:mesh.userData.code,name:mesh.userData.name}}))}}
function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(targets)[0];if(hit)setSelected(hit.object)}
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down.x;if(Math.abs(dx)>5||Math.abs(e.clientY-down.y)>5)drag=true;if(drag){group.rotation.y=Math.max(-.45,Math.min(.45,group.rotation.y+e.movementX*.003));group.rotation.x=Math.max(-.3,Math.min(.3,group.rotation.x+e.movementY*.003))}});
renderer.domElement.addEventListener('pointerup',e=>{if(!drag)pick(e);down=null});
function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);camera.position.z=w<500?46:35}
new ResizeObserver(resize).observe(host);resize();
function animate(){frame=requestAnimationFrame(animate);renderer.render(scene,camera)}animate();
async function init(){try{const res=await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');if(!res.ok)throw Error('Map data unavailable');const geo=await res.json();for(const feature of geo.features){const raw=feature.properties?.name||'';const name=aliases[raw]||raw;if(!countries.has(name))continue;const code=countryCode(name);if(!code)continue;const geometry=feature.geometry;if(!geometry)continue;const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];for(const polygon of polys){if(polygon[0])addPolygon(polygon[0],name,code)}}if(!targets.length)throw Error('No countries available');status.textContent='Select a country on the 3D map to explore its stations';}catch(e){status.textContent='3D map data unavailable. Use the country selector below.';host.replaceChildren();cancelAnimationFrame(frame)}}
init();
