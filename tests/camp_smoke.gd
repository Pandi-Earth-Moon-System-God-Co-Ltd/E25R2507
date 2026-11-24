extends SceneTree

const GAME := preload("res://scenes/camp_game.tscn")

var _failures: Array[String] = []
var _save_path := "user://p0-smoke-%s" % OS.get_process_id()
var _capture_path := ""
var _checks := 0


func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--capture="):
			_capture_path = argument.trim_prefix("--capture=")
	_run.call_deferred()


func _run() -> void:
	var game := _new_game()
	await _physics_frames(24)
	_expect(game.region_id == "clearing" and game.player.is_on_floor(), "Fresh game starts safely in the clearing")
	await _capture("camp")

	var start: Vector3 = game.player.position
	_key(KEY_W, true)
	await _physics_frames(27)
	_expect(game.player.position.z < start.z - 1.5 and game.player.animations.current_animation == "walk", "Physical W input moves the avatar and plays its imported walk clip")
	_expect(game.player.footsteps.stream != null, "Movement triggers a footstep sample")
	_key(KEY_W, false)
	await _physics_frames(9)
	await _tap(KEY_F)
	_expect(game.state.items.wood == 1, "First wood is collectible by walking from spawn")

	_key(KEY_Q, true)
	await _physics_frames(14)
	_key(KEY_Q, false)
	_expect(absf(game.player.orbit.rotation.y) > 0.25, "Q orbits the view")
	var before_zoom: float = game.player.zoom
	var wheel := InputEventMouseButton.new()
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel.position = Vector2(640, 360)
	wheel.pressed = true
	root.push_input(wheel, true)
	await _physics_frames(9)
	_expect(game.player.zoom < before_zoom, "Mouse wheel zooms the overhead camera")
	await _tap(KEY_V)
	await _physics_frames(3)
	_expect(game.player.first_person and not game.player.appearance.visible and game.player.camera.position.is_zero_approx(), "V switches the actual camera and hides the first-person avatar")
	await _tap(KEY_F1)
	_expect(game.player.input_locked, "Help blocks player input")
	await _tap(KEY_ESCAPE)
	await _tap(KEY_V)
	_expect(not game.player.first_person and not game.player.input_locked, "Escape closes help and V restores overhead play")
	game.player.orbit.rotation.y = 0.0

	await _interact(game, &"workbench", Vector3(0, 0, 1.03))
	_expect(game.state.items.wood == 1 and game.state.items.fire_kit == 0, "Crafting with missing ingredients leaves inventory unchanged")
	await _interact(game, &"wood_stump")
	await _interact(game, &"stone_path")
	await _interact(game, &"workbench", Vector3(0, 0, 1.03))
	_expect(game.state.items.wood == 0 and game.state.items.stone == 0 and game.state.items.fire_kit == 1, "Workbench consumes two wood and one stone and produces the fire kit")
	await _interact(game, &"campfire", Vector3(-0.88, 0, 0.65))
	_expect(game.state.fire_lit and game.state.items.fire_kit == 0, "Fire kit lights the fire and is consumed")
	await _capture("camp-lit")

	var before_transition: Vector3 = game.player.position
	var original: Node3D = game.region
	_expect(not game.switch_region("cabin", &"missing") and game.region == original and original.is_inside_tree() and game.player.position == before_transition, "Invalid transition restores the active scene and position")
	await _interact(game, &"enter_cabin", Vector3(0, 0, 0.65))
	_expect(game.region_id == "cabin" and game.player.is_on_floor(), "Cabin entrance lands on the interior floor")
	_expect(game.player.camera.position.z > 4.0, "Cabin entrance keeps the overhead camera above the room")
	await _capture("cabin")
	await _interact(game, &"leave_cabin", Vector3(0, 0, -0.71))
	_expect(game.region_id == "clearing" and game.player.position.distance_to(Vector3(6.3, 0, -0.8)) < 0.3, "Cabin exit returns in front of the exterior door")
	await _interact(game, &"enter_cave", Vector3(0, 0, 0.65))
	_expect(game.region_id == "cave" and game.player.is_on_floor(), "Cave entrance lands on the chamber floor")
	_expect(game.player.camera.position.z > 4.0, "Cave entrance keeps the overhead camera above the chamber")
	await _capture("cave")
	await _interact(game, &"stone_chamber")
	_expect(game.state.items.stone == 1, "Cave resource is collectible")
	await _interact(game, &"leave_cave", Vector3(0, 0, -0.7))
	_expect(game.region_id == "clearing" and game.player.position.distance_to(Vector3(-12, 0, -8.9)) < 0.3, "Cave exit returns in front of the mouth")

	await _tap(KEY_F5)
	var saved_point: Vector3 = game.player.position
	game.player.place_at(Vector3(0, 0.15, 7), false)
	await _tap(KEY_F9)
	_expect(game.player.position.distance_to(saved_point) < 0.3, "F5 and F9 round-trip the actual player position")
	game.queue_free()
	await process_frame
	await process_frame
	game = _new_game()
	await _physics_frames(10)
	_expect(game.state.fire_lit and game.state.items.stone == 1 and not game.region.resources[&"wood_path"].visible, "New game instance restores fire, inventory and gathered resources")

	var records: Array[Dictionary] = game.store._records()
	var latest: int = game.store._newest_slot(records)
	var damaged := FileAccess.open(_save_path.path_join(game.store.SLOTS[latest]), FileAccess.WRITE)
	damaged.store_string("incomplete save")
	damaged.close()
	var recovered: Dictionary = game.store.load_state()
	_expect(recovered.found and recovered.recovered and recovered.state.fire_lit, "Corrupted newest save falls back to the previous verified slot")

	game.store.directory = _save_path.path_join(game.store.SLOTS[latest])
	await _interact(game, &"stone_cave")
	_expect(game.state.items.stone == 1 and game.region.resources[&"stone_cave"].visible, "Failed write rolls back pickup and leaves its model visible")
	for slot in game.store.SLOTS:
		DirAccess.remove_absolute(_save_path.path_join(slot))
	DirAccess.remove_absolute(_save_path)

	if not _capture_path.is_empty():
		print("Renderer: %s | %s" % [RenderingServer.get_video_adapter_name(), RenderingServer.get_video_adapter_api_version()])
	print("Camp smoke: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)


func _new_game() -> Node3D:
	var game := GAME.instantiate() as Node3D
	game.store.directory = _save_path
	root.add_child(game)
	return game


func _expect(condition: bool, description: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(description)
		printerr("FAIL: " + description)


func _physics_frames(count: int) -> void:
	for frame in count:
		await physics_frame


func _key(key: Key, pressed: bool) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.physical_keycode = key
	event.pressed = pressed
	Input.parse_input_event(event)


func _tap(key: Key) -> void:
	_key(key, true)
	await process_frame
	_key(key, false)
	await process_frame


func _interact(game: Node3D, id: StringName, offset := Vector3.ZERO) -> void:
	var marker: Marker3D = game.region.interactions[id]
	game.player.place_at(marker.position + Vector3(0.0, 0.15, 0.0) + offset, game.region_id != "clearing")
	await _physics_frames(10)
	await _tap(KEY_F)
	await _physics_frames(12)


func _capture(name: String) -> void:
	if _capture_path.is_empty():
		return
	await _physics_frames(27)
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_expect(image != null and image.save_png(_capture_path.path_join(name + ".png")) == OK, "Rendered " + name)
