# 倒掛天花嘅風扇車

小學科學互動頁. 調校一架想像中嘅大風扇車, 睇佢可唔可以倒掛貼住天花.

畫面用繁體中文 (香港用語). 打開瀏覽器就玩到, 唔使安裝, 亦冇後端.

網上版: [https://kytse.com/roadster-ceiling-fan-sim/](https://kytse.com/roadster-ceiling-fan-sim/)

## 點打開

1. 雙擊 `index.html`, 用瀏覽器打開.
2. 或者喺呢個資料夾開終端機, 執行:

```
python3 -m http.server 8741
```

然後去 [http://127.0.0.1:8741](http://127.0.0.1:8741).

平板橫放會舒服啲, 直放都用到.

## 點玩

- 拉動「風扇輸出」(0 到 100), 或者撳 -10 / +10, 又或者試 30, 60, 90.
- 畫面會同步顯示:
  - 抽出空氣流量 Q (m3/s 同公升/秒)
  - 車底壓力差 ΔP (kPa)
  - 下壓力 F (kN / kgf)
  - 同車重 1500 kg 比較
- 當下壓力大過或者等於車重, 架車可以倒掛.
- 細過車重就會跌.

### 重現「由地面升上天花」

1. 撳綠色掣 **由地面升上天花**.
2. 或者撳 **放喺地面自己試**, 再拉風扇到 **60% 或以上** (約 3.0 m3/s).
3. 撳 **重置到天花** 可以即刻返去天花開始.

## 畀家長同老師

課堂簡化模型, 唔係任何一架生產車嘅實測. 公開風扇車布局係車尾擴散器風扇由車底抽氣再向外吹.

簡化公式:

1. Q = Qmax x (風扇%/100), Qmax = 5.0 m3/s
2. ΔP = K x Q^2 (漏氣型關係: 流量愈大, 要更大壓力差)
3. F = ΔP x A, A = 2.5 m2
4. 車重 mg, m = 1500 kg; 當 F >= mg 可倒掛

流量數量級參考公開風扇車研究大約幾立方米每秒. 數字係示範值, 方便比較, 唔係儀表板實測.

## For parents and teachers

Classroom model, not production-car telemetry. Rear fans extract underbody air. The UI shows volume flow Q, pressure drop ΔP, and downforce F = ΔP x area versus a 1500 kg car. Q scales with the slider; ΔP scales with Q squared. Stick threshold is about 3.0 m3/s (60% fan). Order-of-magnitude values only.
