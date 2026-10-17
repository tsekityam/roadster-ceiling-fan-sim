# 風扇車下壓力模擬

面向**中學物理**學生的互動模擬: 以體積流量、壓力差與力平衡, 分析「車尾風扇抽車底空氣」能否產生足以倒掛天花板的下壓力.

網上版: [https://kytse.com/roadster-ceiling-fan-sim/](https://kytse.com/roadster-ceiling-fan-sim/)

繁體中文介面. 無需安裝後端; 以瀏覽器開啟即可.

## 開啟方法

1. 雙擊 `index.html`, 或以瀏覽器開啟.
2. 或在本目錄執行:

```
python3 -m http.server 8741
```

然後前往 [http://127.0.0.1:8741](http://127.0.0.1:8741).

## 學習目標

- 應用力平衡: 倒掛時比較下壓力 F 與重量 mg.
- 理解壓力產生的力: F = ΔP · A.
- 把風扇輸出連到體積流量 Q, 再連到 ΔP 與 F.
- 辨識模型假設與局限 (非量產車實測).

## 模型方程

設風扇相對輸出 u ∈ [0, 1], 車底有效面積 A, 質量 m:

1. **體積流量**  
   Q = Q_max · u

2. **壓力差 (洩漏主導近似)**  
   若洩漏 Q ≈ C_d A_leak √(2ΔP / ρ), 則  
   ΔP = K · Q²

3. **下壓力**  
   F = ΔP · A

4. **可貼條件**  
   F ≥ mg

### 本頁預設參數

| 符號 | 數值 | 說明 |
|------|------|------|
| m | 1500 kg | 示範車質量 |
| g | 9.81 m/s² | 重力加速度 |
| A | 2.5 m² | 車底有效面積 |
| Q_max | 5.0 m³/s | 最大體積流量 |
| 臨界 u | 60% | 使 F = mg |
| 臨界 Q | 3.0 m³/s | 對應臨界點 |

K 由臨界點标定: 當 Q = 3.0 m³/s 時令 F = mg, 得  
K = (mg / A) / Q² ≈ 654 Pa·s²/m⁶.

## 操作提示

- 拉動風扇輸出, 即時讀取 Q、ΔP、F, 並與 mg 比較.
- **示範: 地面升至天花板** 可重現由 F &lt; mg 過渡到 F ≥ mg.
- **放置於地面** 後自行調至 ≥ 60% 亦可重現上升.

## 重要聲明

此為**思想實驗 / 課堂模型**. 布局參考公開風扇車專利 (車尾擴散器風扇, 由車底抽氣), **並非**聲稱任何量產 Tesla Roadster 或其他市售車輛已可倒掛行駛. 流量與力的數量級參考公開風扇車文獻中數 m³/s 與 kN 級力, 方便計算, 不是儀表板讀數.

## For teachers

Audience: senior secondary physics. SI units throughout (m³/s, Pa/kPa, N/kN), with kgf as a secondary reading. Core relations: Q ∝ u, ΔP ∝ Q², F = ΔP·A, stick iff F ≥ mg. Assumptions listed in the on-page model panel.
