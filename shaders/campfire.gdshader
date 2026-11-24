shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, blend_add, depth_draw_never;

void fragment() {
	float height = UV.y;
	float sway = sin(TIME * 9.0 + height * 7.0) * 0.075 * (1.0 - height);
	float taper = pow(max(height, 0.05), 0.85) * 0.43;
	float width = abs(UV.x - 0.5 + sway);
	float tips = smoothstep(0.06, 0.55, height + 0.09 * sin(TIME * 10.0));
	ALPHA = (1.0 - smoothstep(taper * 0.29, taper, width)) * tips;
	ALPHA *= 1.0 - smoothstep(0.89, 0.99, height);
	ALBEDO = mix(vec3(0.9, 0.21, 0.035), vec3(1.0, 0.82, 0.31), pow(height, 1.8));
}
