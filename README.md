# Mahalle Şenliği

Stilize Dünya ortamında, **2–6 kişilik co-op parkur oyunu**. 25 modüler bölüm; mahalle çatıları, ağaçlar, nehir, sarkaçlar, dönen süpürücüler, görünmez labirentler ve komik tuzaklar. Tek oyuncu hareketleri deneyebilir; bölümler iki kişiyle çözülebilir ve bitişte bağlı tüm oyuncular buluşur.

**Yeni:** Altı farklı karakter, altı abartılı hareket, düşük parlamalı PBR ışık, tamamen Türkçe oyuncu metinleri, tuzaklara tepki veren yüz arayüzü ve sesler. Mocapdata.com → GLB ve Rive entegrasyonları hazır; harici mocap klipleri / özel `.riv` tasarımı dahil değil. Yerleşik karakterler ve Canvas yüzü dosya indirmeden çalışır.

**Güncelleme:** Repo kökünde `client`, `shared`, `server`, **package.json ve package-lock.json** birlikte değişmeli; `tools` varlık doğrulama komutu içindir. Rive bağımlılığı eklendi. Derleme `npm ci --include=dev && npm run build`, başlatma `npm start`. Canlı Render servisi bu teslimde değiştirilmedi. Ağ/bölüm sürümü 3; açık sekmeleri yenile. Önceki kayıtların sektör numarası korunur, değişen bölüm içi geometri nedeniyle kayıt noktası ve bulmaca kilidi sıfırlanır.

- `docs/EARTH_UPDATE.md`: yeni davranışlar, ışık değerleri ve kurulum.
- `docs/MOCAP_RIVE.md`: harici animasyon ve Rive dosyası hazırlama/bağlama iş akışı.
- `docs/LEVEL_DESIGN.md`: 25 bölümün güncel karşılaşma kataloğu.

**Kapsam:** Çalışan prototip ve geliştirme altyapısı. 60–120 dakika ve hedef cihaz FPS değerleri henüz gerçek ekiplerle ölçülmedi. Otomatik kontroller fizik/ağ kurallarını doğrular; görsel kalite ve eğlenceyi insan oyun testi değerlendirmelidir.

## Hızlı kurulum — Windows, macOS, Linux

Node.js **22.12+** (22 veya 24 serisi) ve npm gerekir. ZIP'i aç; terminali `package.json` bulunan `colony-relay` klasöründe çalıştır.

```sh
npm ci
npm run dev
```

Tarayıcı: **http://localhost:5173**

`npm run dev` iki süreci birlikte açar: Vite 5173, Node / Socket.IO 3001. Tek başına HTML dosyasını çift tıklayarak çalışmaz. İlk kurulum paket indirmek için internet gerektirir; oyun varlıkları ve WASM derlemeye dahildir, çalışma sırasında harici CDN gerekmez.

1. Çağrı adını yaz, **Yeni görev başlat** düğmesine bas.
2. Oda kodunu paylaş. Arkadaşın aynı sunucunun arayüzünden kodla katılsın.
3. Yerel denemede ikinci normal sekmeyi açıp aynı kodla katılabilirsin. Yeni sekmede farklı misafir kimliği oluşur; sekmeyi çoğaltmak sessionStorage'ı kopyalayabildiği için ayrı açmak daha güvenilirdir.
4. Oyun alanına tıkla; fare kilitlenir. A terminaline yaklaş, E'yi basılı tut. İkinci oyuncu köprüden B'ye geçerek E'ye basar.
5. Köprü kalıcı hale gelir, çıkış kapısı açılır. A'yı tutan oyuncu artık geçebilir.
6. Yeşil checkpoint'i al, parkuru geç. Bağlı tüm oyuncular çıkışta buluşunca sonraki sektör yüklenir.

İlk açılışta tek oyuncuysanız köprü mekanizmasını tamamlayamazsınız. Menü açılması online dünyayı durdurmaz. Ölümde son checkpoint'e dönülür.

## Kontroller

