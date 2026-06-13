# Zomball Stats

Query params:
- `?period=today|week|month` (resets at 10 AM EST)
- `?players=Name%20One,Name%20Two`
- `?start=YYYY-MM-DDTHH:MM:SSZ` or Unix timestamp
- `?end=YYYY-MM-DDTHH:MM:SSZ` or Unix timestamp
- `?limit=N`

### Get match by tagpro.eu ID
```
GET https://stats.zomball.workers.dev/stats/:id
```

### Get match by UUID
```
GET https://stats.zomball.workers.dev/stats/:uuid
```

---

## Data Structure

### Full API Response (`/stats/all`)

| Key | Type | Description |
| --- | --- | --- |
| **`id`** | String | **TagPro.eu ID**: The match ID from tagpro.eu. |
| **`pAt`** | Integer | **Processed At**: Unix timestamp of when the match was processed and stored. |
| **`u`** | String | **UUID**: The TagPro match UUID. |
| **`mN`** | String | **Map Name**: The name of the map played. |
| **`d`** | Integer | **Date**: Unix timestamp of when the match was played. |
| **`iZ`** | Array of Integers | **Initial Zombies**: Roster indexes of the starting zombies. |
| **`r`** | Array of Objects | **Roster**: Master list of players. |
| **`pl`** | Array of Objects | **Players**: Player stats array. Index matches roster position. |
| **`lSP`** | Integer / Null | **Last Survivor Pop**: Frame the final survivor was popped. Null if survivors won. |
| **`matchLength`** | Integer | **Match Length**: Total duration of the match in frames. |

---

### Roster Entry (`r[i]`)

All keys except `n` are omitted if not applicable.

| Key | Type | Description |
| --- | --- | --- |
| **`n`** | String | **Name**: The player's display name. |
| **`a`** | Integer | **Authenticated**: `1` if the player is logged in. Omitted if not. |
| **`ljz`** | Integer | **Late Join Zombie**: `1` if the player joined as a zombie and was never a survivor. Omitted otherwise. |
| **`alt`** | Array of Strings | **Alternate Names**: Other Some Ball names this player used after dying and rejoining within 6 seconds. Omitted if none. |

---

### Player Stats (`pl[i]`)

All keys are omitted if empty or zero.

#### Survivor Side

| Key | Type | Description |
| --- | --- | --- |
| **`sT`** | Integer | **Survival Total**: Total frames spent alive as a survivor. |
| **`sZ`** | Object | **Survival per Zombie Count**: Time survived against each zombie count. Key is zombie count, value is frames. e.g. `{"1": 4000, "2": 1500}` |
| **`sK`** | Integer | **Spawn Kills**: Times popped within 300 frames of spawning, or when zero zombies were active. |
| **`tB`** | Object | **Tagged By**: The tag event that ended this player's survivor run. Omitted if they survived to the end. |
| **`ste`** | Integer | **Survived To End**: `1` if the player was alive when the match ended. Omitted otherwise. |

#### Zombie Side

| Key | Type | Description |
| --- | --- | --- |
| **`zT`** | Integer | **Zombie Time**: Total frames spent as a zombie. |
| **`vT`** | Integer | **Valid Tags**: Total valid credited tags made. |
| **`tP`** | Array of Objects | **Tagged Players**: Chronological list of tag events this player executed. |
| **`iT`** | Integer | **Invalid Tags**: Tags that were not credited (spawn kills, credit stolen by another zombie). |

---

### Tag Event (used in `tB` and `tP`)

| Key | Type | Description |
| --- | --- | --- |
| **`p`** | Integer | **Player Index**: Roster index of the killer (in `tB`) or the victim (in `tP`). |
| **`t`** | Integer | **Time**: Frame the tag occurred. |
| **`z`** | Integer | **Zombies**: Number of active zombies at the moment of the tag. |
| **`s`** | Integer | **Survivors**: Number of survivors remaining *after* this tag. |

---

## Notes

- To find survivors who won: filter `pl` for entries with `ste: 1`.
- To find the last person to become a zombie (when nobody survived): find the player with no `ste` and the highest `tB.t`.
- `alt` on a roster entry means that player died, refreshed, and rejoined as a new Some Ball name within 6 seconds. Their stats are accumulated under the original entry.
- `iZ` contains roster indexes of players who started the match as zombies. These are excluded from first/last/never-died calculations.
