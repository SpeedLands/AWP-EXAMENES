<?php
// /awp/api/send_test_notification.php

ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

session_start();
require_once 'db_connect.php';
require_once 'fcm_sender.php';
require_once 'notification_logic.php'; // Incluir la lógica de notificaciones

try {
    $currentUserId = $_SESSION['user_id'] ?? null;
    if (!$currentUserId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado. La sesión de usuario es requerida.']);
        exit;
    }

    // --- OBTENER EL TOKEN DEL USUARIO ACTUAL ---
    $stmt = $conn->prepare("SELECT fcm_token FROM usuarios WHERE id = ? AND fcm_token IS NOT NULL AND fcm_token != ''");
    $stmt->bind_param("i", $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        http_response_code(200); 
        echo json_encode(['success' => false, 'error' => 'El usuario actual no tiene un token FCM registrado.']);
        exit;
    }

    $fcmToken = $user['fcm_token'];

    // --- LÓGICA PARA LA NOTIFICACIÓN DE PRUEBA ---
    $module = 'exams';
    $action = 'create';
    
    // Generar los detalles de la notificación usando la lógica centralizada
    $notificationDetails = getNotificationDetails($module, $action);
    $title = $notificationDetails['title'];
    $body = $notificationDetails['body'];
    $icon = $notificationDetails['icon'];
    $dataPayload = ['module' => $module, 'action' => $action];

    // --- ENVIAR NOTIFICACIÓN ---
    $sender = new FCMSender();
    $result = $sender->sendNotification(
        $fcmToken,
        $title,
        $body,
        $icon,
        $dataPayload
    );

    // --- REGISTRAR EL INTENTO DE ENVÍO ---
    $estado_envio = $result['success'] ? 'ENVIADO' : 'FALLIDO';
    $error_fcm = !$result['success'] ? substr(json_encode($result['error']), 0, 250) : null;
    $fecha_envio = date('Y-m-d H:i:s');
    $dataPayloadJson = json_encode($dataPayload);

    $stmt = $conn->prepare("
        INSERT INTO notificaciones_registro
        (user_id, fcm_token, titulo, cuerpo, data_payload, estado_envio, error_fcm, fecha_envio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->bind_param("isssisss",
        $currentUserId,
        $fcmToken,
        $title,
        $body,
        $dataPayloadJson,
        $estado_envio,
        $error_fcm,
        $fecha_envio
    );
    $stmt->execute();
    $stmt->close();

    // --- RESPUESTA FINAL ---
    if ($result['success']) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Notificación de prueba enviada correctamente.']);
    } else {
        http_response_code(500); // Internal Server Error si FCM falla
        echo json_encode(['success' => false, 'error' => 'Fallo al enviar la notificación de prueba.', 'details' => $result['error']]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error inesperado en el servidor.', 'details' => $e->getMessage()]);
}
?>