<?php
// db_schema_update.php
require_once 'db_connect.php';

header('Content-Type: text/plain'); 

echo "--- INICIO DE LA ACTUALIZACIÓN DE ESQUEMA ---\n\n";

// 1. Define los comandos SQL de actualización
$sql_commands = [
    // Comando 1: Añadir la columna fcm_token a la tabla usuarios
    // Usamos IF NOT EXISTS para evitar errores si la columna ya existe.
    // "ALTER TABLE `usuarios` ADD COLUMN `fcm_token` VARCHAR(500) DEFAULT NULL AFTER `fecha_creacion`;",
    
    // Comando 2: Actualizar el registro de administrador con un token de ejemplo (Opcional)
    // Si quieres asegurarte de que el administrador tenga un token inicial.
    // "UPDATE `usuarios` SET `fcm_token` = 'eHNQhNEiENYzy1wBYMn0ph:APA91bFall0HO1R54IankNJKJYFEe1r8WIFxaoEeOQWcO4VPBHfPShXNC8lso41hC8doBAEf2DavsWH_b-YwJ-J08Z-PQMF-f5mTbiUtyUv4USFI4yfuYpE' WHERE `id` = 1;",
    'INSERT INTO `usuarios` (`id`, `email`, `password`, `nombre`, `fecha_creacion`, `fcm_token`) VALUES (NULL, "admin2@gmail.com", "$2y$10$Epwt9l/vt4bZdVZEzBCg..0pKgjnzCT0fPmVoPCsAd5YxlZPcCjN.", "admin2", current_timestamp(), "eHNQhNEiENYzy1wBYMn0ph:APA91bFall0HO1R54IankNJKJYFEe1r8WIFxaoEeOQWcO4VPBHfPShXNC8lso41hC8doBAEf2DavsWH_b-YwJ-J08Z-PQMF-f5mTbiUtyUv4USFI4yfuYpE");'
];

$success_count = 0;
$error_count = 0;

try {
    foreach ($sql_commands as $sql) {
        $sql = trim($sql);
        if (empty($sql)) continue;

        echo "Ejecutando: " . $sql . "\n";
        
        if ($conn->query($sql) === TRUE) {
            echo "  [ÉXITO]\n";
            $success_count++;
        } else {
            echo "  [FALLO] Error: " . $conn->error . "\n";
            $error_count++;
        }
    }

} catch (mysqli_sql_exception $e) {
    echo "\n--- ERROR FATAL DE SQL ---\n";
    echo "Comando fallido: " . $sql . "\n";
    echo "Mensaje: " . $e->getMessage() . "\n";
    $error_count++;
} catch (Exception $e) {
    echo "\n--- ERROR GENERAL ---\n";
    echo "Mensaje: " . $e->getMessage() . "\n";
    $error_count++;
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}

echo "\n--- RESUMEN ---\n";
echo "Comandos ejecutados con éxito: " . $success_count . "\n";
echo "Comandos con errores: " . $error_count . "\n";
echo "--- FIN DE LA ACTUALIZACIÓN DE ESQUEMA ---\n";
?>