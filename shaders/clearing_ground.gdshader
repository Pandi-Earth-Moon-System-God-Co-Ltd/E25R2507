shader_type spatial;
render_mode diffuse_burley, specular_disabled;

varying vec2 ground_position;

float hash_cell(vec2 cell) {
	return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 point) {
	vec2 cell = floor(point);
	vec2 uv = fract(point);
	uv = uv * uv * (3.0 - 2.0 * uv);
	return mix(mix(hash_cell(cell), hash_cell(cell + vec2(1, 0)), uv.x),
		mix(hash_cell(cell + vec2(0, 1)), hash_cell(cell + vec2(1, 1)), uv.x), uv.y);
}

float trail_distance(vec2 point, vec2 start, vec2 end) {
	vec2 edge = end - start;
	return length(point - start - edge * clamp(dot(point - start, edge) / dot(edge, edge), 0.0, 1.0));
}

void vertex() {
	ground_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	vec2 point = ground_position;
	float broad = noise(point * 0.26);
	float grain = noise(point * 6.0);
	float footprint = length((point - vec2(-0.3, 1.0)) * vec2(0.8, 1.06));
	float trail = trail_distance(point, vec2(0.8, 11.5), vec2(-0.2, 1.3));
	trail = min(trail, trail_distance(point, vec2(-0.2, 1.3), vec2(-5.7, -4.7)));
	trail = min(trail, trail_distance(point, vec2(-5.7, -4.7), vec2(-12.0, -9.4)));
	trail = min(trail, trail_distance(point, vec2(-0.2, 1.3), vec2(6.3, -1.2)));
	float worn = 1.0 - smoothstep(0.64, 1.83, trail + broad * 0.46);
	worn = max(worn, (1.0 - smoothstep(2.0, 5.0, footprint + broad * 1.5)) * 0.78);
	vec3 moss = mix(vec3(0.16, 0.21, 0.134), vec3(0.295, 0.325, 0.192), broad);
	vec3 earth = mix(vec3(0.28, 0.225, 0.156), vec3(0.42, 0.345, 0.231), broad);
	vec3 color = mix(moss, earth, worn);
	float leaf = step(0.965, hash_cell(floor(point * 12.0))) * (1.0 - worn * 0.55);
	ALBEDO = mix(color + (grain - 0.5) * 0.055, vec3(0.47, 0.28, 0.128), leaf * 0.38);
	ROUGHNESS = 1.0;
}
