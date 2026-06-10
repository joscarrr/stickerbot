import 'dotenv/config';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import qrcode from 'qrcode-terminal';
import sharp from 'sharp';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth, MessageMedia } = pkg;
const runFile = promisify(execFile);

const stickerAuthor = process.env.STICKER_AUTHOR || 'Sticker Bot';
const stickerPack = process.env.STICKER_PACK || 'Mis Stickers';
const maxVideoSeconds = parsePositiveNumber(process.env.MAX_VIDEO_SECONDS, 6);
const animatedStickerFps = parsePositiveNumber(process.env.ANIMATED_STICKER_FPS, 15);
const maxAnimatedStickerBytes = parsePositiveNumber(process.env.MAX_ANIMATED_STICKER_BYTES, 950000);
let isReady = false;

console.log('Iniciando bot de WhatsApp...');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('Escanea este QR con WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  console.log(`Cargando WhatsApp Web: ${percent}% ${message || ''}`.trim());
});

client.on('authenticated', () => {
  console.log('Sesion autenticada.');
});

client.on('ready', () => {
  isReady = true;
  console.log('Bot listo. Envia imagenes, GIFs o videos y se convertiran automaticamente.');
});

client.on('change_state', (state) => {
  console.log(`Estado de WhatsApp: ${state}`);
});

client.on('auth_failure', (message) => {
  console.error('Fallo de autenticacion:', message);
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.log('Bot desconectado:', reason);
});

client.on('message', async (message) => {
  try {
    if (!message.hasMedia) return;

    const media = await message.downloadMedia();
    if (!media) {
      await message.reply('No pude descargar el archivo. Intenta reenviarlo y prueba otra vez.');
      return;
    }

    if (!isSupportedMedia(media.mimetype)) {
      await message.reply('Por ahora puedo convertir imagenes, GIFs y videos en stickers.');
      return;
    }

    const sticker = await buildSticker(media);
    await client.sendMessage(message.from, sticker, {
      sendMediaAsSticker: true,
      stickerAuthor,
      stickerName: stickerPack
    });
  } catch (error) {
    console.error('Error creando sticker:', error);
    await message.reply('Algo salio mal creando el sticker. Intenta con otro archivo o uno mas corto.');
  }
});

client.initialize();

setTimeout(() => {
  if (!isReady) {
    console.log([
      'WhatsApp Web sigue iniciando y todavia no emitio "ready".',
      'Si este mensaje se repite por varios minutos, cierra el bot con Ctrl+C y vuelve a correr npm start.',
      'Si sigue igual, borra .wwebjs_auth/ para forzar un QR nuevo.'
    ].join('\n'));
  }
}, 60000);

async function buildSticker(media) {
  if (isAnimatedMedia(media.mimetype)) {
    return buildAnimatedSticker(media);
  }

  const input = Buffer.from(media.data, 'base64');
  const output = await sharp(input, { animated: true })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({
      quality: 90,
      effort: 4
    })
    .toBuffer();

  return new MessageMedia('image/webp', output.toString('base64'), 'sticker.webp');
}

async function buildAnimatedSticker(media) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static no encontro un binario de ffmpeg para esta plataforma.');
  }

  const workdir = await mkdtemp(path.join(tmpdir(), 'sticker-bot-'));
  const inputPath = path.join(workdir, `input.${extensionFor(media.mimetype)}`);
  const outputPath = path.join(workdir, 'sticker.webp');

  try {
    await writeFile(inputPath, Buffer.from(media.data, 'base64'));

    const output = await convertAnimatedSticker(inputPath, outputPath);
    return new MessageMedia('image/webp', output.toString('base64'), 'sticker.webp');
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function convertAnimatedSticker(inputPath, outputPath) {
  for (const quality of [80, 65, 50]) {
    await runFile(ffmpegPath, [
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-t',
      String(maxVideoSeconds),
      '-vf',
      [
        `fps=${animatedStickerFps}`,
        'scale=512:512:force_original_aspect_ratio=decrease',
        'format=rgba',
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'
      ].join(','),
      '-loop',
      '0',
      '-an',
      '-vsync',
      '0',
      '-c:v',
      'libwebp',
      '-quality',
      String(quality),
      '-compression_level',
      '6',
      outputPath
    ]);

    const output = await readFile(outputPath);
    if (output.byteLength <= maxAnimatedStickerBytes || quality === 50) {
      return output;
    }
  }

  throw new Error('No se pudo crear el sticker animado.');
}

function isSupportedMedia(mimetype = '') {
  return mimetype.startsWith('image/') || mimetype.startsWith('video/');
}

function isAnimatedMedia(mimetype = '') {
  return mimetype === 'image/gif' || mimetype.startsWith('video/');
}

function extensionFor(mimetype = '') {
  const extensions = {
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/3gpp': '3gp'
  };

  return extensions[mimetype] || mimetype.split('/')[1] || 'bin';
}

function parsePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