| Tuş | Davranış |
|---|---|
| W / A / S / D | Kameraya göre hareket |
| Fare | Etrafa bakma |
| Shift | Koşma; havadayken yan duvara yakınsa wall-run |
| Space | Zıplama / wall-run sırasında duvardan sıçrama |
| Q | 0,16 saniyelik dash; 1,2 saniye bekleme |
| V | FPS / TPS geçişi |
| E | Terminal etkileşimi; A için basılı tut |
| 1 / 2 / 3 | Makarna dansı / selam / sigara; aynı tuşa tekrar basınca iptal |
| 4 / 5 / 6 | İnsan pervanesi / bozuk robot / jöle dizler |
| M | Tüm sesleri aç / kapat |
| Esc | Fareyi bırak / menü |

Dokunmatik cihazlarda yön, koş, zıpla, dash, E ve kamera düğmeleri görünür; boş oyun alanını sürüklemek kamerayı döndürür. Arayüz responsive'dir. Dokunmatik parkur dengesi ve gerçek mobil GPU performansı test edilmemiştir.

## Derleme ve doğrulama

```sh
npm run build
npm test
npm start
```

Üretim derlemesinden sonra tek Node süreci hem arayüzü hem Socket.IO'yu **http://localhost:3001** üzerinden sunar. `client/dist/` derlemede oluşur. Geliştirme sunucusu üretim dağıtımı için kullanılmamalıdır.

Bu teslimde Node 24.19.0 ile üretim derlemesi ve 33 otomatik test geçti. Testler gerçek yerel Socket.IO istemcileri, Rapier fizik dünyaları ve dosya kayıt adaptörü kullanır. Önceki sürümde ayrıca ses güncellemesinde 64 saniyelik müzik ve 15 efekt offline ses motorunda üretildi; sonlu ve kırpılmayan ses örnekleri ile ses düğümü temizliği doğrulandı. Bu kontrol gerçek tarayıcıda işitsel inceleme yerine geçmez. Tarayıcı görsel/işitsel testi, gerçek WAN gecikme testi, düşük donanım ölçümü, Docker build ve AWS'ye canlı yazma yapılmadı.

Test kapsamı:

- Sarkaç ve süpürücü temasları, savrulmanın duvarla çarpışması ve ağ yeniden oynatması.
- Ortak zemin düşmesi, otomatik geri gelme, basılı tuşla tekrar tetikleyememe.
- Görsel sahte platformdan fiziksel düşme; bütün görünmez labirentlerin yürüyerek çözümü.
- Karakter seçiminin ağda taşınması, izin verilen karakter/animasyon sınırları, Türkçe metin kataloğu.

- 25 benzersiz rota; her bulmaca için 2, 3, 4, 5 ve 6 oyunculu oda doğrulaması.
- Üç saniyelik köprüde dash kanıtı, süre bitimi, basılı E ile süre uzatılamaması.
- Plakalarda farklı oyuncu zorunluluğu; erken ayrılmada dolumun sıfırlanması.
- Taşıyıcı üzerinde fiziksel yolculuk, terminal bırakılınca durma, B ile kalıcı dönüş.
- Her rota inişinin önceki platformdan fiziksel erişimi (hareketli platformların orta fazında; lazer zamanlaması ayrı test). Bu, bütün kampanyanın uçtan uca insan oyun testi değildir.
- Hızlı hareketlerde lazer teması ve operatör lazer kapatması; eski kayıt geçişi.

- 6 bağlantı kabulü; 7. bağlantının reddedilmesi; oda izolasyonu; kimlikle yeniden katılma.
- Geçersiz input, eski epoch, istemciden pozisyon gönderme denemeleri.
- Kapsül zemine oturma, zıplama, duvara dash çarpışması, çapraz hareket hız sınırı.
- Wall-run süresi ve dash cooldown; sunucu durumundan yeniden oynatılan hareketin eşleşmesi.
- Uzak terminal aktivasyonunun reddi, zaman aşımı, operatör kopması, tek oyunculu çözümün reddi.
- Açılan köprü / kapı collider durumları; her terminal-köprü sektöründe iki oyuncunun fiziksel geçişi.
- Atomik kayıt, yeniden okuma, eski sürümle yazma çatışması, uyumsuz kayıt reddi.
- Emote süreleri, havada kullanımın reddi, hareketle/etkileşimle iptal ve başka Socket.IO istemcisinde görünmesi.
- Ses olaylarının bir kez tetiklenmesi, yeniden bağlantıda eski seslerin çalmaması ve ayarların saklanması.

