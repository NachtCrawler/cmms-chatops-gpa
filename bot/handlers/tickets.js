const { Scenes, Markup } = require('telegraf');
const mysql = require('mysql2/promise');

// Función auxiliar para conectar a la BD
const getDB = async () => {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
};

// Creamos la Escena (Asistente)
const ticketWizard = new Scenes.WizardScene(
    'TICKET_WIZARD',
    // PASO 1: Preguntar por el equipo (Mostrar botones)
    async (ctx) => {
        const db = await getDB();
        const [equipos] = await db.query('SELECT id_equipo, modelo FROM equipos');
        await db.end();

        // Creamos botones dinámicos con los equipos de la base de datos
        const botones = equipos.map(eq => 
            Markup.button.callback(eq.modelo, `eq_${eq.id_equipo}`)
        );

        await ctx.reply('🛠️ *Nuevo Reporte de Falla*\n\n¿Qué equipo presentó la falla?', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(botones, { columns: 1 })
        });
        return ctx.wizard.next();
    },
    // PASO 2: Recibir el equipo y preguntar por la descripción
    async (ctx) => {
        if (!ctx.callbackQuery) {
            return ctx.reply('Por favor, selecciona un equipo de la lista usando los botones.');
        }

        // Extraemos el ID del equipo del botón presionado (ej. "eq_1" -> 1)
        const id_equipo = ctx.callbackQuery.data.split('_')[1];
        ctx.wizard.state.id_equipo = id_equipo;
        
        await ctx.answerCbQuery(); // Quita el relojito de carga del botón
        await ctx.reply('📝 Describe brevemente el problema o la alarma que marca la máquina:');
        
        return ctx.wizard.next();
    },
    // PASO 3: Recibir la descripción, guardar en SQL y terminar
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            return ctx.reply('Por favor, escribe una descripción válida.');
        }

        const descripcion = ctx.message.text;
        const id_equipo = ctx.wizard.state.id_equipo;
        const id_usuario = ctx.from.id; // Tu ID de Telegram

        try {
            const db = await getDB();
            
            // Insertamos el ticket en la base de datos
            const [result] = await db.query(
                'INSERT INTO tickets (id_equipo, id_usuario_reporta, estatus, diagnostico_bot) VALUES (?, ?, "Abierto", ?)',
                [id_equipo, id_usuario, descripcion]
            );
            await db.end();

            await ctx.reply(`✅ *Ticket #${result.insertId} generado exitosamente.*\n\nEl sistema ha registrado la falla y ha iniciado el conteo del MTTR. Un técnico revisará tu caso.`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(error);
            await ctx.reply('⚠️ Hubo un error al guardar el ticket en la base de datos.');
        }

        // Salir de la escena (terminar el asistente)
        return ctx.scene.leave();
    }
);

module.exports = { ticketWizard };