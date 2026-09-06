# Müzik, efektler ve karakter emote'ları

## Kullanım

| Kontrol | Sonuç |
|---|---|
| Sağ üstte ♫ Ses | Müzik ve efekt seslerini ayrı ayarla |
| M | Tüm sesleri sustur / aç |
| 1 | 8 saniyelik dans |
| 2 | 3 saniyelik selam |
| 3 | 9 saniyelik sigara içme animasyonu |
| Aynı emote tuşuna tekrar bas | Animasyonu iptal et |
| Hareket, zıplama, dash veya terminal | Emote kesilir, normal oyun devam eder |

Emote'lar zemindeyken kullanılır. Başladığında kamera TPS'e geçer; karakterini görebilirsin. Ardından V ile kamerayı yeniden değiştirebilirsin. Fare kilitliyken 1/2/3 kısayollarını kullan. Esc menüsünde ve dokunmatik ekranda emote düğmeleri de bulunur.

Ses motoru ilk tıklama/tuş etkileşiminde başlar. Müzik ve efekt seviyeleri ile susturma tercihi localStorage'da saklanır. Depolamanın kapalı olması oyunu engellemez. Menü açıldığında müzik kısılır; sekme gizlendiğinde ses motoru askıya alınır. Geri dönüşte tarayıcı sesi otomatik açmazsa bir kez tıkla. Bu davranış Web Audio kullanıcı etkileşimi kurallarına uygundur: [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Müzik ve efektler

Müzik, bu proje için kodla oluşturulan 72 BPM ambient/lo-fi düzenlemedir: yumuşak detune synth akorları, seyrek elektrik piyano benzeri melodiler, bas, düşük seviyeli kick/hat/snare ve filtreli delay. Akor yürüyüşü yaklaşık 26,7 saniyede döner; melodinin register değişimiyle iki turluk yapı yaklaşık 53,3 saniyedir. Uzun oyunlarda arka planda devam eder. Hazır bir sanatçı kaydı veya harici ses dosyası kullanılmaz.

Efektler: adım, zıplama, yere iniş, dash, wall-run sürtünmesi, terminal, köprü açılışı/kapanışı, kalıcı kilit, checkpoint, yeniden doğma, sektör geçişi, bitiş, kamera ve arayüz tıklaması.

Yerel hareket sesleri yalnızca yeni simülasyon adımlarında çalar. Sunucu düzeltmesindeki input replay ses üretmez. Köprü ve checkpoint gibi dünya olayları ardışık sunucu snapshot'ları karşılaştırılarak bir kez tetiklenir. Odaya sonradan giren veya yeniden bağlanan oyuncu geçmişteki tüm efektleri topluca duymaz.

Mevcut efektler yerel oyuncu ve oda olayları içindir; uzak oyuncuların adımları ayrıca çalınmaz. Müzik her tarayıcıda yerel çalar, ortak müzik saati senkronizasyonu yoktur. Emote animasyonlarının zamanı ise sunucudan gelir.

Performans: yeni çalışma zamanı bağımlılığı, MP3/OGG indirmesi veya sunucu ses akışı eklenmedi. Gürültü tamponu tekrar kullanılır; biten osilatörler ve gain/filter düğümleri ayrılır. Aynı anda en fazla 64 ses kaynağı sınırı vardır. Offline müzik kontrolünde en yüksek 21 kaynak görüldü; bu bir tarayıcı FPS ölçümü değildir. Ses düğümleri sekme gizlenince durdurulur. Dört küçük duman parçası avatar başına önceden oluşturulur; her kare yeni mesh yaratılmaz.

## Emote ve ağ

`shared/config.js` izinli emote adlarını ve sürelerini tanımlar. İstemci yalnızca `emote: dance | wave | smoke | null` niyetini gönderir. `shared/protocol.js` başka adları ve hatalı veri tiplerini reddeder. `CharacterMotor` emote'u zeminde başlatır ve gameplay girdilerinde keser. Kalan süre `emoteLeft` sunucu fizik tick'iyle azalır; bu alan snapshot'ın parçasıdır.

`client/src/emotes.js`, animasyonun fazını toplam süre eksi kalan süreden hesaplar. Uzak oyuncularda kalan süre interpolation tamponundan yumuşatılır. Böylece karakterler yakın zamanlı aynı emote'u görür; ağ gecikmesi sıfır varsayılmaz. Sigara emote'unda kol yüz hizasına kalkar, küçük model elde görünür ve nefes verme fazında düşük poligonlu duman yükselir. Emote görseldir; collider, hız, zıplama veya ilerleme değişmez.

## GitHub ve Render'a güncelleme

Bu ZIP tam proje paketidir. Önce ZIP'i tamamen çıkart.

1. GitHub'daki mevcut repository'ni aç; yeni repository veya yeni Render servisi oluşturmak gerekmez.
2. Add file → Upload files ekranına gir. Çıkartılmış proje içindeki `client` ve `shared` klasörlerini birlikte sürükle; mevcut dosyaların üzerine yazılmasını içeren commit'i kaydet.
3. Kaynakları ve testleri de güncel tutmak için `tests`, `docs` ve `README.md` dosyasını aynı güncellemede yükleyebilirsin. `node_modules`, `client/dist`, `server/data` veya kişisel `.env` dosyanı yükleme.
4. Render otomatik dağıtımı açıksa commit sonrası yeniden derler. Kapalıysa mevcut serviste Manual Deploy → Deploy latest commit kullan.
5. Servis Live olunca oyunu yenile; eski dosyaları görürsen Ctrl+F5 yap. İlk tıklamadan sonra müzik başlayacak.

Build komutu `npm ci --include=dev && npm run build`, start komutu `npm start` olarak kalır. Bu güncelleme yeni npm bağımlılığı veya yeni environment değişkeni gerektirmez. Render'daki mevcut `ALLOWED_ORIGINS` ayarını koru. Bu paket hazırlanırken GitHub repository'ne veya Render servisine doğrudan erişilip dağıtım yapılmadı.

Çalışma için birlikte güncellenmesi gereken dosyalar:

```text
client/index.html
client/src/main.js
client/src/input.js
client/src/network.js
client/src/world.js
client/src/style.css
client/src/audio.js          (yeni)
client/src/audio-events.js   (yeni)
client/src/emotes.js         (yeni)
shared/config.js
shared/protocol.js
shared/simulation.js
```

## Doğrulama

`npm test`: 15 test başarılı. Emote süre sınırları ve iptal koşulları, yanlış inputların reddi, gerçek Socket.IO istemcileri arasında emote aktarımı ve ses olaylarının tekrarlanmaması dahil.

Offline Web Audio uyumlu motorla 64 saniye müzik üretildi: NaN/Infinity yok, peak yaklaşık 0,107 (kırpılma eşiği 1'in altında), tamamlanınca aktif ses kaynağı kalmadı. 15 efektin her biri ayrıca üretildi; ses çıkışı ve düğüm temizliği doğrulandı. Doğrulama aracı yalnızca geliştirme ortamında kullanıldı, projenin bağımlılıklarına eklenmedi.

Gerçek tarayıcıda işitsel/görsel inceleme ve mobil cihaz testi yapılmadı. Müziğin seviyesi ve emote görünümü ilk ortak oyun oturumunda ayrıca değerlendirilmelidir.