## Aynı Wi-Fi ve internet üzerinden birlikte oynama

Yerel ağ için `.env.example` dosyasını `.env` adıyla kopyala. Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Örneğin sunucu bilgisayarının IP adresi `192.168.1.50` ise, `.env` içindeki izin listesine kullandığınız arayüz origin'ini ekle:

```dotenv
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001,http://192.168.1.50:3001
```

Ardından derle ve `npm start` çalıştır. Diğer cihazlar `http://192.168.1.50:3001` adresini açar. Windows güvenlik duvarında Node'a özel ağ erişimi gerekir. Arkadaşlarının cihazında `localhost` yazmaları senin bilgisayarına bağlanmaz.

Farklı internet bağlantıları için bu Node uygulamasını sürekli çalışan bir sunucuya/container'a yerleştir. Önüne HTTPS ve WebSocket Upgrade destekleyen reverse proxy koy. `ALLOWED_ORIGINS=https://oyun.example.com` olarak ayarla. Arayüz ve socket aynı origin'de olduğundan istemciye ayrı server URL'si yazılmaz.

Bu pakette canlı servis oluşturulmadı. Node'un sürekli fizik döngüsü normal bir statik host üzerinde çalışmaz. Çok düğümlü ölçekleme için `docs/ARCHITECTURE.md` içindeki oda sahipliği tasarımını uygula.

Docker örneği (yerel test; bu teslimde container build çalıştırılmadı):

```sh
docker build -t colony-relay .
docker run --rm -p 3001:3001 -e ALLOWED_ORIGINS=http://localhost:3001 -v colony-saves:/app/server/data colony-relay
```

## Kayıt

Varsayılan `SAVE_DRIVER=file`; AWS hesabı gerekmez. `server/data/ODA-KODU.json` dosyaları Node tarafından atomik olarak yazılır. Üretimde bu dizini kalıcı volume'a bağla.

- Bulmaca kalıcı kilitlendiğinde, checkpoint'te, sektör geçişinde ve bağlantı kopmasında kayıt tetiklenir.
- Aktif oturumda yaklaşık 15 saniyelik periyodik kayıt da vardır.
- Fizik koordinatları her frame veritabanına yazılmaz; sektör, checkpoint, bulmaca sonucu ve roster kaydedilir.
- Kayıt başarısızsa HUD bunu gösterir ve sunucu 10 saniye sonra yeniden dener. Başarısız kayıt başarı diye gösterilmez.
- Server yeniden başlatıldığında aynı oda koduyla kayıt yüklenir. Eski 1. ve 2. sürüm kayıtları 3. sürüme taşınır: oda, kayıt revizyonu ve sektör indeksi korunur, değişen geometri nedeniyle checkpoint ve bulmaca kilidi sıfırlanır. Bilinmeyen sürümler reddedilir.
- Geçici köprü enerjisi yeniden yüklemede sıfırlanır; kalıcı kilit korunur.
- Misafir anahtarı `sessionStorage` içindedir; sayfa yenilemede kimlik korunur. Sekmeyi kapatıp depolamasını kaybetmek kişisel kimliği kaybettirir; oda ilerlemesi kalır. Tam hesap sistemi bu prototipte yoktur.
- Kopan oyuncunun yeri 30 saniye tutulur. Sonra yuva boşalır; ekibin kalan kısmı devam edebilir.

DynamoDB kullanmak için isteğe bağlı `infra/dynamodb.yaml` tablosunu kendi AWS ortamında oluştur; `.env` içinde:

```dotenv
SAVE_DRIVER=dynamo
AWS_REGION=eu-central-1
DYNAMO_TABLE=olusturulan-tablo-adi
```

