# Motor Test Hücresi

Tarayıcıda çalışan, krank açısı çözünürlüklü bir içten yanmalı motor simülatörü. Motoru çalıştırabilir, gaz verebilir, ECU haritalarıyla oynayabilir, dinamometrede çekiş alabilir ve arıza senaryolarını deneyebilirsiniz. Kurulum gerekmez, kütüphane kullanılmaz (canvas + WebAudio).

> **Durum: park edildi (Ekim 2026).** Proje şimdilik bırakıldı. Altı motorlu laboratuvar ve garaj çalışıyor; planlanan 3D sürüş ve oyun bölümü yapılmadı. Aşağıda "Yol haritası" kısmına bakın.

## Nasıl açılır

En kolayı: **`motor-tek-dosya.html`** dosyasını indirip çift tıklayın. Tarayıcıda açılır, internet gerekmez (yazı tipleri yoksa sistem fontu kullanılır).

Geliştirirken:

```bash
python build.py          # js/ betiklerini gömer: dist/motor.html + motor-tek-dosya.html
python -m http.server    # sonra http://localhost:8000/motor-tek-dosya.html
```

## Kontroller

| Tuş | İşlev |
|---|---|
| `I` | Kontak aç/kapat |
| `S` (basılı) | Marş |
| `W` / `↑` (basılı) | Tam gaz (bırakınca sürgü değerine döner) |
| `C` / `B` | Debriyaj / fren (araç modu) |
| `0`–`6` | Vites (araç modu) |
| `X` (basılı) | Nitro (modül takılıysa) |
| `T` | Zaman ölçeği: 1× · ¼× · 1/20× · 1/100× |
| `M` | Ses aç/kapat |

## Neler var

**Garaj: altı motor**, her biri kendi aracına bağlı. Değerler bu modelin dinamometresinde, stok ayarda ölçüldü:

| Motor | Düzen | Tork | Güç | Araç |
|---|---|---|---|---|
| 1.0 Üç Silindir Turbo | sıralı 3 | 168 Nm @ 1750 | 111 BG | kompakt hatchback |
| 1.6 Dört Silindir | sıralı 4, atmosferik | 140 Nm @ 4550 | 106 BG | aile sedanı |
| 2.0 Dizel Turbo | sıralı 4, common rail | 321 Nm @ 1750 | 132 BG | SUV |
| 3.0 Sıralı Altı Biturbo | sıralı 6 | 450 Nm @ 4750 | 376 BG | sport sedan |
| 5.0 V8 Atmosferik | 90° V8, çapraz düzlem | 458 Nm @ 4700 | 361 BG | kas coupe |
| 1.0 Motosiklet Dörtlüsü | sıralı 4, kısa strok | 102 Nm @ 10000 | 178 BG @ 13700 | süper spor motosiklet |

**Laboratuvar**
- Kesit animasyonu: piston, biyel, krank, kamlar, supaplar, buji kıvılcımı, enjektör, alev cephesi, 720° zamanlama şeridi.
- Gösterge paneli: devir, manifold/turbo basıncı, λ, su, yağ, akü, tork ya da hız ve uyarı lambaları.
- Veri kaydı (osiloskop). Yavaş zaman ölçeğinde tek tek ateşleme darbeleri görünür.
- Silindir basıncı: p–θ ve log p – log V, çevrimden çevrime değişim.
- **ECU:**
  - Canlı veri ekranı.
  - Düzenlenebilir VE ve ateşleme haritaları. Dizelde bunların yerini yakıt miktarı ve enjeksiyon avansı haritaları alır.
  - Kapalı döngü λ (STFT/LTFT), oto-tune, rölanti PI, yavaşlamada yakıt kesme, devir limiti, vuruntu kontrolü.
- Dinamometre: devir tutma, sabit tork ve tam gaz çekiş. Birden fazla çekişin eğrisi üst üste çizilir.
- Arıza simülasyonu (9 senaryo): buji/kızdırma, tıkalı enjektör, vakum kaçağı, ölü O2, MAP sapması, zayıf akü, yakıt pompası, fan, termostat. Her biri gerçekçi arıza kodları (P0303, P0171, P0134…) üretir.
- Modüller: turbo, kalkış kontrolü, nitro.
- Ses: her yanma ayrı bir darbe olarak çalınır. Tekleme, vuruntu, dizel takırtısı, marş, turbo ıslığı ve blow-off sesi de var.

## Fizik modeli (kısaca)

- Her silindir için emme supabı kapanırken 0.5° çözünürlükte basınç izi hesaplanır. Bunun için politropik sıkıştırma/genişleme ve Wiebe ısı salınımı kullanılır.
- Anlık tork, Σ (p − p_atm) · A · dx/dθ toplamından gelir.
- Emme manifoldu dolumu sıkıştırılabilir orifis akışıyla hesaplanır. Port enjeksiyonda duvar filmi, λ sensöründe taşıma gecikmesi modellenir. Sürtünme ortalama piston hızına bağlıdır. Soğutma devresi termostat ve fanla çalışır.
- Ateşleme haritası açılışta modelden hesaplanır: her hücrede en iyi tork avansı (MBT) bulunur, vuruntu sınırının altında tutulur.

Isınma süresi gerçeğe göre yaklaşık 7 kat hızlandırılmıştır.

## Kod yapısı

| Dosya | İçerik |
|---|---|
| `motor.html` | Düzen ve CSS. `js/` betiklerini yükler. |
| `js/core.js` | Fizik + ECU (DOM'suz): `ENGINES`, `applyEngine()`, `createSim()`, `simStep()`, modül sistemi |
| `js/shared.js` | Ortak yardımcılar, ses motoru, motor değiştirme, ana döngü, görünüm kaydı (`VIEWS`) |
| `js/lab.js` | Laboratuvar görünümü |
| `js/garage.js` | Garaj görünümü |
| `build.py` | Tek dosya derlemesi |

Ayrıntılı mimari notları `CLAUDE.md` içinde.

**Yeni özellik eklemek:**
- **Motor:** `ENGINES` dizisine ekleyin, dinamometreyle ölçüp `FACTORY_DYNO`'yu güncelleyin.
- **Ek sistem:** `defineModule({id, name, desc, params, init, preStep, ecu, onCycle, status})` kullanın. Modüller sekmesi otomatik oluşur.
- **Arıza:** `FAULTS` listesine ekleyin; gerekiyorsa `DTC_DEF` + `setDTC()`.
- **Görünüm:** `VIEWS.ad = {el, input, render, slow, onEngine, onShow, key}` kaydedin.

## Yol haritası (yapılmadı)

1. **3D sürüş (three.js):** şehir ve otoban, kokpit, direksiyon, pedallar, trafik ve trafik ışıkları. Araç boyuna dinamiği (vites, debriyaj, sürüklenme) çekirdekte hazır.
2. **Oyunlaştırma:** görevler (kırmızıda geçmeden şehir turu, ekonomi sürüşü, 0-100, drag), para, motor ve parça kilitleri, sürüş sırasında rastgele arızalar.
3. Diğer fikirler: değişken kam zamanlaması (VVT), otomatik şanzıman, harita kaydet/yükle.
