// Authored campaign blueprints: shared kit, distinct routes and encounter combinations.
export const box = (id, x, y, z, sx, sy, sz, kind = 'floor') =>
  ({ id, position: { x, y, z }, size: { x: sx, y: sy, z: sz }, kind });
export const SECTORS = [
  {"name":"Mahalleye Hoş Geldin","mechanic":"relay","route":["walk","jump","walk","sweeper"],"theme":"city","hint":"A: E basılı tut. Arkadaşın B terminalini kilitlesin. BOŞLUK ile zıpla."},
  {"name":"Muhtarın İki Düğmesi","mechanic":"plates","route":["stairs","jump","zig","pendulum"],"theme":"garden","hint":"İki farklı gezgin iki ağırlık plakasında aynı anda dursun."},
  {"name":"Dolmuşu Yakala","mechanic":"timed","route":["walk","dash","walk","drop"],"theme":"ruins","hint":"A düğmesi 3 saniye güç verir. Koşucu köprüde Q ile atılma yapıp B’ye ulaşsın."},
  {"name":"Pazar Yeri Panayırı","mechanic":"plates","route":["zig","stairs","jump","launch"],"theme":"market","hint":"Plakaları birlikte etkinleştir; iniş yüzeylerini sırayla takip et."},
  {"name":"Çatı Katı Molası","mechanic":"relay","route":["stairs","dash","zig","fake"],"theme":"garden","hint":"Operatörü geride bırakma: B köprüyü herkes için sabitler."},
  {"name":"Parkta Bir Terslik","mechanic":"timed","route":["zig","laser","jump","pendulum"],"theme":"city","hint":"Lazer kırmızıysa bekle; sönük aralıkta geç."},
  {"name":"Sarmaşıklı Bahçe","mechanic":"plates","route":["stairs","mover","zig","sweeper"],"theme":"garden","hint":"Hareketli platforma binmeden önce yaklaşmasını bekle."},
  {"name":"Eski Fabrika","mechanic":"relay","route":["mover","jump","laser","drop"],"theme":"ruins","hint":"Hareketli basamakların ritmini öğren."},
  {"name":"Görünmez Belediyecilik","mechanic":"timed","route":["stairs","zig","dash","laser","maze"],"theme":"market","hint":"Yüksekliğe göre kalkışını ayarla; güvenli dinlenme alanları yeşil."},
  {"name":"Servis Dışı Asansör","mechanic":"operator","route":["walk","wall","jump","pendulum"],"theme":"garden","hint":"A, servis platformunu çalıştırır ve geçiş lazerini kapatır. Koşucu B’yi açar."},
  {"name":"Çatıdan Çatıya","mechanic":"relay","route":["wall","stairs","laser","launch"],"theme":"city","hint":"Duvar yanında havadayken SHIFT: duvar koşusu. BOŞLUK: duvardan sıçra."},
  {"name":"İnşaat Macerası","mechanic":"operator","route":["mover","wall","zig","sweeper"],"theme":"garden","hint":"Operatör platformu kontrol eder; parkurda yükselen yüzeylere dikkat."},
  {"name":"Şeffaf Şehir Planı","mechanic":"plates","route":["zig","wall","mover","laser","maze"],"theme":"ruins","hint":"Dar inişler ve duvar hattını birleştir."},
  {"name":"Fıskiye Mesaisi","mechanic":"operator","route":["stairs","walllaser","dash","drop"],"theme":"market","hint":"Duvar koşusuna başlamadan lazerin güvenli fazını bekle."},
  {"name":"Gece Pikniği","mechanic":"timed","route":["wall","mover","laser","zig","fake"],"theme":"garden","hint":"Üç saniyelik başlangıç, sonra duvar koşusu ve taşıyıcı platform."},
  {"name":"Teras Komşuları","mechanic":"plates","route":["stairs","mover","stairs","wall","pendulum"],"theme":"city","hint":"Farklı kotlardaki inişlerde hızını kontrol et."},
  {"name":"Süpürge Festivali","mechanic":"relay","route":["laser","walllaser","zig","dash","sweeper"],"theme":"garden","hint":"Arka arkaya lazerlerde ara platformlarda bekleyebilirsin."},
  {"name":"Depoda Sakarlık","mechanic":"operator","route":["mover","zig","walllaser","mover","launch"],"theme":"ruins","hint":"Yatay ve dikey platformların çevrimleri farklı."},
  {"name":"Kaybolan Sokak","mechanic":"timed","route":["wall","stairs","laser","mover","dash","maze"],"theme":"market","hint":"Uzun rotada kayıt noktalarını sırayla al."},
  {"name":"Yokuş Aşağı Yukarı","mechanic":"operator","route":["walllaser","dash","sweeper","mover","laser","pendulum"],"theme":"garden","hint":"Sert bölüm: lazeri bekle, duvar koşusundan atılmaya geç."},
  {"name":"Duba Cumhuriyeti","mechanic":"plates","route":["zig","laser","launch","walllaser","stairs","dash","drop"],"theme":"city","hint":"Dar rotada kontrollü kalkış; hata sonrası son güvenli noktaya dönersin."},
  {"name":"Muhtarın Son Şakası","mechanic":"timed","route":["dash","walllaser","sweeper","mover","wall","laser","sweeper"],"theme":"garden","hint":"İtki bekleme süresini duvar ve platform zamanlamasıyla eşleştir."},
  {"name":"Son Dolmuş","mechanic":"operator","route":["laser","mover","launch","walllaser","dash","zig","fake"],"theme":"ruins","hint":"A’daki arkadaşını kurtardıktan sonra bütün ekip çıkışta buluşsun."},
  {"name":"Belediye Labirenti","mechanic":"plates","route":["walllaser","stairs","sweeper","dash","mover","walllaser","maze"],"theme":"market","hint":"İki lazerli duvar hattı arasında güvenli bir kayıt noktası var."},
  {"name":"Eve Dönerken","mechanic":"operator","route":["dash","walllaser","launch","mover","laser","walllaser","dash","pendulum"],"theme":"garden","hint":"Final: platform, duvar koşusu, lazer ve atılma. İki kişiyle de tamamlanabilir."}
];
const palettes = { city: '#729aaf', garden: '#87a16c', ruins:'#bc9b73', market:'#ce8b72' };
export function buildLevel(index = 0) {
  const spec = SECTORS[index]; if (!spec) throw new Error('Unknown sector');
  const difficulty = index / 24;
  const boxes = [box('arrival', 0,-.5,-2,14,1,20), box('landing',0,-.5,-38,14,1,12),
    box('wall-left',-7.2,2,-3,.4,5,18,'wall'), box('wall-right',7.2,2,-3,.4,5,18,'wall')];
  const movers = [], lasers = [], obstacles = [], traps = [], invisibleWalls = [], fakePlatforms = [], routePoints = [], checkpoints = [{x:0,y:1.1,z:-39}];
  let x = 0, y = 0, edge = -44, serial = 0;
  const add = (gap, width = 5, depth = 4, shift = 0, rise = 0, motion = null) => {
    x += shift; y = Math.max(0, Math.min(4, y + rise));
    const z = edge - gap - depth / 2;
    const item = box(`route-${serial++}`,x,y-.5,z,width,1,depth, motion ? 'mover' : 'floor');
    if (motion) { item.motion = motion; movers.push(item); } else boxes.push(item);
    routePoints.push({ x, y:y+.86, z, id:item.id, gap, motion, top:y }); edge = z-depth/2; return item;
  };
  const laser = (z, top, width, controlled = false) => {
    lasers.push({ id:`laser-${lasers.length}`,position:{x,y:top+.9,z},size:{x:width,y:.13,z:.22},
      period:Math.max(2.6,5.8-difficulty*2), duty:.48+difficulty*.16,
      phase:lasers.length*.6+index*.17, sweep:.2+difficulty*.7, controlled });
  };
  for (const [moduleIndex, kind] of spec.route.entries()) {
    const narrow = 5-difficulty*2.2, side = (moduleIndex+index)%2 ? 1 : -1;
    if (kind === 'walk') add(0,7,7);
    if (kind === 'jump') { add(2.2+difficulty*1.5,narrow,4,side*.8); add(2.2+difficulty*1.5,narrow,4,-side*.8); }
    if (kind === 'zig') for (let i=0;i<3;i++) add(1.8+difficulty,narrow,3.5,(i%2?-1:1)*side*2, i===1?.5:-.25);
    if (kind === 'stairs') for(let i=0;i<3;i++) add(1.5+difficulty*.5,narrow,3.5,0,i===2?-1:.5);
    if (kind === 'dash') add(7.1+difficulty*.5,5-difficulty,5,0,0);
    if (kind === 'mover') {
      add(1.6,4.5,4,0,0,{axis:index%2?'y':'x',amplitude:index%2?.55:.65,period:5-difficulty,phase:0});
      add(1.6,5,4);
    }
    if (kind === 'laser') { const tile=add(1.6,narrow+1,8); laser(tile.position.z,y,narrow+1); }
    if (kind === 'wall' || kind === 'walllaser') {
      const start = edge, centerX = x;
      const tile=add(10.2+difficulty,4.4-difficulty,5);
      // Right face is 0.4m from center of the recommended duvar koşusu line.
      boxes.push(box(`wall-run-${moduleIndex}`,centerX+1.65,y+2,(start+tile.position.z)/2,.4,5.5,start-tile.position.z+5,'wall'));
      routePoints.at(-1).wall = { x:centerX+1.1, startZ:start-.3, endZ:tile.position.z+1 };
      if(kind==='walllaser') laser((start+tile.position.z)/2,y+1.1,5);
    }
    if(kind==='pendulum' || kind==='sweeper'){
      const tile=add(1.2,10,10);
      obstacles.push({id:`obstacle-${moduleIndex}`,type:kind,position:{x,y:y+(kind==='pendulum'?5.3:.6),z:tile.position.z},length:kind==='pendulum'?4.3:3.8,radius:kind==='pendulum'?.7:.18,speed:kind==='pendulum'?1.5+difficulty*.45:1+difficulty,phase:index*.3});
    }
    if(kind==='drop' || kind==='launch'){
      const tile=add(.5,7,6);
      traps.push({id:`trap-${moduleIndex}`,type:kind,floorId:tile.id,position:{x,y:y+(kind==='drop'?.9:.3),z:tile.position.z},radius:kind==='drop'?1.7:1.15});
    }
    if(kind==='fake'){
      const tile=add(2.2,5,5,-1.5);
      fakePlatforms.push(box(`fake-${moduleIndex}`,x+5,y-.5,tile.position.z+1,3,1,4));
      traps.push({id:`fake-notice-${moduleIndex}`,type:'fake',position:{x:x+5,y:y+.3,z:tile.position.z+1},radius:2.1});
    }
    if(kind==='maze'){
      const tile=add(.5,16,22),path=[];
      for(let i=0;i<3;i++){
        const side=i%2?-1:1,z=tile.position.z+6-i*6;
        invisibleWalls.push(box(`invisible-${moduleIndex}-${i}`,x+side*3,y+1.5,z,9,3,.35,'invisible'));
        path.push({x:x-side*6,y:y+.84,z:z+1},{x:x-side*6,y:y+.84,z:z-1});
      }
      routePoints.at(-1).maze=path;
      for(const side of [-1,1])boxes.push(box(`maze-side-${moduleIndex}-${side}`,x+side*8,y+1.5,tile.position.z,.3,3,22,'wall'));
    }
    // Safe hub after each module. Every second hub is a persistent checkpoint.
    const hub=add(.8,7,6,0,0);
    if (moduleIndex % 2 === 1) checkpoints.push({x,y:y+1.1,z:hub.position.z});
  }
  const exitZ=edge-5;
  boxes.push(box('exit',x,y-.5,exitZ,12,1,10));
  boxes.push(box('exit-gate',x,y+2.5,exitZ+1,12,6,.5,'gate'));
  if(spec.mechanic==='operator') {
    movers.push({...box('ferry',0,-.45,-22,5, .9,6,'mover'), motion:{axis:'z',amplitude:8,period:10,phase:Math.PI/2,controlled:true}});
    lasers.push({id:'control-laser',position:{x:0,y:1,z:-22},size:{x:7,y:.15,z:.25},period:4,duty:.9,phase:0,sweep:.25,controlled:true});
  }
  return { index,...spec,difficulty,accent:palettes[spec.theme], boxes,movers,lasers,obstacles,traps,invisibleWalls,fakePlatforms,routePoints,checkpoints,
    puzzleType:spec.mechanic, requiredPlayers:2, holdSeconds:spec.mechanic==='operator'?18:8,
    plateHold:1, bridgeSeconds:3, bridge:box('bridge',0,-.35,-22,4.2,.7,20,'bridge'),
    plates:[{x:-3,y:.08,z:-6},{x:3,y:.08,z:-6}],
    terminalA:{x:-2.2,y:.9,z:-8.5},terminalB:{x:2.2,y:.9,z:-36},
    spawn:{x:0,y:1.1,z:3},checkpoint:checkpoints[0],exit:{x,y:y+1,z:exitZ-2},fallY:-14 };
}
