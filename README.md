# cctimer

An Electron app that shows Claude Code's 5-hour rate limit cycle in the macOS menu bar.

## How It Works

For Claude.ai subscribers, such as Pro and Max users, Claude Code's status line passes `rate_limits.five_hour.resets_at` and `rate_limits.five_hour.used_percentage` to a script as JSON over stdin.

In this project, `scripts/claude-statusline.js` saves those values, and the Electron app watches the saved state to show the remaining time in the menu bar.

## Installation

Download the latest zip from [Releases](https://github.com/TidyBearLabs/cctimer/releases), extract it, move `cctimer.app` to `Applications`, and launch it.

## Claude Code Setup

Click `Setup` in the app popover to configure cctimer's wrapper command in `~/.claude/settings.json`.

To run setup from the CLI, use:

```bash
npm run setup
```

If an existing `statusLine.command` is configured, cctimer does not overwrite and discard it. Instead, it saves the original command to `~/Library/Application Support/cctimer/statusline-config.json`. cctimer first saves the JSON passed from Claude Code, then passes the same JSON to the original command, so your existing status line display is preserved.

During setup, cctimer creates a backup named `~/.claude/settings.json.cctimer-backup-*`. Once rate limit information is passed after the next Claude Code response, the menu bar display will update.

## Storage Location

By default, cctimer saves state to the following JSON file:

```text
~/Library/Application Support/cctimer/rate-limit.json
```

To change the storage location, set the same `CCTIMER_STATE_PATH` for both the Electron app and the status line script.

## Notes

`rate_limits` is only available for Claude.ai subscribers, and only after the first API response in a Claude Code session. If the value is not available yet, the menu bar shows `↻ --:--:--`.
