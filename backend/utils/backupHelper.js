const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');

// Directorio por defecto para guardar respaldos: Documentos/PuntoEscolar/Backups
const getBackupDirectory = () => {
  const userHome = process.env.USERPROFILE || process.env.HOME || 'C:';
  const backupDir = path.join(userHome, 'Documents', 'PuntoEscolar', 'Backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

/**
 * Genera un respaldo SQL completo de la base de datos de manera nativa sin requerir mysqldump.
 */
async function crearRespaldoSilencioso() {
  const backupDir = getBackupDirectory();
  const dateStr = new Date().toISOString().slice(0, 10);
  
  // Para evitar sobreescribir si cierran caja varias veces el mismo día, añadimos marca de tiempo
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
  const fileName = `${dateStr}_${timeStr}.sql`;
  const fullPath = path.join(backupDir, fileName);

  try {
    let sqlDump = `-- Punto Escolar SQL Backup\n`;
    sqlDump += `-- Generado: ${new Date().toISOString()}\n`;
    sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // Lista de todas las tablas en orden de restauración recomendado
    const tables = [
      'permissions',
      'roles',
      'users',
      '_RolePermissions',
      'categories',
      'products',
      'inventory_movements',
      'customers',
      'sales',
      'services',
      'sale_items',
      'schools',
      'grades',
      'school_lists',
      'school_list_items',
      'cash_registers',
      'cash_movements',
      'audit_logs',
      'settings',
      'backups'
    ];

    for (const table of tables) {
      // 1. Limpiar tabla antes de insertar al restaurar
      sqlDump += `\n-- Estructura y datos de tabla: ${table}\n`;
      sqlDump += `TRUNCATE TABLE \`${table}\`;\n`;

      // 2. Consultar todos los registros de la tabla
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\``);
      
      if (rows && rows.length > 0) {
        // Obtener nombres de columnas
        const columns = Object.keys(rows[0]);
        const columnsStr = columns.map(c => `\`${c}\``).join(', ');

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) {
              return 'NULL';
            }
            if (typeof val === 'boolean') {
              return val ? '1' : '0';
            }
            if (val instanceof Date) {
              return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            if (typeof val === 'number' || typeof val === 'bigint') {
              return val.toString();
            }
            // Escapar strings para SQL
            let strVal = val.toString().replace(/'/g, "''").replace(/\\/g, "\\\\");
            return `'${strVal}'`;
          });

          sqlDump += `INSERT INTO \`${table}\` (${columnsStr}) VALUES (${values.join(', ')});\n`;
        }
      }
    }

    sqlDump += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;

    // Escribir archivo en disco
    fs.writeFileSync(fullPath, sqlDump, 'utf8');
    const stats = fs.statSync(fullPath);

    // Registrar en la tabla de respaldos
    const backupRecord = await prisma.backup.create({
      data: {
        fileName: fileName,
        sizeBytes: stats.size,
        status: 'COMPLETADO'
      }
    });

    return {
      success: true,
      fileName,
      filePath: fullPath,
      sizeBytes: stats.size,
      record: backupRecord
    };

  } catch (error) {
    console.error('Error al generar respaldo SQL nativo:', error);
    
    // Registrar error en base de datos si es posible
    try {
      await prisma.backup.create({
        data: {
          fileName: fileName,
          sizeBytes: 0,
          status: 'ERROR'
        }
      });
    } catch (_) {}

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Restaura la base de datos a partir de un archivo SQL local ejecutando las sentencias.
 */
async function restaurarRespaldo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('El archivo de respaldo no existe en la ruta proporcionada.');
  }

  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Dividir sentencias SQL por punto y coma (teniendo cuidado con saltos de línea)
    // Usamos regex simple pero efectivo para separar las instrucciones del dump
    const queries = sqlContent
      .split(/;\r?\n/)
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));

    // Ejecutar todas las sentencias en transacción secuencial
    await prisma.$transaction(async (tx) => {
      // Forzar desactivación de FK checks al inicio de la transacción
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      
      for (const query of queries) {
        await tx.$executeRawUnsafe(query);
      }
      
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    });

    return { success: true };
  } catch (error) {
    console.error('Error al restaurar respaldo SQL:', error);
    throw error;
  }
}

module.exports = {
  crearRespaldoSilencioso,
  restaurarRespaldo,
  getBackupDirectory
};
