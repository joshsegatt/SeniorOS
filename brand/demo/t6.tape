# Records brand/social/demo-t6.gif from two real bench runs (see t6-replay.mjs).
# Run from the repository root: vhs brand/demo/t6.tape
Output brand/social/demo-t6.gif

Set Shell "pwsh"
Set FontFamily "Consolas"
Set FontSize 17
Set Width 1280
Set Height 700
Set Padding 32
Set LineHeight 1.35
Set TypingSpeed 0ms
Set Framerate 24
Set Theme { "name": "SeniorOS", "background": "#07101E", "foreground": "#F8FAFC", "cursor": "#2F80FF", "selection": "#263853", "black": "#07101E", "red": "#EF4444", "green": "#22C55E", "yellow": "#F59E0B", "blue": "#2F80FF", "magenta": "#94A3B8", "cyan": "#94A3B8", "white": "#F8FAFC", "brightBlack": "#94A3B8", "brightRed": "#EF4444", "brightGreen": "#22C55E", "brightYellow": "#F59E0B", "brightBlue": "#2F80FF", "brightMagenta": "#94A3B8", "brightCyan": "#94A3B8", "brightWhite": "#F8FAFC" }

# Warm up the shell and Node off camera, so the recording starts with the replay.
Hide
Type "node -e 0"
Enter
Sleep 6s
Type "Clear-Host; node brand/demo/t6-replay.mjs"
Enter
Sleep 400ms
Show
Sleep 24s
