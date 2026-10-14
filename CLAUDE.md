# Motor Test Hücresi

Tarayıcı simülatörü: `motor.html` (düzen + CSS) ve `js/` altındaki betikler (Türkçe arayüz, canvas + WebAudio).
claude.ai artifact olarak yayınlanır (`files` ile js/ dosyaları da gönderilir); bu yüzden motor.html'de
`<!doctype>/<html>/<head>/<body>` etiketleri YOK (yayında eklenir).
Yerel test: `./.mktest.sh` → `.test.html` (doctype + önbellek kırıcı), sonra `python -m http.server` ile açın.

Dosyalar: `js/core.js` (fizik+ECU, DOM'suz), `js/shared.js` (ses, motor değiştirme, ana döngü, VIEWS),
`js/lab.js` (laboratuvar), `js/garage.js` (garaj). Görünümler `VIEWS.<ad>` olarak kaydolur.
Motorlar `ENGINES` dizisinde; `applyEngine()` + `createSim()` ile değiştirilir (`switchEngine(id)`).
Motor parametresi değişirse dinamometreyle yeniden ölçüp `FACTORY_DYNO`'yu güncelleyin.

## Yapı
- `<script id="core">` — DOM'suz fizik + ECU. SI birimleri, açılar derece.
  - Silindir yerel açısı φ: 0 emme ÜÖN, 180 AÖN (IVC olayı), 360 ateşleme ÜÖN, 540 EVO olayı.
  - `cycleTrace()` IVC'de her silindir için 0.5° çözünürlükte kapalı çevrim basınç izi üretir
    (politropik sıkıştırma + Wiebe ısı salınımı). Tork = Σ (p − p_atm)·A·dx/dθ, anlık.
  - `simStep()` manifold dolumu (orifis akışı), λ sensörü gecikmesi, sürtünme, marş, termal, yük.
  - `ecuStep()/ecuInject()/ecuSpark()` hız-yoğunluk yakıt, kapalı döngü STFT/LTFT, rölanti PI,
    DFCO, devir limiti, vuruntu geri çekme, DTC zamanlayıcıları.
  - `factoryIgn()` ateşleme haritasını açılışta modelden hesaplar (MBT, 95 oktan vuruntu sınırı).
  - `drivetrain()` dinamometre (devir tut / sabit tork / çekiş taraması) ve araç (vites, debriyaj).
- İkinci `<script>` — çizim (kesit, 4 silindir şeridi, göstergeler, osiloskop, p–θ / log p–log V,
  dyno), ses (olay tabanlı ateşleme darbeleri), kontroller, ECU sekmeleri.

## Yeni özellik eklemek
- Ek sistem: `defineModule({id,name,desc,params,init,preStep,ecu,onCycle,status})` — Modüller
  sekmesi otomatik oluşur. Örnekler: turbo, kalkış kontrolü, nitro.
- Yeni arıza: `FAULTS` listesine ekle, etkisini `S.faults.<id>` ile simStep/onIVC içinde uygula,
  gerekiyorsa `DTC_DEF` + `setDTC()`.
- Yeni veri kanalı: `CH` dizisine ekle. Canlı veri satırı: `liveRows`.

## Kalibrasyon referansı (stok, 95 oktan)
Tam gaz çekiş ≈ 139 Nm @ 4800, ≈ 108 BG @ 6150. Rölanti 850 d/d, MAP ~30 kPa. Turbo 0.8 bar ≈ 215 Nm.
