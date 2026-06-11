Here is your comprehensive cheatsheet breaking down exactly what every abbreviation means and how the data structure is organized.

### Root Object Level

This is the top-level structure of the JSON payload saved to your `data` column in the database.

| Key | Data Type | Description |
| --- | --- | --- |
| **`u`** | String | **UUID**: The TagPro match UUID (appended during the POST route). |
| **`mN`** | String | **Map Name**: The name of the map played (appended during the POST route). |
| **`d`** | Integer | **Date**: The exact timestamp of the match (appended during the POST route). |
| **`iZ`** | Array of Integers | **Initial Zombies**: The roster indexes of the starting zombies. |
| **`r`** | Array of Objects | **Roster**: The master list of players. The array position (0, 1, 2...) serves as the player's universal ID throughout the rest of the payload. |
| **`pl`** | Object | **Players**: The core dictionary holding all match stats, keyed by the roster index. |
| **`lSP`** | Integer / Null | **Last Survivor Pop**: The precise frame/timestamp the final survivor was popped, triggering the end game boundary. |

---

### Roster Matrix (`r`)

Inside the `r` array, each object represents a player.

| Key | Data Type | Description |
| --- | --- | --- |
| **`n`** | String | **Name**: The player's display name. |
| **`a`** | Integer | **Authenticated**: Present only if the player is logged in (`1`). If they are not authenticated, this key is completely omitted to save space. |

---

### Player Stats Object (`pl`)

Inside the `pl` object, the keys are integers corresponding to the player's index in the `r` roster array. The values are the stripped payload objects for that specific player. Keys are omitted if they hold no data.

| Key | Data Type | Description |
| --- | --- | --- |
| **`sT`** | Integer | **Survival Total**: Total overall time spent surviving as a human. |
| **`sZ`** | Object | **Survival per Zombie Matrix**: Tracks how long the player survived against specific numbers of active zombies. Key is the zombie count, value is the time (e.g., `{"1": 4000, "2": 1500}`). |
| **`sK`** | Integer | **Spawn Kills**: The number of times the player was popped within 300 frames of spawning, or when zero zombies were active. |
| **`iT`** | Integer | **Invalid Tags**: The total number of invalid tags (e.g., tagging a spawned player or tagging someone when credit goes elsewhere) executed by this player. |
| **`tB`** | Object | **Tagged By**: Details about the final tag that ended this player's human run. |
| **`zS`** | Array of Objects | **Zombie Stints**: An array detailing every continuous period the player spent acting as a zombie. |

---

### Tag Events (`tB` and `tP`)

Both the `tB` (Tagged By) object on a victim and the `tP` (Tagged Players) array inside a zombie stint share this exact same structure detailing a single tag event.

| Key | Data Type | Description |
| --- | --- | --- |
| **`p`** | Integer | **Player Index**: The roster index of the killer (if inside `tB`) or the victim (if inside `tP`). |
| **`t`** | Integer | **Time**: The exact frame/timestamp the tag occurred. |
| **`z`** | Integer | **Zombies**: The number of active zombies on the map at the exact moment of the tag. |
| **`s`** | Integer | **Survivors**: The number of active survivors remaining *after* this tag happens. |

---

### Zombie Stints (`zS`)

If a player switches teams or leaves and comes back, they may have multiple zombie stints. Each stint object contains the following:

| Key | Data Type | Description |
| --- | --- | --- |
| **`zT`** | Integer | **Zombie Time**: The total duration of this specific stint played as a zombie. |
| **`vT`** | Integer | **Valid Tags**: The number of valid, credited tags this zombie made during this specific stint. |
| **`tP`** | Array of Objects | **Tagged Players**: A chronological array of the specific tags (using the Tag Event structure above) executed during this stint. |
