const { Scenes, Markup } = require('telegraf');
const mysql = require('mysql2/promise');

const getDB = async () => {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
};

// --- ESCENA 1: REPORTAR FALLA (/fail) ---
const ticketWizard = new Scenes.WizardScene(
    'TICKET_WIZARD',
    async (ctx) => {
        const db = await getDB();
        const [equipos] = await db.query('SELECT id_equipo, modelo FROM equipos');
        await db.end();
        const botones = equipos.map(eq => Markup.button.callback(eq.modelo, `eq_${eq.id_equipo}`));
        await ctx.reply('🛠️ *Nuevo Reporte de Falla*\n\n¿Qué equipo presentó la falla?', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(botones, { columns: 1 })
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.callbackQuery) return ctx.reply('Por favor, selecciona un equipo de la lista usando los botones.');
        const id_equipo = ctx.callbackQuery.data.split('_')[1];
        ctx.wizard.state.id_equipo = id_equipo;
        await ctx.answerCbQuery(); 
        await ctx.reply('📝 Describe brevemente el problema o la alarma que marca la máquina:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) return ctx.reply('Por favor, escribe una descripción válida.');
        const descripcion = ctx.message.text;
        const id_equipo = ctx.wizard.state.id_equipo;
        const id_usuario = ctx.from.id; 

        try {
            const db = await getDB();
            const [result] = await db.query(
                'INSERT INTO tickets (id_equipo, id_usuario_reporta, estatus, diagnostico_bot) VALUES (?, ?, "Abierto", ?)',
                [id_equipo, id_usuario, descripcion]
            );
            await db.end();
            await ctx.reply(`✅ *Ticket #${result.insertId} generado exitosamente.*\n\nEl sistema ha registrado la falla y ha iniciado el conteo del MTTR.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(error);
            await ctx.reply('⚠️ Hubo un error al guardar el ticket.');
        }
        return ctx.scene.leave();
    }
);

// --- ESCENA 2: CERRAR TICKET (/fix) ---
const fixWizard = new Scenes.WizardScene(
    'FIX_WIZARD',
    async (ctx) => {
        await ctx.reply('🔧 *Cierre de Ticket*\n\nEscribe el número de ticket que deseas cerrar (ej. 1):', { parse_mode: 'Markdown' });
        return ctx.wizard.next();
    },
    async (ctx) => {
        const ticketId = ctx.message.text;
        if (isNaN(ticketId)) {
            return ctx.reply('Por favor, ingresa solo el número del ticket.');
        }

        try {
            const db = await getDB();
            // Buscamos si el ticket existe y está abierto
            const [rows] = await db.query('SELECT id_ticket FROM tickets WHERE id_ticket = ? AND estatus = "Abierto"', [ticketId]);
            
            if (rows.length === 0) {
                await db.end();
                await ctx.reply('❌ No se encontró un ticket abierto con ese número.');
                return ctx.scene.leave();
            }

            // Actualizamos el ticket con la fecha de cierre actual (NOW)
            await db.query('UPDATE tickets SET fecha_cierre = NOW(), estatus = "Cerrado" WHERE id_ticket = ?', [ticketId]);
            await db.end();

            await ctx.reply(`✅ *Ticket #${ticketId} cerrado exitosamente.*\n\nLa base de datos ha registrado la hora de finalización. El MTTR de este evento ha sido calculado.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(error);
            await ctx.reply('⚠️ Error al intentar cerrar el ticket.');
        }
        return ctx.scene.leave();
    }
);

// Exportar ambas escenas
module.exports = { ticketWizard, fixWizard };