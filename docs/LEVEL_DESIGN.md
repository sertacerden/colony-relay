# 60–120 dakikalık tam oyun için içerik planı

Bu dosya üretim planıdır; aşağıdaki 24 modülün tamamının kodlandığı anlamına gelmez. Mevcut `shared/levels.js`, ortak geometri ve zorluk parametreleriyle üç örnek sektör üretir. Her örnekte A/B co-op geçişi, checkpoint, beş atlama platformu, isteğe bağlı wall-run hattı ve ekip çıkışı vardır.

## Hedef akış

| Sektör | Yeni beceri / co-op görevi | Modül sayısı | İlk oynayış hedefi |
|---|---|---:|---:|
| 1 — Uyanış İskelesi | Kamera, koşma, zıplama; terminal–köprü öğretimi | 3 | 6–9 dk |
| 2 — Bakım Omurgası | Dash mesafesi, operatör/koşucu rol değişimi | 3 | 7–11 dk |
| 3 — Yaşam Destek | İki ayrı terminal hattı ve oksijen kapıları | 3 | 8–12 dk |
| 4 — Dış Gövde | Wall-run ve duvardan sıçrama; güvenli ara noktalar | 3 | 8–13 dk |
| 5 — Kargo Çemberi | Süreli köprü zinciri, birbirini gören paralel rotalar | 3 | 9–14 dk |
| 6 — Reaktör Kanadı | Dash + wall-run birleşimi, sırayla enerji taşıma | 3 | 9–15 dk |
| 7 — Anten Dizisi | Ayrı yüksekliklerde terminal zamanlaması | 3 | 9–15 dk |
| 8 — Tahliye | Öğrenilenlerin finali, bütün ekibin çıkışa ulaşması | 3 | 10–16 dk |
| Toplam | 24 oynanış modülü | 24 | **66–105 dk** |

Başarısız denemeler, keşif ve iletişimle 60–120 dakika aralığı hedeflenir. Tekrarlar ve beklemelerle yapay süre doldurmak yerine her sektörde yeni bir işbirliği problemi eklenmeli. İlk oynayan 2, 4 ve 6 kişilik ekiplerle ayrı süre ölçümü yapılmalı; tablo bir tahmindir.

## Modül sözleşmesi

Mevcut basit motorla uyumlu her modül şunları tanımlar:

- Benzersiz `id`, `levelVersion`, giriş / çıkış pozisyonu ve güvenli spawn.
- Basit box geometrileri; görsel detay ve fizik collider listesi ayrı tutulabilir.
- Terminal pozisyonları, geçiş collider kimlikleri, sunucu bulmaca parametreleri.
- Checkpoint kimliği; modül geçişinin sunucu doğrulaması.
- Gerekli beceriler, asgari ekip sayısı, beklenen ilk geçiş süresi.
- Düşme sınırı, operatör bağlantısı kesilince kurtarma yolu, takımın yeniden bir araya gelmesi.

Başlangıç için bu alanlar `buildLevel()` çıktısında bulunur. Üretimde veri dosyalarına ayrılıp bir modül katalog/derleyicisi tarafından tek aktif sektör haline getirilebilir. İstemci ve sunucu aynı sürümlü tanımı yüklemeli; yalnızca tarayıcıda platform oluşturmak sunucunun fiziğini değiştirmez.

## Tasarım ilkeleri

1. **Her görev iki kişiyle çözülebilmeli.** 3–6 oyuncu için paralel iş ve güvenli bekleme alanları açılmalı. Altı düğmeye aynı anda basma zorunluluğu getirilmemeli.
2. **Operatör kurtarılmalı.** Karşı terminal geçişi kalıcı açmalı veya geri dönüş enerjisi sağlamalı. Mevcut A/B kilidi bunu gösterir.
3. **Checkpoint sıklığı:** yaklaşık 2–4 dakikalık başarı kaybı sınırı hedeflenmeli. Zor sıçrama dizilerinden önce güvenli zemin olmalı.
4. **Okunabilir geometri:** cyan geçiş rotası, lime terminal/checkpoint, turuncu kapalı kapı. Yalnızca renk kullanma; A/B etiketleri, farklı biçimler ve HUD metni de olsun.
5. **Öğret–denet–birleştir:** önce güvenli zeminde beceri, sonra tek risk, sonra co-op zamanlamasıyla birleşim.
6. **Oyuncu ayrılması:** canlı oyuncular yeniden görev alabilmeli. Tek oyuncu kalırsa checkpoint korunmalı, UI arkadaş beklediğini anlatmalı.
7. **Görünmez bariyerle zorlamak yerine sunucuda ilerleme koşulu:** dash ile çevreden atlanabilen fiziksel bir kapı olsa bile bulmaca tamamlanmadan sektör bitmez.

## Mevcut üç örneğin zorluk farkı

| Örnek | Platform arası boşluk | Platform genişliği | Amaç |
|---|---:|---:|---|
| Uyanış İskelesi | 2,4 m | 5,0 m | Koşma / zıplama ve ilk co-op |
| Bakım Omurgası | 3,2 m | 3,8 m | Daha dikkatli kalkış ve iniş |
| Reaktör Yaklaşımı | 4,1 m | 3,1 m | Dar inişler; dash / wall-run alternatifi |

Sektörlerde her atlama için wall-run zorunlu değildir; bu örnek bir mekanik hattıdır. Tam oyunda beceriyi zorunlu kılan modüller ayrıca yazılmalı ve geometriyle doğrulanmalıdır.

## İlk oyun testi için ölçümler

Sektör başlama/bitirme süresi, checkpoint başına ölüm, terminal rol değişimi, bağlantı kopması, yeniden katılma süresi, FPS/frame-time, RTT/jitter, fizik düzeltme mesafesi. 50/100/200 ms gecikme ve kısa bağlantı kayıpları altında operatör–koşucu iletişimi denenmeli. Test edilmemiş bir hedefi tamamlanmış oyun süresi veya FPS sonucu diye raporlama.
