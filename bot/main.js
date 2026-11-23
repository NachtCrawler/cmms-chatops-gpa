const { Telegraf, Scenes, session } = require('telegraf');
const mysql = require('mysql2/promise');
const { ticketWizard, fixWizard } = require('./handlers/tickets'); // Importamos el ticket
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// 1. Configurar el manejo de Escenas
const stage = new Scenes.Stage([ticketWizard, fixWizard]);
bot.use(session());
bot.use(stage.middleware());

// 2. Middleware de Seguridad (Whitelist)
bot.use(async (ctx, next) => {
    // Si el usuario está dentro de una escena (ej. llenando un ticket), lo dejamos pasar directo
    if (ctx.session && ctx.session.__scenes && ctx.session.__scenes.current) {
        return next();
    }

    const telegramId = ctx.from.id;
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.query('SELECT nombre, rol FROM usuarios WHERE id_usuario = ? AND activo = TRUE', [telegramId]);
        await connection.end();

        if (rows.length > 0) {
            ctx.usuario = rows[0]; 
            return next();
        } else {
            return ctx.reply(`⛔ Acceso denegado.\n\nTu ID de Telegram es: ${telegramId}`);
        }
    } catch (error) {
        console.error('Error en middleware:', error);
        return ctx.reply('⚠️ Error interno de conexión a la base de datos.');
    }
});

// Comando /start
bot.start((ctx) => {
    ctx.reply(`¡Hola ${ctx.usuario.nombre}! 👋\nBienvenido al Sistema CMMS ChatOps de Grupo GPA.\n\nTu rol es: *${ctx.usuario.rol}*\n\nComandos disponibles:\n/fail - Reportar una falla nueva`, { parse_mode: 'Markdown' });
});

// Comando /fail (Ahora llama a la escena)
bot.command('fail', (ctx) => {
    ctx.scene.enter('TICKET_WIZARD');
});
// Comando /fix (Ahora llama a la escena)
bot.command('fix', (ctx) => {
    ctx.scene.enter('FIX_WIZARD');
});

// Comando /kpi (Cálculo de indicadores en tiempo real)
bot.command('kpi', async (ctx) => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // 1. Calcular MTTR
        const [mttrData] = await connection.query(`
            SELECT 
                COUNT(id_ticket) AS total_cerrados,
                ROUND(AVG(TIMESTAMPDIFF(SECOND, fecha_apertura, fecha_cierre) / 3600), 2) AS mttr_horas
            FROM tickets
            WHERE estatus = 'Cerrado'
        `);

        // 2. Contar tickets abiertos
        const [abiertosData] = await connection.query('SELECT COUNT(id_ticket) AS abiertos FROM tickets WHERE estatus = "Abierto"');

        await connection.end();

        const totalCerrados = mttrData[0].total_cerrados;
        const mttrHoras = mttrData[0].mttr_horas || 0; 
        const abiertos = abiertosData[0].abiertos;

        // Formatear el mensaje
        let mensaje = `📊 *Tablero de Control CMMS (KPIs)*\n\n`;
        mensaje += `🟢 Tickets Cerrados: ${totalCerrados}\n`;
        mensaje += `🟡 Tickets Abiertos: ${abiertos}\n\n`;
        
        if (totalCerrados > 0) {
            mensaje += `⏱️ *MTTR Actual:* ${mttrHoras} horas\n`;
            mensaje += `_Promedio calculado sobre los tickets cerrados._`;
        } else {
            mensaje += `⏱️ *MTTR Actual:* No hay datos suficientes (cierra un ticket con /fix).\n`;
        }

        await ctx.replyWithMarkdown(mensaje);

    } catch (error) {
        console.error(error);
        await ctx.reply('⚠️ Hubo un error al calcular los KPIs.');
    }
});
// Iniciar el bot
bot.launch().then(() => {
    console.log('🤖 Bot de Telegram iniciado y escuchando mensajes...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));