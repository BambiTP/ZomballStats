# Zomball Match Data Structure

## Full API Response (`/stats/all`)

Each match object returned by the API contains the following top-level fields.

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

## Roster Entry (`r[i]`)

All keys except `n` are omitted if not applicable.

| Key | Type | Description |
| --- | --- | --- |
| **`n`** | String | **Name**: The player's display name. |
| **`a`** | Integer | **Authenticated**: `1` if the player is logged in. Omitted if not. |
| **`ljz`** | Integer | **Late Join Zombie**: `1` if the player joined as a zombie and was never a survivor. Omitted otherwise. |
| **`alt`** | Array of Strings | **Alternate Names**: Other names this player used in the match (unauth Some Ball merges). Omitted if none. |
| **`merged`** | Integer | **Merged Into**: Roster index this entry was merged into. Present only on merged entries — `pl[i]` will be null for these. |

---

## Player Stats (`pl[i]`)

All keys are omitted if empty or zero. `pl[i]` is null if the roster entry was merged into another player.

### Survivor Side

| Key | Type | Description |
| --- | --- | --- |
| **`sT`** | Integer | **Survival Total**: Total frames spent alive as a survivor. |
| **`sZ`** | Object | **Survival per Zombie Count**: Time survived against each zombie count. Key is zombie count, value is frames. e.g. `{"1": 4000, "2": 1500}` |
| **`sK`** | Integer | **Spawn Kills**: Times popped within 300 frames of spawning, or when zero zombies were active. |
| **`tB`** | Object | **Tagged By**: The tag event that ended this player's survivor run. Omitted if they survived to the end. |
| **`ste`** | Integer | **Survived To End**: `1` if the player was alive when the match ended. Omitted otherwise. |

### Zombie Side

| Key | Type | Description |
| --- | --- | --- |
| **`zT`** | Integer | **Zombie Time**: Total frames spent as a zombie. |
| **`vT`** | Integer | **Valid Tags**: Total valid credited tags made. |
| **`tP`** | Array of Objects | **Tagged Players**: Chronological list of tag events this player executed. |
| **`iT`** | Integer | **Invalid Tags**: Tags that were not credited (spawn kills, credit stolen by another zombie). |

---

## Tag Event (used in `tB` and `tP`)

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
- Merged roster entries (`merged` key present) are unauth Some Ball players who left and rejoined as a zombie within 6 seconds (360 frames). Their stats are accumulated onto the original entry. Their index in `pl` is null.
- `iZ` contains the roster indexes of players who started the match as zombies. These are excluded from first/last/never-died calculations.
