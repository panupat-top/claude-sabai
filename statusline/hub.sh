#!/usr/bin/env bash
# sabai hub 1.0.0: Claude Code's status line for the terminal, the desktop's band in two lines.
#   ▤ claude-skins  ⎇ main ↑2 ±3    Opus 5.5 · high · $1.42 · 38m
#   CTX ▰▱▱▱▱▱▱▱▱▱▱▱   7%     5H ▰▰▰▱▱▱▱▱▱▱▱▱  27%  1h 12m     7D ▰▰▱▱▱▱▱▱▱▱▱▱  18%  Fri 04:00
# Reads only the JSON Claude Code pipes in and the folder's git; no network, no credentials.
# Needs bash 3.2+, jq and git. A part whose value is unknown is left out. Helpers write to
# variables (printf -v) rather than echo into $(…): every subshell is a fork, and it runs often.

input=$(cat)
now=${HUB_NOW:-${EPOCHSECONDS:-$(date +%s)}}

# One jq for every field, joined by the unit separator: a tab would let empty fields collapse.
IFS=$'\x1f' read -r dir model effort cost dur ctx five five_at seven seven_at < <(jq -r '
  def pct: if type == "number" then round else "" end;
  (.context_window.context_window_size // 200000) as $size
  | [ (.workspace.current_dir // .cwd // $ENV.PWD),
      (.model.display_name // ""),
      (.effort.level // ""),
      (.cost.total_cost_usd // ""),
      (.cost.total_duration_ms // ""),
      ((.context_window.used_percentage
        // (.context_window.current_usage | if . then ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)) * 100 / $size else null end)) | pct),
      (.rate_limits.five_hour.used_percentage | pct),
      (.rate_limits.five_hour.resets_at // ""),
      (.rate_limits.seven_day.used_percentage | pct),
      (.rate_limits.seven_day.resets_at // "")
    ] | map(tostring) | join("\u001f")' <<<"$input")

# The terminal's own 16 colours, so the line follows its theme, light or dark.
R=$'\e[0m' B=$'\e[1m' DIM=$'\e[90m' RED=$'\e[31m' GRN=$'\e[32m' YEL=$'\e[33m' BLU=$'\e[34m' MAG=$'\e[35m' CYN=$'\e[36m'
WARN_AT=70 ALERT_AT=90
CELLS=12

# A meter into $out: its label, 12 cells filled to the percent in its colour (amber, then red, past
# the marks), and the percent right-aligned in 4 columns.
meter() {
  local p=$2 c=$3 f i bar="" empty=""
  ((p >= WARN_AT)) && c=$YEL
  ((p >= ALERT_AT)) && c=$RED
  f=$(((p * CELLS + 50) / 100))
  ((f > CELLS)) && f=$CELLS
  for ((i = 0; i < CELLS; i++)); do ((i < f)) && bar+="▰" || empty+="▱"; done
  printf -v out '%s%s%s %s%s%s%s%s %s%s%3d%%%s' "$DIM" "$1" "$R" "$c" "$bar" "$R" "$DIM" "$empty" "$R" "$B$c" "$p" "$R"
}

# Seconds into $out as 1h 12m, or the minutes alone under an hour.
span() {
  local s=$(($1 < 0 ? 0 : $1))
  if ((s >= 3600)); then printf -v out '%dh %dm' $((s / 3600)) $((s % 3600 / 60)); else printf -v out '%dm' $((s / 60)); fi
}

# Line 1: the folder, its branch with what is ahead, behind and uncommitted, then the session.
line1="$B▤ ${dir##*/}$R"
if status=$(git --no-optional-locks -C "$dir" status --porcelain=v2 --branch 2>/dev/null); then
  branch="" ab="" changes=0
  while IFS= read -r l; do
    case $l in
      '# branch.head '*) branch=${l#'# branch.head '} ;;
      '# branch.ab '*) ab=${l#'# branch.ab '} ;;
      '#'*) ;;
      ?*) ((changes++)) ;;
    esac
  done <<<"$status"
  ahead=0 behind=0
  [[ $ab =~ ^\+([0-9]+)\ -([0-9]+)$ ]] && ahead=${BASH_REMATCH[1]} behind=${BASH_REMATCH[2]}
  line1+="  $MAG⎇ $branch$R"
  ((ahead > 0)) && line1+=" $GRN↑$ahead$R"
  ((behind > 0)) && line1+=" $CYN↓$behind$R"
  ((changes > 0)) && line1+=" $YEL±$changes$R"
fi
# Joined with ${session:+ · }, not cut after: bash 3.2 cuts a string by bytes, and · is two.
session=""
[[ -n $model ]] && session+="${session:+ · }$model"
[[ -n $effort ]] && session+="${session:+ · }$effort"
[[ -n $cost ]] && printf -v out '$%.2f' "$cost" && session+="${session:+ · }$out"
[[ -n $dur ]] && span $((dur / 1000)) && session+="${session:+ · }$out"
[[ -n $session ]] && line1+="    $DIM$session$R"

# Line 2: context, then each plan limit with when it resets, five columns apart.
line2=""
if [[ -n $ctx ]]; then meter CTX "$ctx" "$CYN"; line2+="     $out"; fi
if [[ -n $five ]]; then
  meter 5H "$five" "$BLU"; line2+="     $out"
  [[ -n $five_at ]] && span $((five_at - now)) && line2+="  $DIM$out$R"
fi
if [[ -n $seven ]]; then
  meter 7D "$seven" "$YEL"; line2+="     $out"
  # The local weekday and 24-hour time it resets: Fri 04:00 (BSD date, then GNU).
  [[ -n $seven_at ]] && line2+="  $DIM$(date -r "$seven_at" '+%a %H:%M' 2>/dev/null || date -d "@$seven_at" '+%a %H:%M')$R"
fi

printf '%s\n' "$line1"
[[ -n $line2 ]] && printf '%s\n' "${line2:5}"
exit 0
