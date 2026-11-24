extends "res://scripts/region.gd"

const AUTUMN := preload("res://assets/survival/tree-autumn.glb")
const TALL_AUTUMN := preload("res://assets/survival/tree-autumn-tall.glb")
const FIR := preload("res://assets/nature/tree_cone_dark.glb")
const PINE := preload("res://assets/nature/tree_pineRoundB.glb")
const GRASS := preload("res://assets/nature/grass_leafs.glb")
const FLOWERS := preload("res://assets/nature/flower_yellowA.glb")
const BUSH := preload("res://assets/nature/plant_bushSmall.glb")
const MUSHROOMS := preload("res://assets/nature/mushroom_tanGroup.glb")
const ROCK_A := preload("res://assets/nature/rock_largeA.glb")
const ROCK_B := preload("res://assets/nature/rock_largeC.glb")
const BOULDER := preload("res://assets/survival/rock-c.glb")
const STUMP := preload("res://assets/survival/tree-trunk.glb")
const LOG := preload("res://assets/survival/tree-log-small.glb")
const FIRE_PIT := preload("res://assets/survival/campfire-pit.glb")
const TENT := preload("res://assets/survival/tent-canvas-half.glb")
const BEDROLL := preload("res://assets/survival/bedroll.glb")
const CHEST := preload("res://assets/survival/chest.glb")
const WORKBENCH := preload("res://assets/survival/workbench.glb")
const STONE := preload("res://assets/survival/resource-stone.glb")
const WOOD := preload("res://assets/survival/resource-wood.glb")
const WALL := preload("res://assets/town/wall.glb")
const WINDOW := preload("res://assets/town/wall-window-shutters.glb")
const DOOR := preload("res://assets/town/wall-doorway-square.glb")
const ROOF := preload("res://assets/town/roof-gable.glb")
const ROOF_END := preload("res://assets/town/roof-gable-end.glb")
const FENCE := preload("res://assets/town/fence-broken.glb")
const LANTERN := preload("res://assets/town/lantern.glb")
const CAVE_MOUTH := preload("res://assets/cave/gate-rock.glb")
const GROUND := preload("res://shaders/clearing_ground.gdshader")
const FLAME := preload("res://shaders/campfire.gdshader")

const FIRE_POINT := Vector3(-1.7, 0, 1.6)
const CABIN_CENTER := Vector3(6.3, 0, -4.5)
const CAVE_POINT := Vector3(-12.0, 0, -10.9)
const WORLD_EDGE := 33

var _flame: Node3D
var _firelight: OmniLight3D
var _flicker := 0.0


func _ready() -> void:
	entry_points = {&"start": Vector3(0.7, 0.15, 7.2), &"cabin": Vector3(6.3, 0.15, -0.8), &"cave": Vector3(-12.0, 0.15, -8.9)}
	var environment := add_environment(Color("b6c0bd"), 0.62, Color("d9c4a7"), true)
	environment.fog_enabled = true
	environment.fog_light_color = Color("b4bab0")
	environment.fog_density = 0.007
	environment.fog_sky_affect = 0.0
	var sunlight := DirectionalLight3D.new()
	sunlight.rotation_degrees = Vector3(-39.0, -37.0, 0.0)
	sunlight.light_color = Color("fff0d3")
	sunlight.light_energy = 0.81
	sunlight.shadow_enabled = true
	sunlight.shadow_bias = 0.16
	sunlight.shadow_normal_bias = 1.6
	sunlight.directional_shadow_max_distance = 45.0
	add_child(sunlight)
	_build_ground()
	_build_camp()
	_build_cabin()
	_build_cave_mouth()
	_plant_forest()


func set_fire_lit(lit: bool) -> void:
	_flame.visible = lit
	_firelight.visible = lit
	set_process(lit)


func _process(delta: float) -> void:
	_flicker += delta
	_firelight.light_energy = 1.75 + sin(_flicker * 8.0) * 0.17 + sin(_flicker * 17.0) * 0.09


