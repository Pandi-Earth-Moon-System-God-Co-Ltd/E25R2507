# Pixel Survival Plus Mod API

The HTML file is the game entry point; styles live in `css/game.css` and game
logic is split across the ordered scripts in `js/`. These are classic scripts
that share the game's top-level scope, so keep their load order in the HTML
entry point when adding or moving scripts. The global API is available as
`window.PixelSurvivalModAPI` (API version `1.4.0`). This version adds
configurable skill-tree nodes alongside namespaced content registration for blocks, crops, machines, and machine
recipes while retaining the existing item, crafting recipe, technology, event,
inventory, and save methods. Machine recipes may declare an optional `energy`
cost (0–100 units per batch); wired or nearby generators can supply that
energy, while machines with fuel requirements can still use fuel as a fallback.

The source modules are grouped by responsibility: `core`, `world`, `input`,
`player`, `update`, `sprites`, `item-icons`, `render`, `hud`, `tooltip`,
`crafting`, `panels`, `guns`, `skills`, `village`, `growth`, `save`, `loop`, `mod-api`,
`studio`, and `startup`.

## Running a mod

There is no script loader yet. To try the example, open the HTML game, then
paste the contents of `Pixel_Survival_Plus_Mod_API_Example.js` into the browser
developer console after the page has loaded. The definitions are stored in the
current browser's local storage and restored the next time the game starts.

This API is **not a security sandbox**. Only run scripts you trust. It does not
provide script permission controls, isolation, automatic unloading, dependency
resolution, or a way to remove definitions once registered. Event listeners
can be unsubscribed with the function returned by `on`.

## In-game Game Studio

Press `F2` or open the Game Studio from the pause menu to create content without
writing JavaScript. The block, item, and industrial workshops register playable
content. The item workshop also creates and edits each item's crafting recipe on
the same page; the industrial workshop edits machine processing and its actual
in-game interface. Content can be edited from the MOD workshop. The map and
survival workshop creates playable 56×56 maps
with paintable grass, forest, stone, cave, river, desert, and snow terrain.
Creators can place trees, rocks, berry bushes, chests, ruins, and the player
spawn point; water is collected directly from river tiles. Maps are currently
finite 56×56 canvases; procedural unlimited chunk streaming is not implemented.
Generated maps can
be edited, saved, playtested, and included in team packages.

The opaque title screen offers continue, new-world, save/load, language, help,
and Game Studio entry points. Save management includes the automatic save and
three manual slots, with import/export for backups. Simplified Chinese and
English are available on the title screen, save manager, and help center.
Japanese also covers the gameplay HUD and panels, built-in item descriptions,
and Game Studio interface; custom text entered by players is preserved. The
three-page help center lists keyboard, mouse, and interface controls, including every keyboard shortcut and the
main-menu, HUD, inventory, and machine actions. Surface water can be crossed at reduced movement speed; enemies
still treat water as an obstacle.

Each map can configure day length, days per season, hunger and thirst rates,
night enemy intensity, and starting food and empty bottles. These rules are applied to
the playtest and persist with that world's save. The active map snapshot is
stored in the save, while editable maps are also stored in MOD definitions and
shared through team packages.

New survival worlds use seeded biome and river generation with a raised,
diamond-tile 2.5D view. The default day lasts 600 real seconds; there are no
time-speed or dawn-skip controls. Cave entrances connect the surface to a
dark underground region. Crops grow over time according to light, moisture,
season, and weather; harvested crops return seeds, so seeds do not need to be
crafted from unrelated materials. River water requires an empty bottle and can
be boiled in a furnace; drinking returns the bottle. Villages contain
stationary trading NPCs that buy and sell goods for coins. Wild animals move
without rotating their sprites, mature, and can be fed in pairs to breed.

