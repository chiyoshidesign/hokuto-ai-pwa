# 北斗AI実戦アプリ v1.0

## ファイル
- index.html
- styles.css
- app.js
- manifest.webmanifest
- service-worker.js
- icons/

## ローカル確認
VSCodeのターミナルで、このフォルダへ移動して実行します。

python3 -m http.server 8080

MacのSafariで次を開きます。

http://localhost:8080

## iPhoneで使う
PWAとしてホーム画面へ追加するには、HTTPSで公開します。
GitHub Pagesなどへこのフォルダの中身を配置してください。

## ランキングCSV形式
予測対象日,順位,台番号,予測点,推奨区分,モデル
2026-07-23,1,20,45.4,候補,V3.0
2026-07-23,2,11,40.1,見送り寄り,V3.0

## データ保存
実戦記録・設定・ランキングはブラウザのlocalStorageへ保存されます。
SafariのWebサイトデータを削除すると消えるため、定期的にCSVまたはバックアップJSONを書き出してください。
