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
- 「貼天花力」會跟住風扇一齊變. 兩個數字用同一把尺, 因為推空氣幾大力, 推返架車就幾大力.
- 重力固定係 60. 吸力同重力並排比較.
- 貼天花力大過或者等於 60, 架車倒掛, 沿住天花行.
- 細過 60, 架車跌. 落地之後撳「重置再試」.
- 未落地之前拉大風扇, 淨力可以改為推向天花, 有機會升返上去.

## 畀家長同老師

呢個係簡化力學模型, 唔係任何一架生產車嘅實測. 公開風扇車專利同報道描述嘅布局大概係: 幾把電動涵道風扇裝喺車尾擴散器, 由車底入口抽走空氣, 再喺車尾出口向外吹出, 令車底壓力變低, 從而產生下壓力. 畫面跟呢個「輸出喺車尾, 唔係車頂」嘅布局. 重力設做固定 60. 風扇輸出由 0 到 100. 畫面上「貼天花力」等於「風扇輸出」, 方便比較大細. 當貼天花力細過重力, 車會向下跌. 當貼天花力大過或者等於重力, 車可以保持倒掛. 數字唔係真實車輛嘅牛頓或者公斤數. 「吸力」只係日常講法. 真正機制係風扇抽走同吹走空氣, 造成壓力差, 唔係魔法吸塵機. 請唔好理解成某一架出街跑車已經可以倒掛行車.

## For parents and teachers

This is a classroom thought experiment, not a claim about any production car. Public fan-car patents place ducted fans in the rear diffuser: they pull air from under the floor and exhaust it at the rear, lowering underbody pressure to create downforce. The demo uses that rear-outlet layout, not a roof-mounted fan. A fixed weight of 60 is compared with fan output on a shared 0-100 scale. The car stays upside down only when the holding force is at least its weight. The kid-facing word for that force is everyday "suction," and the page says it is not a magic vacuum cleaner.
