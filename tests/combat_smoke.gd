extends SceneTree

const GAME := preload("res://scenes/camp_game.tscn")
const STORE := preload("res://scripts/camp_store.gd")
const BEETLE := preload("res://scripts/spore_beetle.gd")

var _failures := 0
var _checks := 0
var _save_path := "user://p1-smoke-%s" % OS.get_process_id()
var _capture_path := ""


func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--capture="):
			_capture_path = argument.trim_prefix("--capture=")
	_run.call_deferred()


func _run() -> void:
	var store := STORE.new()
	store.directory = _save_path
	_write_legacy_save(store)
	var game := _new_game()
	await _physics_frames(12)
	_expect(game.state.items.wood == 1 and game.player.health == 100 and not game.state.beetle_defeated, "Version 1 save keeps inventory and supplies version 2 defaults")
	await _tap(KEY_F)
	await _physics_frames(12)
	if not _expect(game.region_id == "cave", "Existing save can enter the cave through its interaction"):
		_finish()
		return
	var enemy: CharacterBody3D = game.region.creature
	_expect(enemy.health == 72 and enemy.phase == BEETLE.Phase.PATROL, "Beetle patrols while the player is out of detection range")
	_key(KEY_W, true)
	await _physics_frames(25)
	_key(KEY_W, false)
	_expect(enemy.phase in [BEETLE.Phase.CHASE, BEETLE.Phase.WINDUP], "Beetle chases a player who walks into range")
	game.player.place_at(Vector3(-0.72, 0.15, -2.75), true)
	enemy.reset_encounter(false)
	_expect(game.player.position.distance_to(enemy.position) > 1.6, "An encounter reset avoids spawning the enemy on a restored player")

	_align(game, enemy, 1.55)
	_key(KEY_R, true)
	await _physics_frames(8)
	_expect(enemy.phase == BEETLE.Phase.WINDUP and enemy.animations.current_animation == &"attack_light", "Enemy warns with its imported attack clip before damage")
	await _capture("combat")
	await _physics_frames(36)
	_key(KEY_R, false)
	_expect(game.player.health == 94 and enemy.phase == BEETLE.Phase.RECOVER, "Facing the strike with R reduces 22 damage to 6")

	_align(game, enemy, 1.55)
	await _physics_frames(24)
	_key(KEY_D, true)
	await _tap(KEY_SPACE)
	await _physics_frames(13)
	_key(KEY_D, false)
	_expect(game.player.health == 94 and game.player.position.x > 0.5, "Space dodges the incoming strike")

	_align(game, enemy, 1.55)
	game.player.reset_combat(10)
	await _physics_frames(38)
	_expect(game.player.health == 0, "An unguarded enemy strike can knock the player out")
	await _physics_frames(65)
	_expect(game.region_id == "clearing" and game.player.health == 100 and game.state.items.wood == 1, "Knockout returns to camp at full health and preserves existing supplies")
	game.player.place_at(Vector3(-12, 0.15, -9.55), false)
	await _physics_frames(8)
	await _tap(KEY_F)
	if not _expect(game.region_id == "cave", "Player can re-enter the cave after returning to camp"):
		_finish()
		return
	enemy = game.region.creature
	_align(game, enemy, 1.6)
	enemy.set_physics_process(false)
	game.player.appearance.rotation.y = PI
	var away_contacts: Array[String] = []
	var track_away := func(origin: Vector3, facing: Vector3) -> void:
		away_contacts.append("origin=%s facing=%s target=%s" % [origin, facing, enemy.global_position])
	game.player.melee_contact.connect(track_away)
	await _tap(KEY_J)
	await _physics_frames(37)
	game.player.melee_contact.disconnect(track_away)
	_expect(enemy.health == BEETLE.MAX_HEALTH, "A swing aimed away does not hit (enemy=%d, player yaw=%.2f, contacts=%s)" % [enemy.health, game.player.appearance.rotation.y, away_contacts])
	for strike in range(3):
		_align(game, enemy, 1.6, false)
		enemy.set_physics_process(false)
		if strike == 0:
			await _tap(KEY_J)
		else:
			if strike == 2:
				await _tap(KEY_V)
			await _physics_frames(4)
			var camera: Camera3D = game.player.camera
			var cursor := camera.unproject_position(enemy.global_position + Vector3.UP * 0.4) if strike == 1 else Vector2(root.size) * 0.5
			if strike == 2:
				await _capture("combat-first-person")
			await _click(cursor)
		await _physics_frames(13)
		if strike == 0:
			_expect(game.player.animations.current_animation == &"attack-melee-right" and enemy.animations.current_animation == &"hit" and enemy.health == 48, "J hits once and plays both clips (enemy=%d, player clip=%s, enemy clip=%s)" % [enemy.health, game.player.animations.current_animation, enemy.animations.current_animation])
		await _physics_frames(24)
	_expect(enemy.health == 0 and enemy.animations.current_animation == &"defeated" and game.state.beetle_defeated, "Keyboard and mouse strikes in both views defeat the beetle and play its defeated clip")
	var saved := store.load_state()
	_expect(saved.found and saved.state.beetle_defeated and saved.state.region == "cave" and saved.state.health == 100, "Victory saves the cave, player health, and enemy state")
	game.queue_free()
	await process_frame
	await process_frame
	game = _new_game()
	await _physics_frames(12)
	_expect(game.region_id == "cave" and game.state.items.wood == 1 and not game.region.creature.visible, "After restart the cleared enemy is absent and the v1 inventory survives")
	_finish()


