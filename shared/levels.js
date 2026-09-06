// Authored campaign blueprints: shared kit, distinct routes and encounter combinations.
export const box = (id, x, y, z, sx, sy, sz, kind = 'floor') =>
  ({ id, position: { x, y, z }, size: { x: sx, y: sy, z: sz }, kind });
const sector = (name, mechanic, route, theme, hint) => ({ name, mechanic, route: route.split(' '), theme, hint });
export const SECTORS = [
  sector('Uyanış İskelesi','relay','walk jump walk','dock','A: E basılı tut. Arkadaşın B terminalini kilitlesin. SPACE ile zıpla.'),
  sector('İkiz Devre','plates','stairs jump zig','garden','İki farklı gezgin iki ağırlık plakasında aynı anda dursun.'),
  sector('İtki Kalibrasyonu','timed','walk dash walk','dock','A düğmesi 3 saniye güç verir. Koşucu köprüde Q ile dash yapıp B’ye ulaşsın.'),
  sector('Kırık Kargo Hattı','plates','zig stairs jump','cargo','Plakaları birlikte etkinleştir; iniş yüzeylerini sırayla takip et.'),
  sector('İlk Vardiya','relay','stairs dash zig','garden','Operatörü geride bırakma: B köprüyü herkes için sabitler.'),
  sector('Neon Geçit','timed','zig laser jump','city','Lazer kırmızıysa bekle; sönük aralıkta geç.'),
  sector('Boşluk Bahçesi','plates','stairs mover zig','garden','Hareketli platforma binmeden önce yaklaşmasını bekle.'),
  sector('Uydu Aktarması','relay','mover jump laser','dock','Hareketli basamakların ritmini öğren.'),
  sector('Çift Katlı Depo','timed','stairs zig dash laser','cargo','Yüksekliğe göre kalkışını ayarla; güvenli dinlenme alanları yeşil.'),
  sector('Bakım Omurgası','operator','walk wall jump','city','A, servis platformunu çalıştırır ve geçiş lazerini kapatır. Koşucu B’yi açar.'),
  sector('Dış Gövde','relay','wall stairs laser','dock','Duvar yanında havadayken SHIFT: wall-run. SPACE: duvardan sıçra.'),
  sector('Yük Asansörü','operator','mover wall zig','cargo','Operatör platformu kontrol eder; parkurda yükselen yüzeylere dikkat.'),
  sector('Anten Kanyonu','plates','zig wall mover laser','city','Dar inişler ve duvar hattını birleştir.'),
  sector('Reaktör Servisi','operator','stairs walllaser dash','reactor','Duvar koşusuna başlamadan lazerin güvenli fazını bekle.'),
  sector('Gece Nöbeti','timed','wall mover laser zig','city','Üç saniyelik başlangıç, sonra wall-run ve taşıyıcı platform.'),
  sector('Yerçekimi Terası','plates','stairs mover stairs wall','garden','Farklı kotlardaki inişlerde hızını kontrol et.'),
  sector('İyon Koridoru','relay','laser walllaser zig dash','reactor','Arka arkaya lazerlerde ara platformlarda bekleyebilirsin.'),
  sector('Kargo Makası','operator','mover zig walllaser mover','cargo','Yatay ve dikey platformların çevrimleri farklı.'),
  sector('Gözlemevi','timed','wall stairs laser mover dash','dock','Uzun rotada checkpoint’leri sırayla al.'),
  sector('Kırmızı Hat','operator','walllaser dash mover laser','reactor','Sert bölüm: lazeri bekle, wall-run’dan dash’e geç.'),
  sector('Sessiz Şehir','plates','zig laser walllaser stairs dash','city','Dar rotada kontrollü kalkış; hata sonrası son güvenli noktaya dönersin.'),
  sector('Çekirdek Çemberi','timed','dash walllaser mover wall laser','reactor','İtki bekleme süresini duvar ve platform zamanlamasıyla eşleştir.'),
  sector('Son Frekans','operator','laser mover walllaser dash zig','dock','A’daki arkadaşını kurtardıktan sonra bütün ekip çıkışta buluşsun.'),
  sector('Çöküş Protokolü','plates','walllaser stairs dash mover walllaser','reactor','İki lazerli duvar hattı arasında güvenli bir checkpoint var.'),
  sector('Eve Dönüş','operator','dash walllaser mover laser walllaser dash','city','Final: platform, wall-run, lazer ve dash. İki kişiyle de tamamlanabilir.')
];
const palettes = { dock: '#68e8ff', garden: '#b9f485', cargo: '#ffc17e', city: '#ae9aff', reactor: '#ff806c' };
export function buildLevel(index = 0) {
  const spec = SECTORS[index]; if (!spec) throw new Error('Unknown sector');
  const difficulty = index / 24;
  const boxes = [box('arrival', 0,-.5,-2,14,1,20), box('landing',0,-.5,-38,14,1,12),
    box('wall-left',-7.2,2,-3,.4,5,18,'wall'), box('wall-right',7.2,2,-3,.4,5,18,'wall')];
  const movers = [], lasers = [], routePoints = [], checkpoints = [{x:0,y:1.1,z:-39}];
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
      // Right face is 0.4m from center of the recommended wall-run line.
      boxes.push(box(`wall-run-${moduleIndex}`,centerX+1.65,y+2,(start+tile.position.z)/2,.4,5.5,start-tile.position.z+5,'wall'));
      routePoints.at(-1).wall = { x:centerX+1.1, startZ:start-.3, endZ:tile.position.z+1 };
      if(kind==='walllaser') laser((start+tile.position.z)/2,y+1.1,5);
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
  return { index,...spec,difficulty,accent:palettes[spec.theme], boxes,movers,lasers,routePoints,checkpoints,
    puzzleType:spec.mechanic, requiredPlayers:2, holdSeconds:spec.mechanic==='operator'?18:8,
    plateHold:1, bridgeSeconds:3, bridge:box('bridge',0,-.35,-22,4.2,.7,20,'bridge'),
    plates:[{x:-3,y:.08,z:-6},{x:3,y:.08,z:-6}],
    terminalA:{x:-2.2,y:.9,z:-8.5},terminalB:{x:2.2,y:.9,z:-36},
    spawn:{x:0,y:1.1,z:3},checkpoint:checkpoints[0],exit:{x,y:y+1,z:exitZ-2},fallY:-14 };
}
