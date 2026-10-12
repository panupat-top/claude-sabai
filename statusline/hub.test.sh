#!/usr/bin/env bash
# Tests for hub.sh: feeds it Claude Code's JSON and checks the two lines, colours stripped.
# Run: bash statusline/hub.test.sh (HUB_BASH=/bin/bash to try another bash).
cd "$(dirname "$0")" || exit 1
HUB=$PWD/hub.sh
SH=${HUB_BASH:-bash}
fails=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

run() { HUB_NOW=1792000000 TZ=UTC "$SH" "$HUB" <<<"$1"; }
# Colours stripped, a bar's dim track redrawn as ─ so the fill still shows.
plain() { run "$1" | perl -pe 's/\e\[90m((?:\xe2\x94\x81)+)/"\e[90m" . ("\xe2\x94\x80" x (length($1) \/ 3))/ge; s/\e\[[0-9;]*m//g'; }
check() {
  if [[ $2 == "$3" ]]; then echo "ok   $1"; else
    echo "FAIL $1"; printf '  want: %s\n  got:  %s\n' "$3" "$2"; fails=$((fails + 1))
  fi
}

# A repository two commits ahead of its upstream, one behind, with one file changed.
repo=$tmp/proj
g() { git -C "$repo" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
mkdir -p "$repo" && g init -b main && g commit --allow-empty -m 1 && g branch base
g commit --allow-empty -m 2 && g commit --allow-empty -m 3
g checkout base && g commit --allow-empty -m 4 && g checkout main && g branch -u base
touch "$repo/new.txt"

full='{"workspace":{"current_dir":"'$repo'"},"model":{"display_name":"Opus 5.5"},"effort":{"level":"high"},
  "cost":{"total_cost_usd":1.4213,"total_duration_ms":2280000},
  "context_window":{"context_window_size":1000000,"current_usage":{"input_tokens":2000,"cache_creation_input_tokens":3000,"cache_read_input_tokens":65000}},
  "rate_limits":{"five_hour":{"used_percentage":27.4,"resets_at":1792004320},"seven_day":{"used_percentage":18,"resets_at":1792123200}}}'
out=$(plain "$full")
check 'line 1: folder, branch with sync, then the session' "$(sed -n 1p <<<"$out")" '󰉖 proj  󰘬 main ↑2 ↓1 ±1    󱙺 Opus 5.5  󰓅 high  󰇁 1.42  󰔛 38m'
check 'line 2: context, 5H with its time left, 7D with its day and time' "$(sed -n 2p <<<"$out")" \
  '󰧑 CTX ━───────────   7%     󰅐 5H ━━━─────────  27%  1h 12m     󰭧 7D ━━──────────  18%  Fri 04:00'

check 'the engine'\''s own context percent wins over the token count' \
  "$(plain '{"workspace":{"current_dir":"'$tmp'"},"context_window":{"used_percentage":41.6,"current_usage":{"input_tokens":1}}}' | sed -n 2p)" \
  '󰧑 CTX ━━━━━───────  42%'

check 'no plan limits and no git: only what is known' \
  "$(plain '{"workspace":{"current_dir":"'$tmp'"},"model":{"display_name":"Sonnet 5.5"},"context_window":{"used_percentage":3}}')" \
  "󰉖 ${tmp##*/}    󱙺 Sonnet 5.5
󰧑 CTX ────────────   3%"

check 'under an hour the reset is minutes alone; a full meter fills every cell' \
  "$(plain '{"workspace":{"current_dir":"'$tmp'"},"rate_limits":{"five_hour":{"used_percentage":5,"resets_at":1792000720},"seven_day":{"used_percentage":100,"resets_at":1792123200}}}' | sed -n 2p)" \
  '󰅐 5H ━───────────   5%  12m     󰭧 7D ━━━━━━━━━━━━ 100%  Fri 04:00'
check 'a reset already passed reads 0m, never a negative time' \
  "$(plain '{"workspace":{"current_dir":"'$tmp'"},"rate_limits":{"five_hour":{"used_percentage":5,"resets_at":1791990000}}}' | sed -n 2p)" \
  '󰅐 5H ━───────────   5%  0m'

colours=$(run '{"workspace":{"current_dir":"'$tmp'"},"context_window":{"used_percentage":69},"rate_limits":{"five_hour":{"used_percentage":74},"seven_day":{"used_percentage":92}}}' | sed -n 2p)
check 'below amber a meter keeps its own colour; amber from 70, red from 90' \
  "$(grep -o $'\e\\[1m\e\\[3[0-9]m *[0-9]*%' <<<"$colours" | sed $'s/\e\\[1m\e\\[\\(3[0-9]\\)m */\\1 /' | tr '\n' ' ')" '36 69% 33 74% 31 92% '

check 'an empty input still draws the folder and exits cleanly' "$(cd "$tmp" && HUB_NOW=1 "$SH" "$HUB" <<<'{}' | sed $'s/\x1b\\[[0-9;]*m//g'; echo "exit $?")" "󰉖 ${tmp##*/}
exit 0"

check 'the session'\''s time waits for its first minute' \
  "$(plain '{"workspace":{"current_dir":"'$tmp'"},"cost":{"total_cost_usd":0.26,"total_duration_ms":59000}}')" "󰉖 ${tmp##*/}    󰇁 0.26"

out=$(SABAI_HUB_ICONS=0 plain "$full")
check 'without icons: dots between the session'\''s parts, a dollar sign, a ⎇ for the branch' "$(sed -n 1p <<<"$out")" 'proj  ⎇ main ↑2 ↓1 ±1    Opus 5.5 · high · $1.42 · 38m'
check 'without icons the meters keep their labels' "$(sed -n 2p <<<"$out")" \
  'CTX ━───────────   7%     5H ━━━─────────  27%  1h 12m     7D ━━──────────  18%  Fri 04:00'

echo
((fails)) && { echo "$fails failed"; exit 1; }
echo 'all passed'
