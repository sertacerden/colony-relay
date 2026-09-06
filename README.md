# Colony Relay

Terk edilmiş uzay kolonisi temalı, tarayıcıda çalışan **2–6 kişilik co-op parkur başlangıç projesi**. Tek oyuncu hareketleri deneyebilir; bulmacayı ve sektörleri tamamlamak için en az iki oyuncu gerekir.

**Teslim edilen:** gerçek Three.js sahnesi, Rapier karakter motoru, sunucu otoriteli Socket.IO odaları, yerel hareket tahmini / düzeltmesi, FPS–TPS kamera, koşma / zıplama / dash / wall-run, üç modüler örnek sektör, zorunlu iki oyunculu terminal–köprü–kapı bulmacası, checkpoint ve kayıt adaptörleri.

**Kapsam:** Bu bir çalışan altyapı ve oynanabilir prototiptir. Üç örnek sektörün 1–2 saat sürdüğü iddia edilmez. 60–120 dakikalık tam oyun için 8 sektör / 24 modüllük içerik planı `docs/LEVEL_DESIGN.md` içindedir. Süre ve düşük donanım hedefi gerçek kullanıcı / cihaz oyun testleriyle doğrulanmalıdır.

**Ses ve emote güncellemesi:** 72 BPM sakin ambient/lo-fi müzik, 15 olay efekti, ayrı müzik/efekt ayarları ve M ile susturma eklendi. 1: dans, 2: selam, 3: sigara emote'u; el hareketi, küçük sigara modeli ve duman parçacıkları dahil. Emote'lar sunucuda doğrulanıp diğer oyunculara gönderilir. Kurulum/güncelleme ayrıntıları: `docs/AUDIO_EMOTES.md`.

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
| 1 / 2 / 3 | Dans / selam / sigara; aynı tuşa tekrar basınca iptal |
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

Bu teslimde Node 24.19.0 ile üretim derlemesi ve 15 otomatik test geçti. Testler gerçek yerel Socket.IO istemcileri, Rapier fizik dünyaları ve dosya kayıt adaptörü kullanır. Ek olarak 64 saniyelik müzik ve 15 efekt offline ses motorunda üretildi; sonlu ve kırpılmayan ses örnekleri ile ses düğümü temizliği doğrulandı. Bu kontrol gerçek tarayıcıda işitsel inceleme yerine geçmez. Tarayıcı görsel/işitsel testi, gerçek WAN gecikme testi, düşük donanım ölçümü, Docker build ve AWS'ye canlı yazma yapılmadı.

Test kapsamı:

- 6 bağlantı kabulü; 7. bağlantının reddedilmesi; oda izolasyonu; kimlikle yeniden katılma.
- Geçersiz input, eski epoch, istemciden pozisyon gönderme denemeleri.
- Kapsül zemine oturma, zıplama, duvara dash çarpışması, çapraz hareket hız sınırı.
- Wall-run süresi ve dash cooldown; sunucu durumundan yeniden oynatılan hareketin eşleşmesi.
- Uzak terminal aktivasyonunun reddi, zaman aşımı, operatör kopması, tek oyunculu çözümün reddi.
- Açılan köprü / kapı collider durumları; her örnek sektörde iki oyuncunun fiziksel köprü geçişi.
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
- Server yeniden başlatıldığında aynı oda koduyla kayıt yüklenir. Başka sektör sürümüne ait kayıt sessizce kullanılmaz.
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
      emotes.js           — dans, selam, sigara pozları
      camera.js           — FPS/TPS ve kamera engel kontrolü
      world.js            — low-poly sahne ve prosedürel avatar animasyonu
      network.js          — bağlantı, input batch, remote interpolation
      style.css           — responsive görev ekranı ve HUD
    dist/                 — npm run build çıktısı; ZIP içinde yok
  shared/
    config.js             — tick ve hareket sabitleri
    levels.js             — ortak modüler dünya tanımı
    protocol.js           — ağ input doğrulaması
    simulation.js         — Rapier dünya + CharacterMotor
  server/
    src/
      index.js            — HTTP, Socket.IO, oda yaşam döngüsü
      room.js             — otoriteli simülasyon, ilerleme, snapshot
      puzzle.js           — iki oyunculu terminal/köprü/kapı
      storage.js          — dosya ve DynamoDB adaptörleri
    data/                 — çalışma sırasında oluşur; ZIP içinde yok
  infra/
    dynamodb.yaml
  docs/
    ARCHITECTURE.md
    LEVEL_DESIGN.md
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
```

`docs/CORE_CODE.md`, kaynak dosyalarından bu teslim sırasında üretilmiştir. Geliştirme sırasında asıl kod ilgili `.js` dosyalarıdır.

## Kullanılan resmi kaynaklar

Kinematik kapsül hareketinde Rapier'ın çarpışmayı düzelten karakter kontrolcüsü kullanılır: [Rapier Character Controller](https://rapier.rs/docs/user_guides/javascript/character_controller/).

Oda yayınları ve bağlantı kaybı tasarımı: [Socket.IO Rooms](https://socket.io/docs/v4/rooms/), [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

Kamera engelleri ve renderer API'leri: [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

Koşullu kayıt yazımı: [DynamoDB Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html). Tablo altyapısı: [AWS CloudFormation DynamoDB Table](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-dynamodb-table.html).
