# WhatsApp Sticker Bot

Bot sencillo para convertir imagenes, GIFs y videos de WhatsApp en stickers.

## Requisitos

- Node.js 20 o superior.
- Una cuenta de WhatsApp para escanear el QR de WhatsApp Web.

## Instalacion

```bash
npm install
cp .env.example .env
npm start
```

Cuando aparezca el QR en la terminal, escanealo desde WhatsApp:

```text
WhatsApp > Dispositivos vinculados > Vincular un dispositivo
```

## Uso

- Envia una imagen, GIF o video al chat del bot.
- El bot procesa el archivo automaticamente y envia el sticker.
- Si mandas varios archivos, procesa cada uno como sticker separado.
- Solo envia mensajes de texto cuando ocurre un error.

Los videos se recortan a los primeros segundos configurados y se convierten en stickers animados tipo GIF.
Puedes mandar varias imagenes, GIFs o videos; WhatsApp los entrega como mensajes separados y el bot procesa cada uno automaticamente.

## Configuracion

Edita `.env`:

```env
STICKER_AUTHOR=Sticker Bot
STICKER_PACK=Mis Stickers
MAX_VIDEO_SECONDS=6
ANIMATED_STICKER_FPS=15
MAX_ANIMATED_STICKER_BYTES=950000
```

Cada imagen, GIF o video recibido se convertira automaticamente en sticker.
`MAX_VIDEO_SECONDS` controla cuantos segundos toma de un video o GIF animado.
`ANIMATED_STICKER_FPS` controla los cuadros por segundo del sticker animado.
`MAX_ANIMATED_STICKER_BYTES` controla el peso objetivo de los stickers animados.

## Notas

El bot usa una sesion local de WhatsApp Web guardada en `.wwebjs_auth/`. Si quieres cerrar sesion y volver a escanear el QR, borra esa carpeta con el bot apagado.
