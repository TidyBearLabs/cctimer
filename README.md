# cctimer

Claude Code の 5時間レートリミットサイクルを macOS メニューバーに表示する Electron アプリです。

## 仕組み

Claude Code の status line は、Pro/Max などの Claude.ai サブスクライバー向けに `rate_limits.five_hour.resets_at` と `rate_limits.five_hour.used_percentage` を stdin JSON でスクリプトへ渡します。

このプロジェクトでは `scripts/claude-statusline.js` がその値を保存し、Electron アプリが保存先を監視してメニューバーに残り時間を表示します。

## インストール

最新の zip を [Releases](https://github.com/Yu-kiKimura/cctimer/releases) からダウンロードし、展開した `cctimer.app` を `Applications` に移動して起動してください。

## Claude Code 側の設定

アプリのポップオーバーにある `セットアップ` を押すと、`~/.claude/settings.json` に cctimer のラッパー command を設定します。

CLI から実行する場合は次のコマンドです。

```bash
npm run setup
```

既存の `statusLine.command` がある場合は上書きして消すのではなく、`~/Library/Application Support/cctimer/statusline-config.json` に元 command を保存します。Claude Code から渡された JSON は cctimer が先に保存し、その後で元 command に同じ JSON を渡すため、既存の status line 表示は維持されます。

設定時には `~/.claude/settings.json.cctimer-backup-*` というバックアップを作成します。Claude Code の次の応答以降に rate limit 情報が渡されると、メニューバー表示が更新されます。

## 保存先

デフォルトでは次の JSON ファイルに状態を保存します。

```text
~/Library/Application Support/cctimer/rate-limit.json
```

保存先を変える場合は、Electron アプリと statusline スクリプトの両方に同じ `CCTIMER_STATE_PATH` を指定してください。

## 注意

`rate_limits` は Claude.ai サブスクライバーで、かつ Claude Code セッション内の最初の API 応答後にだけ存在します。値がまだない場合、メニューバーには `↻ --:--:--` と表示されます。
