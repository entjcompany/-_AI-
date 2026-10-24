// scene.html을 프레임 단위로 캡처해 mp4로 굽는다.
// 사용법: node render.js [out.mp4] [fps]      미리보기: node render.js --stills 1.5,10,30
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'scene.html'));
  await page.evaluate(() => document.fonts.ready);

  if (args[0] === '--stills') {
    for (const t of args[1].split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(__dirname, `still_${t}.png`) });
    }
    await browser.close();
    return;
  }

  const out = args[0] || path.join(__dirname, 'qart_newtake.mp4');
  const fps = Number(args[1] || 24);
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * fps);
  // 무음 오디오 트랙을 함께 넣어 플랫폼 업로드 호환성을 맞춘다 (내레이션은 별도 녹음/TTS로 교체)
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
    '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.renderAt(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 240 === 0) console.error(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
})();
