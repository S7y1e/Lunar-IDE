# LunarInspect — live state for the Lunar IDE

Stream live game tables into Lunar's **State** tool window during a play-test —
a runtime view of your data (e.g. the class instances in `PlayerManager.players`),
flashing as values are added / removed / changed.

## Usage

1. Add `lunar-inspect.lua` to your **synced source tree** (e.g. `src/shared/LunarInspect.lua`)
   so Rojo/Argon keep it on every sync. If you're not syncing, paste it into a `ModuleScript`
   under `ReplicatedStorage` instead — but note a direct paste gets wiped on the next sync.
2. Enable **Game Settings → Security → Allow HTTP Requests**.
3. Watch any table you own:

```lua
-- adjust the path to wherever you placed the module:
local LunarInspect = require(game.ReplicatedStorage.Shared.LunarInspect)

local players = {}            -- your own hash table of Player instances
LunarInspect.watch("PlayerManager.players", players)

-- a getter works too, for locals you can't pass by reference:
LunarInspect.watch("Match.current", function() return currentMatch end)

LunarInspect.unwatch("Match.current")   -- removes it from the tree
```

Options (all optional): `LunarInspect.watch(name, t, { interval = 0.5, depth = 4, maxKeys = 200 })`.

4. Open the **State** tool window in Lunar (right dock) and run a play-test.

## JSON contract (POST → `http://127.0.0.1:34900`)

Lunar's bridge forwards any POSTed JSON to the UI. A state message looks like:

```json
{
  "state": {
    "watches": [
      { "name": "PlayerManager.players", "snapshot": { "42": { "hp": 100 } }, "t": 12.34 },
      { "name": "Match.current", "gone": true }
    ]
  }
}
```

- `snapshot` — any JSON value, already bounded by `depth` / `maxKeys` on the SDK side.
- `gone: true` — drops that watch from the tree.
- Lunar diffs consecutive snapshots itself; the SDK only sends full snapshots.

## Transport: game → Lunar

The default sink POSTs straight to `127.0.0.1:34900` via `HttpService`, which works
when *Allow HTTP Requests* is on. If you'd rather route through your existing Studio
plugin's bridge, swap the transport:

```lua
LunarInspect.setSink(function(jsonPayload)
    -- hand jsonPayload to your plugin channel, which POSTs it to :34900
end)
```
