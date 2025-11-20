<?php
// Configuración de la base de datos
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "awp";

// Habilitar el reporte de errores para mysqli para que lance excepciones
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    // Crear conexión
    $conn = new mysqli($servername, $username, $password, $dbname);
    // Establecer charset
    $conn->set_charset("utf8mb4");
} catch (mysqli_sql_exception $e) {
    // Si la conexión falla, esta excepción será capturada por el bloque try/catch en sync.php
    throw new Exception("Error de conexión a la base de datos: " . $e->getMessage());
}
?>