Kimlik bilgilerini sunucunun IAM rolü / AWS profili sağlar. İstemciye AWS anahtarı konmaz. Gerekli veri erişimi ilgili tablo üzerinde `dynamodb:GetItem` ve `dynamodb:PutItem` ile sınırlandırılabilir. Dynamo adaptörü ve CloudFormation şablonu hazırdır; canlı AWS testi yapılmamıştır.

## Dosya ağacı

```text
colony-relay/
  package.json
  package-lock.json
  .env.example
  .gitignore
  .dockerignore
  Dockerfile
  README.md
  client/
    index.html
    vite.config.js
    src/
      main.js             — oyun döngüsü, tahmin, reconciliation, HUD
      input.js            — klavye, fare kilidi, dokunmatik
      audio.js            — özgün ambient müzik, efektler, ses ayarları
      audio-events.js     — ses olayları; ağ düzeltmelerinde tekrar çalmayı engeller
      emotes.js           — altı komik hareketin pozları
      asset-config.js     — isteğe bağlı GLB/Rive yolları ve klip eşlemeleri
      model-animation.js  — model yükleme, iskelet klonları ve AnimationMixer
      expressive-ui.js    — tepki veren rehber yüzü
      rive-driver.js      — yerel WASM, veri bağlama, isteğe bağlı Rive
      camera.js           — FPS/TPS ve kamera engel kontrolü
      world.js            — PBR sahne, hareketli varlıklar ve avatar animasyonu
      graphics.js         — dokular, ortam ışığı, Bloom/SSAO/gölge kalite sistemi
      network.js          — bağlantı, input batch, remote interpolation
      style.css           — responsive görev ekranı ve HUD
    public/
      models/             — isteğe bağlı GLB modelleri
      ui/                 — isteğe bağlı Rive dosyası
    dist/                 — npm run build çıktısı; ZIP içinde yok
  shared/
    config.js             — tick ve hareket sabitleri
    levels.js             — 25 bölümün ortak modüler dünya tanımı
    dynamics.js           — ortak platform hareketi ve lazer zamanlaması
    pranks.js             — sarkaç, süpürücü, görünmez duvar ve şaka kuralları
    characters.js         — karakterler ve Türkçe hareket/tepki metinleri
    protocol.js           — ağ input doğrulaması
    simulation.js         — Rapier dünya + CharacterMotor
  server/
    src/
      index.js            — HTTP, Socket.IO, oda yaşam döngüsü
      room.js             — otoriteli simülasyon, ilerleme, snapshot
      puzzle.js           — iki oyunculu terminal/köprü/kapı
      storage.js          — dosya ve DynamoDB adaptörleri
    data/                 — çalışma sırasında oluşur; ZIP içinde yok
  tools/
    check-assets.mjs      — GLB klip ve Rive dosya kontrolü
  infra/
    dynamodb.yaml
  docs/
    ARCHITECTURE.md
    LEVEL_DESIGN.md
    EARTH_UPDATE.md
    MOCAP_RIVE.md
    AUDIO_EMOTES.md        — yeni kontroller, ses tasarımı, GitHub/Render güncellemesi
    CORE_CODE.md           — temel kontrolcü/kamera/ağ/bulmaca kodlarının tam dökümü
  tests/
    physics.test.js
    puzzle.test.js
    traversal.test.js
    network.test.js
    storage.test.js
    audio-events.test.js
    emotes.test.js
    campaign.test.js
    routes.test.js
    pranks.test.js
    localization.test.js
```

`docs/CORE_CODE.md`, kaynak dosyalarından bu teslim sırasında üretilmiştir. Geliştirme sırasında asıl kod ilgili `.js` dosyalarıdır.

## Kullanılan resmi kaynaklar

Kinematik kapsül hareketinde Rapier'ın çarpışmayı düzelten karakter kontrolcüsü kullanılır: [Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/).

Oda yayınları ve bağlantı kaybı tasarımı: [Socket.IO Rooms](https://socket.io/docs/v4/rooms/), [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

Kamera engelleri ve renderer API'leri: [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

Koşullu kayıt yazımı: [DynamoDB Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html). Tablo altyapısı: [AWS CloudFormation DynamoDB Table](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-dynamodb-table.html).
