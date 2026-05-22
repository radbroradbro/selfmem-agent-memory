Claude CLI reviewer route was attempted with `claude -p --model opus`.

Result: blocked/empty. The command exited without review text, so this file is
not an approval and should not be counted as a passed council route.

Use Gemini's text review plus the captured browser evidence for this PR, then
rerun Claude review in a later gate if the route is healthy.