Press `N` or click the lower-right skill grid to open the skill tree. Combat XP
is also skill XP; unlocked abilities can be equipped into four compact slots.
The `技能树工坊` creates or edits skill nodes using a built-in effect, level
requirement, XP cost, stamina cost, cooldown, and prerequisite skills selected
by their names and IDs. The studio shows a categorized ID overview and ID
suggestions; custom nodes use those predefined effects and are included in MOD
exports.

The `角色与视听` section groups player appearance and media settings. Its
`声音与画质` page controls generated background music, interaction
sounds, and ambient animation. It also exposes individual sound uploads for
attacking/harvesting, eating/using medicine, feeding, breeding, cave entry,
pickup, crafting, and machine completion. Item-specific sounds override the
matching operation sound when that item is used, collected, or crafted.
The item, industrial, and creature editors also accept content-bound sounds
and animations without switching workshops. Item and machine animations are
used as animated item/block textures; creature assets can be packaged, but
custom creatures remain design blueprints and do not run in-game.
Their source files are kept separately in
`assets/music/` and `assets/animations/`; the soundtrack is synthesized with
Web Audio and does not require external audio files. The workshop can also
import a short audio track and operation sound, or an animated GIF/PNG/WebP
environment effect. These assets are saved with MOD definitions and included
in JSON package export/import. Uploaded audio is limited to 256 KB per file;
animated images are limited to 512 KB and 512×512 pixels.

The `角色外观` page edits the player's saved appearance and can replace the
default pixel character with an uploaded static 32×48 PNG sprite. Animated
player sprites are not supported. The `声音与画质` page also offers
low/medium/high canvas render resolution and adjustable distance fog. The game
canvas scales to fit the available browser viewport while preserving its 16:9
aspect ratio. The renderer draws isometric
terrain in depth order without allocating and sorting a tile array every frame.

Custom industrial machines are created and edited in the `工业工坊`, including
their actual in-game machine UI. There is no separate UI workshop: machine
interfaces belong with the machine that uses them. Machine block texture, fuel,
up to 13 recipes, UI title,
labels, colors, and footer are applied to the actual machine panel. Each
machine recipe can use up to 12 input and 12 output item types. Crafting recipes are configured in the item workshop and can combine up to 12
item types, each with its own quantity;
the in-game crafting panel presents ingredients in two columns. Saved custom
recipes can be reopened and edited from the MOD workshop. Older UI-layout
blueprints remain importable and exportable for compatibility, but are no
longer editable; they can be deleted from the MOD workshop.

Creature AI and logic currently remain design blueprints and do not change game
behavior. The MOD workshop can edit or delete saved creature and logic
blueprints; edits keep the original blueprint ID and update its local
definition. Both are grouped under the `蓝图工坊` section. The Game Studio
window grows on larger screens and remains viewport-fitted on smaller displays.

Block and item creators can upload PNG, JPEG, or WebP images up to 4 MB. Images
are centered and scaled to 32×32 PNG, limited to 20 KB, and used by in-game
icons and placed blocks. Exporting a Game Studio JSON MOD package includes
content definitions, playable maps, blueprints, textures, and team name, author,
version, and notes. Teammates can import that package from the MOD workshop;
existing item, block, and machine definitions are not overwritten when IDs
conflict. Skill nodes intentionally support same-ID updates.

Game Studio data is stored in the browser's
`pixel-survival-v2-mod-definitions` local storage entry, separately from game
saves. Share the exported JSON package to transfer content to another browser
or teammate.

## Registration order

Use IDs such as `garden:turnip_seed`; the older unqualified IDs remain accepted
for compatibility. IDs must be unique across core content and registered
content. Register referenced items before crops, recipes, or machines:

1. `registerItem(id, definition)` registers a material, food, weapon, tool,
   armor, or seed.
2. `registerBlock(id, definition)` registers a placeable block item.
3. `registerCrop(id, definition)` binds a registered seed item to a registered
   harvest item.
4. `registerMachine(id, definition)` binds a placeable block and defines its
   fuel and initial recipes. Add further recipes with
   `registerMachineRecipe(machineId, recipe)`.
