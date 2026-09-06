export const SKINS = Object.freeze([
  { id:'courier', name:'Aceleci Kurye', color:'#ed985f', detail:'#27485a', shape:'cap' },
  { id:'frog', name:'Kurbağa Kaptan', color:'#80b777', detail:'#efdf96', shape:'frog' },
  { id:'mushroom', name:'Mantar Muhtar', color:'#dd8277', detail:'#f6e8bf', shape:'mushroom' },
  { id:'cone', name:'Duba Derviş', color:'#efa85e', detail:'#fff3d7', shape:'cone' },
  { id:'television', name:'Tüplü Tuncay', color:'#a394c3', detail:'#92c9b4', shape:'television' },
  { id:'pigeon', name:'Güvercin Gazi', color:'#92a7b2', detail:'#778fa0', shape:'pigeon' }
]);
export const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];
export const validSkin = id => typeof id==='string' && SKINS.some(s=>s.id===id);
export const EMOTE_LABELS = Object.freeze({dance:'Makarna Dansı',wave:'Abartılı Selam',smoke:'Sigara Molası',helicopter:'İnsan Pervanesi',robot:'Bozuk Robot',flop:'Jöle Dizler'});
export const MOTION_LABELS = Object.freeze({idle:'DİNLENİYOR',walk:'YÜRÜYOR',run:'KOŞUYOR',jump:'HAVADA',dash:'ATILIYOR',wallrun:'DUVARDA'});
export const PRANK_MESSAGES = Object.freeze({
  pendulum:'Sarkaç seni selamladı. Biraz sert oldu!', sweeper:'Mahalle süpürüldü. Sen de dahil!',
  launch:'Geri vites hediyemizdir!', drop:'Düğme çalıştı. Yalnız yanlış şeyi açtı.',
  fake:'Bu platformun sadece özgüveni sağlam.', maze:'Duvar görünmüyor, gururun biraz çizildi.',
  laser:'Kırmızı çizgiyi biraz fazla ciddiye aldın.', fall:'Yer çekimi yine kazandı.'
});
