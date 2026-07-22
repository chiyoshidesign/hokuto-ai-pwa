# 北斗AI V7.0 全面アップグレード版

GitHub Pagesの既存リポジトリへ以下を上書きしてください。

- index.html
- styles.css
- app.js
- manifest.webmanifest
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

旧 sw.js は削除して構いません。
sample_ranking.csv と README.md は残しても問題ありません。

## 主な機能
- V6.4ランキングCSV読込
- Top順位から実戦画面へ台番号・順位を自動設定
- 複数初当たり/RUSH/連チャン/出玉記録
- 投資・回転率・収支自動計算
- 実戦履歴、勝率、累計収支
- CSV/JSONバックアップ
- オフライン動作

## Mac取込
import_hokuto_v7_practice.py を hokuto_auto に置きます。
iPhoneから書き出したCSVを同フォルダへ置いて実行:

python3 import_hokuto_v7_practice.py "hokuto_practice_all_YYYY-MM-DD.csv"