5. `registerRecipe(recipe)` adds a recipe to the player's normal crafting list.
   `registerTechnology(technology)` adds a technology node.

`configureSkillNode(id, definition)` adds or updates an ability node. Its
`effect` must be one of the built-in combat effects: `spin`, `dash`, `wave`,
`ward`, or `nova`.

```js
PixelSurvivalModAPI.configureSkillNode('team:wind_slash', {
  name: 'Wind Slash',
  desc: 'A ranged strike that costs stamina.',
  effect: 'wave',
  level: 2,
  xpCost: 40,
  cost: 20,
  cd: 8,
  requires: ['spin'],
});
```

Registration validates IDs, item references, counts, growth values, and machine
recipes. Crafting and machine input/output maps support up to 12 item types,
with counts from 1 to 99. Duplicate IDs with different definitions, missing item references,
invalid counts, and invalid machine recipes throw errors. Registration failures
are also reported in the console.

## Machine behavior

Machines are placed from the hotbar and opened by right-clicking nearby. The
player transfers input items and fuel from the inventory; machines consume
inputs and one configured fuel amount when a batch starts, advance using game
time, and place output in their own cache. Output stacks are limited to 99.
Machines stop when inputs, fuel, power, or output capacity are unavailable.

The base game includes a wood-fired generator, a daytime solar panel, and a
copper furnace that can use stored energy instead of consuming its wood fuel.
Place adjacent power wires between machines to join them to a shared power
grid; machines touching the same connected wire network can exchange stored
energy regardless of distance. Existing direct generator supply within eight
tiles remains available when both machines are not connected to a wire network.
The crusher turns copper/iron ore into metal powders and stone into stone dust;
the furnace can sinter metal powders back into ingots. The automatic harvester
uses two energy per mature crop, searches within four tiles, and stores crops
in its output cache. The logistics router points from a source machine toward
a destination machine, transfers one compatible item per second, and consumes
one energy per transferred item. Sources must have the item in their output
cache and destinations must accept it as recipe input or fuel.

Conveyor belts still move nearby ground drops along their facing direction and
can feed a compatible adjacent machine. Right-click a placed belt to rotate it.
Belts do not move fluids or items between distant areas. Underground iron ore,
explorable ruins, and deep-cave wardens are also included; the map remains
fixed-size and is not chunk-loaded or infinite.

Machine position, inventories, fuel, energy, health, and in-progress recipes,
direction, as well as belt directions/timers, ruin exploration state, and
player appearance, are saved in save version 12. Saves from versions 2–10
migrate with the default appearance; version 11 keeps existing appearance
choices and receives defaults for newly added customization fields. Versions
2–9 give older machines direction zero, and versions before 9 also receive
empty belts and generated default ruins. Machine energy defaults to zero if
absent.

Press `O` or open the pause menu's character option to customize skin tone,
hairstyle, hair color, clothing palette and style, eye color, facial details,
headwear, and back accessory. Appearance choices do not affect player
statistics or equipment.
The game's original low-resolution pixel rendering is retained; terrain now
uses deterministic surface/cave texture accents, and torchlight has a warm,
subtle glow rather than smoothing or upscaling the pixel art.

## Persistence and compatibility

Mod definitions are stored separately from game saves in
`pixel-survival-v2-mod-definitions`. A save containing mod item, crop, block,
or machine IDs requires those definitions to be available before that save is
loaded. Back up saves before experimenting with mods. The API does not yet
provide versioned mod migrations or missing-mod recovery.

Available events include:

- `itemAdded`: `{ id, n, total }`
- `crafted`: `{ id, count }`
- `newDay`: `{ day }`
- `machineCrafted`: `{ machine, recipe, x, y, output }`
- `conveyorDelivered`: `{ id, machine }`
- `ruinExplored`: `{ x, y }`
- `cropHarvested`: `{ crop, count, x, y, automatic }`
- `logisticsTransferred`: `{ id, from, to }`

Listeners should be short-running. Exceptions are reported to the console and
do not stop other game systems.
