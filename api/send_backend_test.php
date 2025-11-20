<?php
// /awp/api/send_backend_test.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'db_connect.php';
require_once 'fcm_sender.php';
require_once 'notification_logic.php';

echo "<pre>";

// --- PRUEBA 1: Obtener todos los tokens ---
echo "--- Iniciando Prueba 1: Obtener todos los tokens FCM ---\n";
$tokens_sql = "SELECT fcm_token FROM usuarios WHERE fcm_token IS NOT NULL AND fcm_token != ''";
$result = $conn->query($tokens_sql);
$tokens = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $tokens[] = $row['fcm_token'];
    }
}

if (empty($tokens)) {
    echo "Resultado: No se encontraron tokens FCM en la base de datos. La prueba no puede continuar.\n";
    exit;
}

echo "Tokens encontrados: " . count($tokens) . "\n";
print_r($tokens);
echo "--- Prueba 1 Completada ---\n\n";


// --- PRUEBA 2: Enviar una notificación de prueba a cada token ---
echo "--- Iniciando Prueba 2: Enviar notificación de 'Nuevo Examen Creado' ---\n";

try {
    $fcmSender = new FCMSender();
    $notificationDetails = getNotificationDetails('exams', 'create');
    $title = $notificationDetails['title'];
    $body = $notificationDetails['body'];
    $icon = $notificationDetails['icon'];
    $dataPayload = ['module' => 'exams', 'action' => 'create'];

    $success_count = 0;
    $error_count = 0;

    foreach ($tokens as $token) {
        echo "Intentando enviar a token: " . substr($token, 0, 30) . "...\n";
        $response = $fcmSender->sendNotification($token, $title, $body, $icon, $dataPayload);

        if ($response['success']) {
            echo "  -> Éxito. Respuesta de FCM: " . json_encode($response['response']) . "\n";
            $success_count++;
        } else {
            echo "  -> Error. Detalles: " . $response['error'] . "\n";
            $error_count++;
        }
    }

    echo "\nResumen de envíos:\n";
    echo " -> Notificaciones exitosas: $success_count\n";
    echo " -> Notificaciones fallidas: $error_count\n";

} catch (Exception $e) {
    echo "Error fatal al inicializar FCMSender: " . $e->getMessage() . "\n";
}

echo "--- Prueba 2 Completada ---\n";

$conn->close();
echo "</pre>";
?>