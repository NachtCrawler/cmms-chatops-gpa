const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ ¡Conexión exitosa a la base de datos MariaDB en Docker!');
        
        // Consulta de prueba para ver si las tablas existen
        const [rows] = await connection.query('SHOW TABLES;');
        console.log('📊 Tablas encontradas en la base de datos:');
        console.table(rows);

        await connection.end();
    } catch (error) {
        console.error('❌ Error al conectar a la base de datos:', error.message);
    }
}

testConnection();