func _build_ground() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for x in range(-WORLD_EDGE - 4, WORLD_EDGE + 4, 2):
		for z in range(-WORLD_EDGE - 4, WORLD_EDGE + 4, 2):
			var a := _ground_point(x, z)
			var b := _ground_point(x + 2, z)
			var c := _ground_point(x, z + 2)
			var d := _ground_point(x + 2, z + 2)
			for vertex in [a, b, c, b, d, c]:
				surface.add_vertex(vertex)
	surface.index()
	surface.generate_normals()
	var terrain := MeshInstance3D.new()
	terrain.mesh = surface.commit()
	var material := ShaderMaterial.new()
	material.shader = GROUND
	terrain.material_override = material
	add_child(terrain)
	terrain.create_trimesh_collision()
	for side in [-1.0, 1.0]:
		solid_box(Vector3(side * WORLD_EDGE, 3.0, 0), Vector3(0.5, 9.0, WORLD_EDGE * 2.0))
		solid_box(Vector3(0, 3.0, side * WORLD_EDGE), Vector3(WORLD_EDGE * 2.0, 9.0, 0.5))


func _ground_point(x: float, z: float) -> Vector3:
	var rim := smoothstep(15.0, 34.0, Vector2(x, z).length())
	var hill := rim * (1.2 + 0.8 * sin(x * 0.27 + z * 0.39) + 0.55 * cos(z * 0.28))
	return Vector3(x, hill, z)


func _build_camp() -> void:
	place(FIRE_PIT, FIRE_POINT, 4.9, 0.3)
	solid_trunk(FIRE_POINT + Vector3.UP * 0.22, 0.44, 0.57)
	interact_at(&"campfire", FIRE_POINT)
	place(TENT, Vector3(-4.2, 0.0, 1.8), 4.5, -0.18)
	solid_box(Vector3(-4.2, 0.75, 1.8), Vector3(2.05, 1.5, 1.8))
	place(BEDROLL, Vector3(-3.9, 0.0, 3.3), 3.15, 0.26)
	place(CHEST, Vector3(-3.7, 0.0, -0.1), 4.2, 0.14)
	place(WORKBENCH, Vector3(2.3, 0.0, 0.9), 4.8, -0.12)
	solid_box(Vector3(2.3, 0.57, 0.9), Vector3(1.3, 1.14, 1.11))
	interact_at(&"workbench", Vector3(2.3, 0.0, 0.9))
	place(STUMP, Vector3(0.1, 0.0, 2.6), 3.5)
	place(LOG, Vector3(-2.18, 0.0, 3.55), 2.65, 1.4)
	place(ROCK_A, Vector3(3.05, 0.0, 4.7), 1.5, 0.6)
	gather_at(&"wood_path", WOOD, Vector3(-0.7, 0.0, 5.15), 5.0, 0.7)
	gather_at(&"wood_stump", WOOD, Vector3(-3.25, 0.0, 4.75), 4.8, -0.8)
	gather_at(&"stone_path", STONE, Vector3(2.35, 0.0, 4.25), 4.5, 0.5)
	gather_at(&"stone_cave", STONE, Vector3(-10.6, 0.0, -8.85), 4.5, 0.5)
	_flame = Node3D.new()
	_flame.position = FIRE_POINT + Vector3.UP * 0.65
	add_child(_flame)
	var flame_mesh := QuadMesh.new()
	flame_mesh.size = Vector2(0.72, 0.91)
	var material := ShaderMaterial.new()
	material.shader = FLAME
	for angle in [0.0, PI * 0.5]:
		var plane := MeshInstance3D.new()
		plane.mesh = flame_mesh
		plane.material_override = material
		plane.rotation.y = angle
		plane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_flame.add_child(plane)
	_firelight = lamp(FIRE_POINT + Vector3.UP * 0.82, Color("ffa04b"), 1.75, 7.5)
	set_fire_lit(false)


func _build_cabin() -> void:
	const TILE := 2.18
	for index in [-1, 0, 1]:
		var offset: float = index * TILE
		var front := DOOR if index == 0 else WINDOW
		place(front, CABIN_CENTER + Vector3(offset, 0.0, 1.2), TILE, -PI * 0.5)
		place(WALL, CABIN_CENTER + Vector3(offset, 0.0, -1.2), TILE, PI * 0.5)
		if index != 0:
			solid_box(CABIN_CENTER + Vector3(offset, 1.1, 2.19), Vector3(TILE, 2.2, 0.28))
		var roof := place(ROOF if index == 0 else ROOF_END, CABIN_CENTER + Vector3(offset, 2.16, 0), TILE, PI if index > 0 else 0.0)
		roof.scale = Vector3(TILE / 1.10, TILE, 4.35)
	for side in [-1.0, 1.0]:
		for depth in [-1.08, 1.08]:
			place(WALL, CABIN_CENTER + Vector3(side * 2.28, 0.0, depth), TILE, 0.0 if side > 0.0 else PI)
		solid_box(CABIN_CENTER + Vector3(side * 3.26, 1.1, 0), Vector3(0.27, 2.2, 4.42))
	solid_box(CABIN_CENTER + Vector3(0, 1.1, -2.19), Vector3(6.6, 2.2, 0.28))
	solid_box(CABIN_CENTER + Vector3(0, 2.73, 0), Vector3(6.65, 0.68, 4.42))
	place(FENCE, Vector3(8.9, 0, -1.4), 2.6, -PI * 0.5)
	place(LANTERN, Vector3(7.55, 0, -0.75), 0.94)
	interact_at(&"enter_cabin", CABIN_CENTER + Vector3(0, 0, 2.12))


