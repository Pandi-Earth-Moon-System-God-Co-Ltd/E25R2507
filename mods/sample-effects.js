'use strict';

/* ══════════════════════════════════════════════════════════
   示例：用 10~20 行注册两个自定义技能效果
   文件放在 mods/ 下，index.html 里已引入；照着改就能加自己的
   ══════════════════════════════════════════════════════════ */
(function(){
  if (typeof registerSkillEffect !== 'function') return;

  // 黑洞：把周围敌人往自己身上拽，再造成伤害
  registerSkillEffect('blackhole', {
    name: '黑洞',
    cast(ctx){
      const radius = 170;
      for (let i = ctx.enemies.length - 1; i >= 0; i--){
        const e = ctx.enemies[i];
        const dx = ctx.player.x - e.x, dy = (ctx.player.y - 10) - (e.y - 9);
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        e.x += dx * 0.18;
        e.y += dy * 0.18;
        ctx.particles(e.x, e.y - 9, '#9b7bff', 3);
        if (dist < 70) ctx.hit(e, i);
      }
      ctx.particles(ctx.player.x, ctx.player.y - 10, '#6a4dff', 12);
    },
  });

  // 冰环：近身一圈冰刺，命中并击退
  registerSkillEffect('frostRing', {
    name: '冰环',
    cast(ctx){
      const radius = 96;
      for (let i = 0; i < 10; i++){
        const a = i / 10 * Math.PI * 2;
        ctx.particles(ctx.player.x + Math.cos(a) * radius, (ctx.player.y - 10) + Math.sin(a) * radius, '#a8e4ff', 2);
      }
      for (let i = ctx.enemies.length - 1; i >= 0; i--){
        const e = ctx.enemies[i];
        const dx = e.x - ctx.player.x, dy = (e.y - 9) - (ctx.player.y - 10);
        if (Math.hypot(dx, dy) > radius + e.r) continue;
        ctx.hit(e, i);
        e.x += dx * 0.25;
        e.y += dy * 0.25;
      }
    },
  });
})();
