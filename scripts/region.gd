extends Node3D

var entry_points: Dictionary[StringName, Vector3] = {}
var interactions: Dictionary[StringName, Marker3D] = {}
var resources: Dictionary[StringName, Node3D] = {}


func place(asset: PackedScene, point: Vector3, size := 1.0, heading := 0.0) -> Node3D:
	var model := asset.instantiate() as Node3D
	model.position = point
	model.rotation.y = heading
	model.scale = Vector3.ONE * size
	add_child(model)
	return model


func solid_box(center: Vector3, size: Vector3) -> void:
	var shape := BoxShape3D.new()
	shape.size = size
	_solid(center, shape)


func solid_trunk(center: Vector3, height: float, radius: float) -> void:
	var shape := CylinderShape3D.new()
	shape.height = height
	shape.radius = radius
	_solid(center, shape)


func _solid(center: Vector3, shape: Shape3D) -> void:
	var body := StaticBody3D.new()
	body.position = center
	var collider := CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	add_child(body)


func interact_at(id: StringName, point: Vector3) -> void:
	var marker := Marker3D.new()
	marker.name = id
	marker.position = point
	add_child(marker)
	interactions[id] = marker


func gather_at(id: StringName, asset: PackedScene, point: Vector3, size: float, heading := 0.0) -> void:
	resources[id] = place(asset, point, size, heading)
	interact_at(id, point)


func add_environment(ambient: Color, energy: float, clear: Color, outdoor := false) -> Environment:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = clear
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = ambient
	environment.ambient_light_energy = energy
	if outdoor:
		var sky_material := ProceduralSkyMaterial.new()
		sky_material.sky_top_color = Color("647982")
		sky_material.sky_horizon_color = Color("d9c4a7")
		sky_material.ground_horizon_color = Color("d9c4a7")
		sky_material.ground_bottom_color = Color("7a7961")
		var sky := Sky.new()
		sky.sky_material = sky_material
		environment.sky = sky
		environment.background_mode = Environment.BG_SKY
	var world := WorldEnvironment.new()
	world.environment = environment
	add_child(world)
	return environment


func lamp(point: Vector3, color: Color, energy: float, radius: float) -> OmniLight3D:
	var light := OmniLight3D.new()
	light.position = point
	light.light_color = color
	light.light_energy = energy
	light.omni_range = radius
	add_child(light)
	return light