func _build_cave_mouth() -> void:
	place(CAVE_MOUTH, CAVE_POINT, 1.08)
	for index in range(4):
		var offset := float(index) - 1.5
		place(BOULDER, CAVE_POINT + Vector3(offset * 1.65, 0.0, -2.0), 5.4, index * 1.8)
	place(BOULDER, CAVE_POINT + Vector3(-2.45, 0.0, 0.33), 3.9)
	place(BOULDER, CAVE_POINT + Vector3(2.38, 0.0, 0.4), 4.4, 0.87)
	solid_box(CAVE_POINT + Vector3(0, 1.8, -1.8), Vector3(6.6, 3.65, 0.85))
	solid_box(CAVE_POINT + Vector3(-2.22, 0.75, 0), Vector3(1.25, 1.5, 1.5))
	solid_box(CAVE_POINT + Vector3(2.22, 0.75, 0), Vector3(1.35, 1.5, 1.5))
	place(LANTERN, CAVE_POINT + Vector3(-1.65, 0, 1.2), 0.9)
	interact_at(&"enter_cave", CAVE_POINT + Vector3(0, 0, 0.7))


func _plant_forest() -> void:
	var random := RandomNumberGenerator.new()
	random.seed = 231117
	var trees := [AUTUMN, TALL_AUTUMN, FIR, PINE]
	var plants := [GRASS, GRASS, BUSH, FLOWERS, MUSHROOMS, ROCK_A, ROCK_B]
	for x in range(-33, 34, 4):
		for z in range(-33, 34, 4):
			var point := _ground_point(x + random.randf_range(-1.25, 1.25), z + random.randf_range(-1.25, 1.25))
			if _trail_clearance(point) < 3.2 or Vector2(point.x, point.z).distance_to(Vector2(-0.9, 2.0)) < 7.35:
				continue
			if point.distance_to(CABIN_CENTER) < 5.0 or point.distance_to(CAVE_POINT) < 4.1:
				continue
			var size := random.randf_range(2.2, 4.4)
			place(trees[random.randi_range(0, trees.size() - 1)], point, size, random.randf_range(0.0, TAU))
			solid_trunk(point + Vector3.UP * 0.9, 1.8, size * 0.069)
	for index in range(238):
		var point := _ground_point(random.randf_range(-28, 28), random.randf_range(-28, 28))
		if _trail_clearance(point) < 1.7 or point.distance_to(CABIN_CENTER) < 3.8:
			continue
		place(plants[random.randi_range(0, plants.size() - 1)], point, random.randf_range(0.8, 2.0), random.randf_range(0.0, TAU))
	for point in [Vector2(-4.8, 5.8), Vector2(3.8, 4.4), Vector2(-6.3, -0.8), Vector2(8.9, 2.8), Vector2(-3.9, -4.6), Vector2(-8.0, -5.8), Vector2(-1.65, 8.6)]:
		place(GRASS, _ground_point(point.x, point.y), 2.8, 0.35)
		place(FLOWERS, _ground_point(point.x + 0.35, point.y + 0.15), 1.5, 0.9)


func _trail_clearance(point: Vector3) -> float:
	var spot := Vector2(point.x, point.z)
	var junction := Vector2(-0.2, 1.3)
	var bend := Vector2(-5.7, -4.7)
	var distance := spot.distance_to(Geometry2D.get_closest_point_to_segment(spot, Vector2(0.8, 11.5), junction))
	distance = minf(distance, spot.distance_to(Geometry2D.get_closest_point_to_segment(spot, junction, bend)))
	distance = minf(distance, spot.distance_to(Geometry2D.get_closest_point_to_segment(spot, bend, Vector2(-12.0, -9.4))))
	return minf(distance, spot.distance_to(Geometry2D.get_closest_point_to_segment(spot, junction, Vector2(6.3, -1.2))))