func _new_game() -> Node3D:
	var game := GAME.instantiate() as Node3D
	game.store.directory = _save_path
	root.add_child(game)
	return game


func _write_legacy_save(store: RefCounted) -> void:
	DirAccess.make_dir_recursive_absolute(_save_path)
	var state: Dictionary = store.starting_state()
	state.erase("health")
	state.erase("beetle_defeated")
	state.position = [-12, 0.15, -9.55]
	state.items.wood = 1
	state.gathered.wood_path = true
	var payload := JSON.stringify({"version": 1, "generation": 1, "state": state})
	var file := FileAccess.open(_save_path.path_join(store.SLOTS[0]), FileAccess.WRITE)
	file.store_string(JSON.stringify({"payload": payload, "sha256": payload.sha256_text()}))
	file.close()


func _align(game: Node3D, enemy: CharacterBody3D, gap: float, reset_enemy := true) -> void:
	if reset_enemy:
		enemy.reset_encounter(false)
	enemy.position = Vector3(0.0, 0.02, -gap)
	game.player.place_at(Vector3(0.0, 0.02, 0.0), true)
	game.player.appearance.rotation.y = 0.0


func _physics_frames(number: int) -> void:
	for frame in number:
		await physics_frame


func _key(code: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.keycode = code
	event.physical_keycode = code
	event.pressed = pressed
	Input.parse_input_event(event)


func _tap(code: Key) -> void:
	_key(code, true)
	await process_frame
	_key(code, false)
	await process_frame


func _click(point: Vector2) -> void:
	var mouse := InputEventMouseButton.new()
	mouse.button_index = MOUSE_BUTTON_LEFT
	mouse.position = point
	mouse.pressed = true
	root.push_input(mouse, true)
	await process_frame
	var released := mouse.duplicate() as InputEventMouseButton
	released.pressed = false
	root.push_input(released, true)
	await process_frame


func _capture(name: String) -> void:
	if _capture_path.is_empty():
		return
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_expect(image != null and image.save_png(_capture_path.path_join(name + ".png")) == OK, "Rendered " + name)


func _expect(condition: bool, description: String) -> bool:
	_checks += 1
	if not condition:
		_failures += 1
		printerr("FAIL: " + description)
	return condition


func _finish() -> void:
	for slot in STORE.SLOTS:
		DirAccess.remove_absolute(_save_path.path_join(slot))
	DirAccess.remove_absolute(_save_path)
	print("Combat smoke: %d checks, %d failures" % [_checks, _failures])
	quit(0 if _failures == 0 else 1)
