/* ══════════════════════════════════════════════════════════
   启动
   ══════════════════════════════════════════════════════════ */
restoreModDefinitions();
try{
  const savedLanguage=localStorage.getItem('pixel-survival-language');
  if(savedLanguage==='zh-CN'||savedLanguage==='en'||savedLanguage==='ja')gameLanguage=savedLanguage;
}catch(error){
  console.error('[Pixel Survival] 无法读取语言设置',error);
}
updateDocumentLanguage();
reset();
titleMenuHasSave=loadGame();
panel='title';
resize();
requestAnimationFrame(loop);
